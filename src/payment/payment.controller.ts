/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"
import "dotenv/config"
import { NextFunction, Request, Response } from "express"
import httpStatus from "http-status"
import clinicModel from "../clinic/clinic.model"
import clinicNotificationModel from "../clinic/clinic.notification.model"
import orderModel from "../order/order.model"
import { IOrder } from "../order/order.types"
import patientModel from "../patient/patient.model"
import patientNotificationModel from "../patient/patient.notification.model"
import OrderSmtpService from "../smtp/order/smtp.order.service"
import testItemModel from "../test/test.item.model"
import testModel from "../test/test.model"
import testBookingModel from "../testBooking(Cart)/testBooking.model"
import { generateOrderID } from "../utils"
import { sendPushNotification } from "../utils/sendPushNotification"
import { YellowCardService } from "./payment.service"
import {
  Channel,
  YellowCardSubmitCollectionDto,
  YellowCardWebhookPayload
} from "./payment.types"
import withdrawalModel from "./withdrawal.model"
import { IClinic } from "../clinic/clinic.types"
import { deliveryMethodToNumber } from "../order/utils"
import { notifyAdmin } from "../admin/utils"
import {
  handleFailedPayment,
  handlePatientPayment,
  handlePublicPayment
} from "."

export default class PaymentController {
  public static async getChannels(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const country: string = (req.query.country as string) || "RW"
      const paymentService = new YellowCardService()

      const channels: Channel[] =
        await paymentService.getPaymentChannels(country)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Available payment channels",
        data: channels
      })
    } catch (error) {
      console.error("🔴 Controller Error:", error)
      next(error)
    }
  }

  public static async submitDepositRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = req.body as YellowCardSubmitCollectionDto
      const ycService = new YellowCardService()

      const submitted = await ycService.submitCollectionRequest({
        ...data,
        currency: "USD",
        sequenceId: `txn_${Date.now()}`,
        source: {
          accountType: "bank",
          accountNumber: "1111111111"
        }
      })

      const accepted = await ycService.acceptCollectionRequest(submitted.id)
      const bankInfo = accepted.bankInfo

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Deposit request submitted. Transfer to the account below.",
        data: {
          collectionId: accepted.id,
          amount: accepted.amount,
          currency: accepted.currency,
          expiresAt: accepted.expiresAt,
          bankAccount: {
            bankName: bankInfo.name,
            accountNumber: bankInfo.accountNumber,
            accountName: bankInfo.accountName
          }
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getPaymentDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params
      const ycService = new YellowCardService()

      const payment = await ycService.getCollectionDetails(id)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Payment details retrieved",
        data: payment
      })
    } catch (error) {
      next(error)
    }
  }

  public static async handleYellowCardWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const data = req.body as YellowCardWebhookPayload
      const transactionId = data?.id
      const status = data?.status?.toLowerCase()

      if (!transactionId || !status) {
        res.status(httpStatus.BAD_REQUEST).send("Missing data.")
        return
      }

      const ycService = new YellowCardService()
      const payment = await ycService.getCollectionDetails(transactionId)
      const failureReason =
        payment?.failureReason || payment?.failureMessage || "Unknown reason"

      // Handle failed/rejected/cancelled payments
      if (["failed", "rejected", "cancelled"].includes(status)) {
        const order = await orderModel.findOne({
          "yellowCardInfo.ycTransactionId": transactionId
        })

        if (order) {
          order.paymentStatus = "failed"
          order.yellowCardInfo = {
            ...order.yellowCardInfo,
            status,
            rejectionReason: failureReason
          }
          await order.save()

          await patientNotificationModel.create({
            patient: order.patient,
            title: "Payment Failed",
            message: `Your payment for order #${order.orderId} failed. Reason: ${failureReason}`,
            type: "payment",
            isRead: false
          })

          await notifyAdmin(
            "Payment Failed",
            `Order #${order.orderId} (YellowCard) failed: ${failureReason}`,
            "payment"
          )
        }

        res.status(httpStatus.OK).send(`Failure processed: ${failureReason}`)
        return
      }

      // Accept pending_approval
      if (status === "pending_approval") {
        try {
          if (payment.status?.toLowerCase() === "pending_approval") {
            await ycService.acceptCollectionRequest(transactionId)
            console.log("✅ Accepted pending deposit:", transactionId)
          } else {
            console.log(
              "⏭️ Skipped accept — already processed:",
              payment.status
            )
          }
        } catch (err) {
          console.error("❌ Failed to accept YC deposit:", err)
        }
        res.status(httpStatus.OK).send("Handled pending approval.")
        return
      }

      // Ignore non-complete statuses
      if (status !== "complete") {
        res.status(httpStatus.OK).send("Status not handled.")
        return
      }

      // SUCCESS FLOW (unchanged except for payment already fetched above)
      const sequenceParts = payment.sequenceId.split("_")
      const patientId = sequenceParts[2]
      const deliveryMethod = deliveryMethodToNumber(sequenceParts[3])
      const patient = await patientModel.findById(patientId)
      if (!patient) {
        res.status(httpStatus.NOT_FOUND).send("Patient not found.")
        return
      }

      const cartItems = await testBookingModel.find({
        patient: patientId,
        status: "pending"
      })
      if (!cartItems?.length) {
        res.status(httpStatus.NOT_FOUND).send("No cart found.")
        return
      }

      const allTestItem = await testItemModel.find().select("name image")

      const testIds = cartItems.map((item) => item.test)
      const testDocs = await testModel
        .find({ _id: { $in: testIds } })
        .select("testName price turnaroundTime description")

      const testMap = new Map(
        testDocs.map((test) => [
          test._id.toString(),
          {
            testName: test.testName,
            price: test.price,
            turnaroundTime: test.turnaroundTime,
            description: test.description
          }
        ])
      )

      const groupedByClinic: Record<
        string,
        { tests: any[]; totalAmount: number; cartItemIds: string[] }
      > = {}

      for (const item of cartItems) {
        const clinicId = item.clinic.toString()
        const testData = testMap.get(item.test.toString())
        const testImage =
          allTestItem.find(
            (img) => img.name.toLowerCase() === testData?.testName.toLowerCase()
          )?.image || ""

        const subtotal = testData?.price ?? 0
        const finalPrice =
          item.discount?.finalPrice && item.discount.finalPrice > 0
            ? item.discount.finalPrice
            : subtotal

        const preparedTest = {
          test: item.test,
          testName: testData?.testName ?? "Unknown Test",
          price: subtotal,
          turnaroundTime: testData?.turnaroundTime ?? "N/A",
          description: testData?.description ?? "N/A",
          testImage,
          date: item.date,
          time: item.time,
          scheduledAt: item.scheduledAt,
          status: "pending",
          statusHistory: [{ status: "pending", changedAt: new Date() }]
        }

        if (!groupedByClinic[clinicId]) {
          groupedByClinic[clinicId] = {
            tests: [],
            totalAmount: 0,
            cartItemIds: []
          }
        }

        groupedByClinic[clinicId].tests.push(preparedTest)
        groupedByClinic[clinicId].totalAmount += finalPrice
        groupedByClinic[clinicId].cartItemIds.push(item._id.toString())
      }

      const rawTotalRwf = Object.values(groupedByClinic).reduce(
        (acc, group) => acc + group.totalAmount,
        0
      )

      const feePercentage = 0.02
      const fullTotalRwf = Math.round(rawTotalRwf * (1 + feePercentage))

      const expectedRwf = fullTotalRwf
      const ycRwf =
        payment.convertedAmount ||
        Math.round(payment.amount * (payment.rate || 1420))
      const rwfDiff = Math.abs(expectedRwf - ycRwf)

      if (rwfDiff > 10) {
        console.error("❌ YC RWF mismatch:", {
          expectedRwf,
          ycRwf,
          rate: payment.rate,
          difference: rwfDiff,
          tolerance: 10
        })
        res
          .status(httpStatus.BAD_REQUEST)
          .send(
            `Payment mismatch. Expected ${expectedRwf} RWF but got ${ycRwf} RWF`
          )
        return
      }

      const finalDeliveryAddress = {
        fullName: patient.fullName,
        phoneNo: patient.phoneNumber,
        address: patient.location.street,
        cityOrDistrict: patient.location.cityOrDistrict
      }

      const createdOrderIds: string[] = []

      for (const [clinicId, group] of Object.entries(groupedByClinic)) {
        const orderId = generateOrderID()

        const order = await orderModel.create({
          patient: patientId,
          clinic: clinicId,
          orderId,
          tests: group.tests,
          paymentMethod: "yellow_card",
          deliveryMethod,
          deliveryAddress: finalDeliveryAddress,
          totalAmount: group.totalAmount,
          paymentStatus: "paid",
          yellowCardInfo: {
            channelId: payment.channelId,
            ycTransactionId: transactionId,
            sequenceId: payment.sequenceId,
            status: "complete"
          }
        })

        await testBookingModel.updateMany(
          { _id: { $in: group.cartItemIds } },
          { status: "booked" }
        )

        const clinicRevenue = Math.round(group.totalAmount * 0.955)
        await clinicModel.findByIdAndUpdate(clinicId, {
          $inc: { balance: clinicRevenue }
        })

        const populatedOrder = await orderModel
          .findById(order._id)
          .populate("clinic")
          .populate("patient")
          .lean<IOrder>()

        await OrderSmtpService.sendOrderConfirmationEmail(
          populatedOrder as IOrder
        )
        await OrderSmtpService.sendClinicOrderNotificationEmail(
          populatedOrder as IOrder
        )

        await patientNotificationModel.create([
          {
            patient: patientId,
            title: "Order Confirmed",
            message: `Your order #${orderId} has been received`,
            type: "order",
            isRead: false
          },
          {
            patient: patientId,
            title: "Payment Received",
            message: `We've received your payment of ${group.totalAmount.toLocaleString()} RWF`,
            type: "payment",
            isRead: false
          }
        ])

        if (patient.expoPushToken) {
          await sendPushNotification({
            expoPushToken: patient.expoPushToken,
            title: "Payment Successful",
            message: `Your payment for order #${orderId} was received`,
            type: "payment"
          })

          await sendPushNotification({
            expoPushToken: patient.expoPushToken,
            title: "Order Received",
            message: `Your order #${orderId} has been received.`,
            type: "order"
          })
        }

        await clinicNotificationModel.create([
          {
            clinic: clinicId,
            title: "New Order Received",
            message: `New order #${orderId} from ${patient.fullName}`,
            type: "order",
            isRead: false
          },
          {
            clinic: clinicId,
            title: "Payment Processed",
            message: `Payment received for order #${orderId} (${group.totalAmount.toLocaleString()} RWF)`,
            type: "wallet",
            isRead: false
          }
        ])

        await notifyAdmin(
          "New Order Placed",
          `Patient "${patient.fullName}" placed a new order (${orderId})`,
          "order"
        )

        createdOrderIds.push(orderId)
      }

      res
        .status(httpStatus.OK)
        .send(`Created ${createdOrderIds.length} order(s).`)
    } catch (error) {
      console.error("❌ YC Webhook error:", error)
      res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .send("Internal server error.")
    }
  }

  public static async handlePawaPayWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const data = req.body
      const transactionId = data?.depositId
      const status = (data?.status || "").toLowerCase()
      const rawMetadata = data?.metadata ?? {}
      const failureReason =
        data?.failureReason?.failureMessage ??
        data?.failureMessage ??
        "Unknown error"

      if (!transactionId || !status) {
        res.status(httpStatus.BAD_REQUEST).send("Missing data.")
        return
      }

      // Handle failed/rejected first
      if (["failed", "rejected"].includes(status)) {
        await handleFailedPayment(failureReason, rawMetadata)
        res.status(httpStatus.OK).send("Deposit marked as failed.")
        return
      }

      // Ignore non-completed
      if (status !== "completed") {
        res.status(httpStatus.OK).send("Status not handled.")
        return
      }

      const existingOrder = await orderModel.findOne({
        depositId: transactionId
      })
      if (existingOrder) {
        res.status(httpStatus.OK).send("Order already processed.")
        return
      }

      const metadata = Array.isArray(rawMetadata)
        ? Object.fromEntries(
            rawMetadata.map((m: any) => [m.fieldName, m.fieldValue])
          )
        : rawMetadata

      if (metadata?.paymentOrigin === "public") {
        await handlePublicPayment(data, metadata)
        res.status(httpStatus.OK).send("Public order created successfully.")
        return
      }

      const createdOrderIds = await handlePatientPayment(data, metadata)
      res
        .status(httpStatus.OK)
        .send(`Created ${createdOrderIds.length} order(s) from PawaPay.`)
    } catch (error: any) {
      await notifyAdmin(
        "PawaPay Webhook Error",
        `Error occurred while processing PawaPay webhook: ${error.message}`,
        "warning"
      )
      res.status(500).send("Internal server error.")
    }
  }

  public static async handlePawaPayPayoutWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const data = req.body
      const { payoutId, status, providerTransactionId, failureReason } = data

      if (!payoutId || !status) {
        res.status(httpStatus.BAD_REQUEST).send("Invalid webhook payload.")
        return
      }

      const normalizedStatus = status.toUpperCase()

      const withdrawal = await withdrawalModel.findOne({ payoutId }).populate<{
        clinic: IClinic
      }>("clinic", "clinicName email")

      if (!withdrawal) {
        res.status(httpStatus.NOT_FOUND).send("Withdrawal not found.")
        return
      }

      if (["COMPLETED", "FAILED", "REJECTED"].includes(withdrawal.status)) {
        res.status(httpStatus.OK).send("Already processed.")
        return
      }

      const clinicId = withdrawal.clinic?._id
      const clinicName = withdrawal.clinic?.clinicName
      const phone = withdrawal.phoneNumber
      const amount = withdrawal.amount

      switch (normalizedStatus) {
        case "COMPLETED": {
          withdrawal.status = "completed"
          withdrawal.providerStatus = "COMPLETED"
          withdrawal.providerTransactionId = providerTransactionId
          withdrawal.statusHistory?.push({
            status: "completed",
            changedAt: new Date()
          })
          await withdrawal.save()

          await clinicNotificationModel.create([
            {
              clinic: clinicId,
              title: "Withdrawal Completed",
              message: `Your withdrawal of ${amount.toLocaleString()} RWF to ${phone} has been completed.`,
              type: "wallet",
              isRead: false
            }
          ])

          await notifyAdmin(
            "Clinic Withdrawal Completed",
            `Clinic ${clinicName} withdrawal of ${amount.toLocaleString()} RWF to ${phone} completed.`,
            "wallet"
          )

          break
        }

        case "FAILED":
        case "REJECTED": {
          withdrawal.status = "failed"
          withdrawal.providerStatus = normalizedStatus
          withdrawal.rejectionReason =
            failureReason?.failureMessage ?? "Unknown error"
          withdrawal.providerTransactionId = providerTransactionId
          await withdrawal.save()

          const totalRefund = (withdrawal.amount || 0) + (withdrawal.fee || 0)
          await clinicModel.findByIdAndUpdate(clinicId, {
            $inc: { balance: totalRefund }
          })

          await clinicNotificationModel.create([
            {
              clinic: clinicId,
              title: "Withdrawal Failed",
              message: `Your withdrawal of ${amount.toLocaleString()} RWF to ${phone} failed. Reason: ${withdrawal.rejectionReason}`,
              type: "wallet",
              isRead: false
            }
          ])

          await notifyAdmin(
            "Clinic Withdrawal Failed",
            `Clinic ${clinicName} withdrawal of ${amount.toLocaleString()} RWF to ${phone} failed. Reason: ${withdrawal.rejectionReason}`,
            "wallet"
          )

          break
        }

        default:
          res.status(httpStatus.OK).send("Unhandled status.")
          return
      }

      res.status(httpStatus.OK).send("Webhook processed.")
    } catch (error) {
      console.error("❌ Withdrawal Webhook Error:", error)
      res.status(httpStatus.INTERNAL_SERVER_ERROR).send("Webhook error.")
    }
  }

  public static async getPawaPayPaymentDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params

      const response = await axios.get(
        `${process.env.PAWAPAY_API_URL}/deposits/${id}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "PawaPay payment details retrieved",
        data: response.data
      })
    } catch (error) {
      next(error)
    }
  }

  public static async handleYellowCardPayoutWebhook(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const data = req.body
      const payoutId = data?.id
      const sequenceId = data?.sequenceId
      const status = (data?.status || "").toLowerCase()
      const eventType = (data?.eventType || "").toLowerCase()
      const normalizedStatus = status || eventType
      const errorCode = data?.errorCode

      if (!payoutId || !sequenceId || !normalizedStatus) {
        res.status(httpStatus.BAD_REQUEST).send("Invalid webhook payload.")
        return
      }

      const withdrawal = await withdrawalModel.findOne({ payoutId }).populate<{
        clinic: IClinic
      }>("clinic", "clinicName email")

      if (!withdrawal) {
        res.status(httpStatus.NOT_FOUND).send("Withdrawal not found.")
        return
      }

      if (["completed", "failed"].includes(withdrawal.status)) {
        res.status(httpStatus.OK).send("Already processed.")
        return
      }

      const clinicId = withdrawal.clinic?._id
      const clinicName = withdrawal.clinic?.clinicName
      const account = withdrawal.accountNumber
      const amount = withdrawal.amount

      // Early state logging
      if (["created", "processing"].includes(normalizedStatus)) {
        await withdrawalModel.updateOne(
          { _id: withdrawal._id },
          {
            providerTransactionId: payoutId,
            providerStatus: normalizedStatus,
            $push: {
              statusHistory: {
                status: normalizedStatus,
                changedAt: new Date()
              }
            }
          }
        )

        console.log(`ℹ️ YC payout still in progress: ${normalizedStatus}`)
        return res.status(httpStatus.OK).send("Payout in progress.")
      }

      // Completed
      if (
        ["completed", "complete", "payout.completed"].includes(normalizedStatus)
      ) {
        await withdrawalModel.updateOne(
          { _id: withdrawal._id },
          {
            status: "completed",
            providerTransactionId: payoutId,
            providerStatus: normalizedStatus,
            $push: {
              statusHistory: {
                status: "completed",
                changedAt: new Date()
              }
            }
          }
        )

        await clinicNotificationModel.create([
          {
            clinic: clinicId,
            title: "Withdrawal Completed",
            message: `Your withdrawal of ${amount.toLocaleString()} RWF to ${account} has been completed.`,
            type: "wallet",
            isRead: false
          }
        ])

        await notifyAdmin(
          "Clinic Withdrawal Completed",
          `Clinic ${clinicName} withdrawal of ${amount.toLocaleString()} RWF to ${account} completed.`,
          "wallet"
        )

        return res.status(httpStatus.OK).send("Withdrawal marked as completed.")
      }

      // Failed
      if (["failed", "payout.failed"].includes(normalizedStatus)) {
        const totalRefund = (withdrawal.amount || 0) + (withdrawal.fee || 0)

        await withdrawalModel.updateOne(
          { _id: withdrawal._id },
          {
            status: "failed",
            rejectionReason: errorCode || "Unknown error",
            providerTransactionId: payoutId,
            providerStatus: normalizedStatus,
            $push: {
              statusHistory: {
                status: "failed",
                changedAt: new Date()
              }
            }
          }
        )

        await clinicModel.findByIdAndUpdate(clinicId, {
          $inc: { balance: totalRefund }
        })

        await clinicNotificationModel.create([
          {
            clinic: clinicId,
            title: "Withdrawal Failed",
            message: `Your withdrawal of ${withdrawal.amount.toLocaleString()} RWF to ${account} failed. Reason: ${errorCode || "Unknown error"}`,
            type: "wallet",
            isRead: false
          }
        ])

        await notifyAdmin(
          "Clinic Withdrawal Failed",
          `Clinic ${clinicName} withdrawal of ${withdrawal.amount.toLocaleString()} RWF to ${account} failed. Reason: ${errorCode || "Unknown error"}`,
          "wallet"
        )

        return res.status(httpStatus.OK).send("Withdrawal marked as failed.")
      }

      await withdrawalModel.updateOne(
        { _id: withdrawal._id },
        {
          providerTransactionId: payoutId,
          providerStatus: normalizedStatus,
          $push: {
            statusHistory: {
              status: normalizedStatus,
              changedAt: new Date()
            }
          }
        }
      )

      console.warn(`⚠️ Unhandled YC payout status: ${normalizedStatus}`)
      res.status(httpStatus.OK).send("Unhandled status.")
    } catch (error) {
      console.error("❌ YC Payout Webhook Error:", error)
      res.status(httpStatus.INTERNAL_SERVER_ERROR).send("Webhook error.")
    }
  }

  public static async getYellowCardBanksForCountry(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const country = ((req.query.country as string) || "RWA").toUpperCase()

      const ycService = new YellowCardService()
      const channels = await ycService.getPaymentChannels(country)

      const banks = channels.map((channel) => ({
        id: channel.id,
        country: channel.country,
        currency: channel.currency,
        feeLocal: channel.feeLocal,
        feeUSD: channel.feeUSD,
        min: channel.min,
        max: channel.max,
        estimatedSettlementTime: channel.estimatedSettlementTime
      }))

      res.status(httpStatus.OK).json({
        success: true,
        message: `${banks.length} banks found`,
        data: banks
      })
    } catch (error) {
      next(error)
    }
  }
}
