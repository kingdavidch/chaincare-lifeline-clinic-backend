/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"
import "dotenv/config"
import { NextFunction, Request, Response } from "express"
import httpStatus from "http-status"
import mongoose from "mongoose"
import { v4 as uuidv4 } from "uuid"
import { io } from ".."
import adminModel from "../admin/admin.model"
import adminNotificationModel from "../admin/admin.notification.model"
import clinicModel from "../clinic/clinic.model"
import clinicNotificationModel from "../clinic/clinic.notification.model"
import { IClinic } from "../clinic/clinic.types"
import { ORDER_TEST_STATUS_FLOW, TERMINAL_TEST_STATUSES } from "../constant"
import patientModel from "../patient/patient.model"
import patientNotificationModel from "../patient/patient.notification.model"
import OrderSmtpService from "../smtp/order/smtp.order.service"
import testItemModel from "../test/test.item.model"
import testModel from "../test/test.model"
import testBookingModel from "../testBooking(Cart)/testBooking.model"
import testResultModel from "../testResult/test.result.model"
import {
  generateOrderID,
  getClinicId,
  getPatientId,
  validatePhoneWithPawaPay
} from "../utils"
import AppError from "../utils/app.error"
import { sendPushNotification } from "../utils/sendPushNotification"
import orderModel from "./order.model"
import {
  formatCase,
  isPopulatedTest,
  mapDeliveryMethod,
  deliveryMethodToNumber
} from "./utils"
import { IOrder } from "./order.types"
import moment from "moment-timezone"
import { getTimezoneForCountry } from "../utils/timezoneMap"
import { revalidateDiscount } from "../services/discount.service"

export default class OrderController {
  /**
   * Checkout (Place an Order)
   */
  public static async checkout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const patientId = getPatientId(req)
      const {
        paymentMethod,
        deliveryAddress,
        insuranceDetails,
        deliveryMethod,
        phoneNumber
      } = req.body

      const patient = await patientModel.findById(patientId)
      if (!patient)
        throw new AppError(httpStatus.NOT_FOUND, "Account not found.")

      const cartItems = await testBookingModel.find({
        patient: patientId,
        status: "pending"
      })

      if (!cartItems?.length) {
        throw new AppError(httpStatus.BAD_REQUEST, "Your cart is empty.")
      }

      await Promise.all(cartItems.map((item) => revalidateDiscount(item)))

      const [allTestItem, testDocs] = await Promise.all([
        testItemModel.find().select("name image"),
        testModel
          .find({
            _id: { $in: cartItems.map((item) => item.test) },
            isDeleted: false
          })
          .select("testName price turnaroundTime description")
      ])

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
        {
          tests: any[]
          totalAmount: number
          cartItemIds: string[]
        }
      > = {}

      for (const item of cartItems) {
        const clinicId = item.clinic.toString()
        const testData = testMap.get(item.test.toString())
        const testImage =
          allTestItem.find(
            (img) => img.name.toLowerCase() === testData?.testName.toLowerCase()
          )?.image || ""

        const basePrice = testData?.price ?? 0
        const subtotal = basePrice * item.individuals
        const finalPrice =
          item.discount?.finalPrice && item.discount.finalPrice > 0
            ? item.discount.finalPrice
            : subtotal

        const preparedTest = {
          test: item.test,
          testName: testData?.testName ?? "Unknown Test",
          individuals: item.individuals,
          price: basePrice,
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

      const allClinicTotals = Object.values(groupedByClinic).reduce(
        (acc, curr) => acc + curr.totalAmount,
        0
      )

      const clinicIds = Object.keys(groupedByClinic)
      const clinics = await clinicModel
        .find({ _id: { $in: clinicIds } })
        .select("onlineStatus clinicName")

      const offlineClinic = clinics.find(
        (clinic) => clinic.onlineStatus === "offline"
      )
      if (offlineClinic) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `Clinic "${offlineClinic.clinicName}" is currently offline and cannot accept orders.`
        )
      }

      const name = patient?.fullName?.trim()
      if (name.length < 5) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Full name must be at least 10 characters long for payment to be processed successfully."
        )
      }

      switch (paymentMethod.toLowerCase()) {
        case "pawa_pay": {
          if (!phoneNumber) {
            throw new AppError(
              httpStatus.BAD_REQUEST,
              "Phone number is required for PawaPay payment."
            )
          }

          const prediction = await validatePhoneWithPawaPay(phoneNumber)
          const predictedProvider = prediction.provider

          const orderId = generateOrderID()
          const depositId = uuidv4()

          const amountToSend = Math.round(allClinicTotals).toString()

          const depositPayload = {
            depositId,
            amount: amountToSend,
            currency: "RWF",
            country: "RWA",
            correspondent: predictedProvider,
            payer: {
              type: "MSISDN",
              address: { value: phoneNumber }
            },
            customerTimestamp: new Date().toISOString(),
            statementDescription: `Order ${orderId.slice(-6)}`,
            metadata: [
              {
                fieldName: "patientId",
                fieldValue: patientId?.slice(0, 64) || ""
              },
              { fieldName: "service", fieldValue: "clinic" },
              {
                fieldName: "callbackUrl",
                fieldValue: `${process.env.BACKEND_URL}/api/v1/payment/p/d-w`
              },
              { fieldName: "orderId", fieldValue: orderId.slice(0, 64) },
              {
                fieldName: "phoneNumber",
                fieldValue: phoneNumber.slice(0, 64)
              },
              { fieldName: "paymentMethod", fieldValue: "pawa_pay" },
              {
                fieldName: "totalAmount",
                fieldValue: allClinicTotals.toString().slice(0, 64)
              },
              {
                fieldName: "deliveryMethod",
                fieldValue: String(deliveryMethod)
              },
              {
                fieldName: "deliveryAddress",
                fieldValue: JSON.stringify(deliveryAddress).slice(0, 64)
              }
            ]
          }

          const response = await axios.post(
            `${process.env.PAWAPAY_API_URL}/deposits`,
            depositPayload,
            {
              headers: {
                Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
                "Content-Type": "application/json"
              },
              timeout: 10000
            }
          )

          if (response.data.status !== "ACCEPTED") {
            throw new AppError(
              httpStatus.BAD_REQUEST,
              response?.data?.rejectionReason || "Payment not accepted"
            )
          }

          return res.status(httpStatus.CREATED).json({
            success: true,
            message:
              "PawaPay payment initiated. Complete the payment on your phone.",
            data: {
              transactionId: response.data.depositId,
              orderId,
              amountToSend: parseInt(amountToSend),
              baseAmount: Math.round(allClinicTotals),
              phoneNumber,
              feePercentage: 0
            }
          })
        }

        case "insurance": {
          const patient = await patientModel.findById(patientId).lean()
          if (
            !patient ||
            !patient.insurance ||
            patient.insurance.length === 0
          ) {
            throw new AppError(
              httpStatus.BAD_REQUEST,
              "You must have at least one valid insurance record to use this payment method."
            )
          }

          const selectedInsuranceId = insuranceDetails?.insuranceId
          if (!selectedInsuranceId) {
            throw new AppError(
              httpStatus.BAD_REQUEST,
              "Insurance is required when using insurance payment."
            )
          }

          // Validate clinic support
          const clinicIds = Object.keys(groupedByClinic)
          const clinics = await clinicModel
            .find({ _id: { $in: clinicIds } })
            .select("clinicName supportInsurance")

          const unsupported = clinics.find(
            (clinic) => !clinic.supportInsurance?.includes(selectedInsuranceId)
          )
          if (unsupported) {
            throw new AppError(
              httpStatus.FORBIDDEN,
              `Clinic "${unsupported.clinicName?.toUpperCase()}" does not support this insurance.`
            )
          }

          const allCreatedOrders: string[] = []

          for (const [clinicId, entry] of Object.entries(groupedByClinic)) {
            const orderId = generateOrderID()

            const order = await orderModel.create({
              patient: patientId,
              clinic: clinicId,
              orderId,
              tests: entry.tests,
              paymentMethod,
              deliveryAddress,
              deliveryMethod: deliveryMethodToNumber(deliveryMethod),
              totalAmount: entry.totalAmount,
              insuranceDetails,
              paymentStatus: "paid"
            })

            await testBookingModel.updateMany(
              { _id: { $in: entry.cartItemIds } },
              { status: "booked" }
            )

            const populatedOrder = await orderModel
              .findById(order._id)
              .populate("clinic")
              .populate("patient")
              .lean<IOrder>()

            if (populatedOrder) {
              await OrderSmtpService.sendOrderConfirmationEmail(populatedOrder)
              await OrderSmtpService.sendClinicOrderNotificationEmail(
                populatedOrder
              )
            }

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
                message: `We've received your payment of ${entry.totalAmount.toLocaleString()} RWF via insurance`,
                type: "payment",
                isRead: false
              }
            ])

            if (patient.expoPushToken) {
              await sendPushNotification({
                expoPushToken: patient.expoPushToken,
                title: "Payment Successful",
                message: `Your payment for order #${orderId} was received via insurance`,
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
                message: `Payment received for order #${orderId} (${entry.totalAmount.toLocaleString()} RWF) via insurance`,
                type: "wallet",
                isRead: false
              }
            ])

            const admin = await adminModel.findOne()
            if (admin) {
              await adminNotificationModel.create([
                {
                  admin: admin._id,
                  title: "New Order Placed",
                  message: `Patient "${patient.fullName}" placed a new order (${orderId}) via insurance`,
                  type: "order",
                  isRead: false
                }
              ])
            }

            allCreatedOrders.push(orderId)
          }

          return res.status(httpStatus.CREATED).json({
            success: true,
            message: "Order(s) placed using insurance.",
            orderIds: allCreatedOrders
          })
        }

        default:
          throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment method")
      }
    } catch (error) {
      console.log(error)
      next(error)
    }
  }

  /**
   * Get All Orders for a Patient
   */
  public static async getUserOrders(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      const patient = await patientModel
        .findById(patientId)
        .select("fullName country")

      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const { filter } = req.query
      const page = parseInt(req.query.page as string) || 1
      const baseLimit = 10
      const limit = baseLimit * page
      const skip = 0

      let statusFilter: Record<string, unknown> = {}
      if (filter === "past") {
        statusFilter = {
          "tests.status": { $in: ["result_sent", "result_ready"] }
        }
      } else if (filter === "upcoming") {
        statusFilter = {
          "tests.status": {
            $in: ["pending", "sample_collected", "processing"]
          }
        }
      }

      const totalOrdersInDatabase = await orderModel.countDocuments({
        patient: patientId
      })

      const totalOrders = await orderModel.countDocuments({
        patient: patientId,
        ...statusFilter
      })

      const allOrders = await orderModel
        .find({
          patient: patientId,
          ...statusFilter
        })
        .sort({ createdAt: -1 })
        .select("-__v")
        .skip(skip)
        .limit(limit)

      const testItems = await testItemModel.find().select("name image")

      const ordersWithDetails = await Promise.all(
        allOrders.map(async (order) => {
          const clinic = await clinicModel
            .findById(order.clinic)
            .select("clinicName")

          if (!clinic) {
            throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
          }

          const formattedTests = await Promise.all(
            order.tests.map(async (testItem) => {
              const test = await testModel
                .findById(testItem.test)
                .setOptions({ includeDeleted: true })
                .select("testName price currencySymbol")

              const testImage =
                testItems?.find(
                  (ti) =>
                    ti.name?.toLowerCase() === test?.testName?.toLowerCase()
                )?.image || ""

              const timezone = getTimezoneForCountry(patient.country)

              return {
                _id: order._id,
                orderId: order.orderId,
                testId: testItem.test,
                testImage,
                testName: test?.testName,
                individuals: testItem?.individuals,
                date: order.createdAt
                  ? moment(order.createdAt)
                      .tz(timezone)
                      .format("ddd, D MMM YYYY")
                  : null,
                selectedTestDate: testItem?.date
                  ? moment(testItem.date).tz(timezone).format("ddd, D MMM YYYY")
                  : null,
                clinicName: clinic?.clinicName,
                price: testItem?.price,
                currencySymbol: test?.currencySymbol,
                status: testItem.status,
                statusReason: testItem.statusReason || null,
                paymentStatus: order.paymentStatus
              }
            })
          )

          return formattedTests
        })
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "User orders retrieved successfully.",
        hasNoOrders: totalOrdersInDatabase === 0,
        data: ordersWithDetails.flat(),
        pagination: {
          currentPage: page,
          total: totalOrders,
          totalPages: Math.ceil(totalOrders / baseLimit)
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get Order Details for Clinic
   */
  public static async getClinicOrderDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const orderId = req.params.orderId
      const clinicId = getClinicId(req)

      const order = await orderModel
        .findOne({ _id: orderId, clinic: clinicId })
        .populate("patient", "fullName email phoneNumber")
        .select("-__v")
        .lean()

      if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, "Order not found.")
      }

      const tests = await Promise.all(
        order.tests.map(async (t: any) => {
          const testDoc = await testModel
            .findById(t.test)
            .setOptions({ includeDeleted: true })
            .select("currencySymbol image")
            .lean()
          return { ...t, test: testDoc }
        })
      )

      order.tests = tests

      const clinic = await clinicModel
        .findById(clinicId)
        .select("currencySymbol")
        .lean()

      const currencySymbol = clinic?.currencySymbol || "₦"

      const allTestItems = await testItemModel
        .find()
        .select("name image")
        .lean()

      const testResults = await testResultModel
        .find({
          clinic: clinicId,
          patient: order.patient._id,
          order: order._id,
          test: { $in: order.tests.map((t: any) => t.test) }
        })
        .select("test resultSent")
        .lean()

      const testResultMap = new Map<string, boolean>()
      testResults.forEach((tr) => {
        testResultMap.set(tr.test.toString(), tr.resultSent ?? false)
      })

      const testsWithImages = order.tests.map((test: any) => {
        const testRef = test.test as any
        const image =
          allTestItems.find(
            (item) => item.name.toLowerCase() === test.testName.toLowerCase()
          )?.image ||
          testRef?.image ||
          ""
        const resultSent = testResultMap.get(testRef._id.toString()) || false
        return {
          _id: testRef._id,
          testName: test.testName,
          price: test.price,
          currencySymbol: testRef?.currencySymbol,
          image,
          resultSent,
          status: test.status,
          date: moment(test.scheduledAt || test.date).format(
            "YYYY-MM-DD hh:mm A"
          ),
          statusReason: test.statusReason || null,
          statusHistory: test.statusHistory || []
        }
      })

      const paymentMethodLabel =
        order.paymentMethod === "pawa_pay"
          ? "momo with pawapay"
          : order.paymentMethod === "yellow_card"
            ? "bank transfer with yellow card"
            : order.paymentMethod

      const orderWithImages = {
        ...order,
        tests: testsWithImages,
        currencySymbol,
        paymentMethodLabel,
        insuranceDetails:
          order.paymentMethod === "insurance"
            ? order.insuranceDetails
            : undefined,
        deliveryMethod: mapDeliveryMethod(order.deliveryMethod)
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Order details retrieved successfully.",
        data: orderWithImages
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get All Orders for a Clinic with Pagination & Filters
   */
  public static async getClinicOrders(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const { page = "1", limit = "10", paymentMethod, date } = req.query

      const pageNumber = parseInt(page as string, 10) || 1
      const limitNumber = parseInt(limit as string, 10) || 10
      const skip = (pageNumber - 1) * limitNumber

      const filter: Record<string, unknown> = { clinic: clinicId }

      if (paymentMethod) {
        const pm = (paymentMethod as string).toLowerCase()
        if (pm === "momo") {
          filter.paymentMethod = "pawa_pay"
        } else if (pm === "bank transfer") {
          filter.paymentMethod = "yellow_card"
        } else {
          filter.paymentMethod = pm
        }
      }

      if (date) {
        const startDate = new Date(date as string)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(date as string)
        endDate.setHours(23, 59, 59, 999)
        filter.createdAt = { $gte: startDate, $lte: endDate }
      }

      const orders = await orderModel
        .find(filter)
        .select("orderId patient tests totalAmount createdAt paymentMethod")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean()

      const totalOrdersInDatabase = await orderModel.countDocuments({
        clinic: clinicId
      })

      const formattedOrders = await Promise.all(
        orders.map(async (order) => {
          const patient = await patientModel
            .findById(order.patient)
            .select("fullName")

          const clinicDoc = await clinicModel
            .findById(clinicId)
            .select("country")
          const timezone = getTimezoneForCountry(clinicDoc?.country)

          let currencySymbol = "RWF"

          if (order.tests?.length) {
            const testRef = order.tests[0]?.test
            if (testRef) {
              const testDoc = await testModel
                .findById(testRef)
                .select("currencySymbol")
                .lean()
              if (testDoc?.currencySymbol) {
                currencySymbol = testDoc.currencySymbol
              }
            }
          }

          const testNames = (() => {
            const names = order.tests.map((t) => t.testName)
            if (names.length === 0) return "N/A"
            if (names.length <= 2) return names.join(", ")
            return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`
          })()

          const testStatuses = order.tests?.map((t) => t.status) || []
          const uniqueStatuses = [...new Set(testStatuses)]
          let overallStatus = "pending"

          if (uniqueStatuses.length === 1) {
            overallStatus = uniqueStatuses[0]
          } else {
            overallStatus = "mixed"
          }

          const testResults = await testResultModel
            .find({
              clinic: clinicId,
              patient: order.patient,
              order: order._id,
              test: { $in: order.tests?.map((t) => t.test) || [] }
            })
            .select("resultSent")
            .lean()

          const resultSent = testResults.some((tr) => tr.resultSent === true)

          return {
            id: order?._id,
            orderId: order?.orderId,
            CustomerName: patient?.fullName || "N/A",
            Test: testNames,
            Date: moment.utc(order.createdAt).tz(timezone).format("DD-MM-YYYY"),
            Time: moment.utc(order.createdAt).tz(timezone).format("hh:mm A"),
            PaymentMethod:
              order?.paymentMethod === "pawa_pay"
                ? "momo"
                : order?.paymentMethod === "yellow_card"
                  ? "bank transfer"
                  : order?.paymentMethod,
            price: order?.totalAmount,
            currencySymbol,
            Status: overallStatus,
            resultSent
          }
        })
      )

      const totalOrders = await orderModel.countDocuments(filter)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Orders retrieved successfully.",
        hasNoOrders: totalOrdersInDatabase === 0,
        data: formattedOrders,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalOrders / limitNumber),
          totalOrders
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update Order Test Status (Clinic)
   */
  public static async updateOrderTestStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const { id, testId } = req.params
      const { status, statusReason } = req.body

      const validStatuses = [
        "pending",
        "sample_collected",
        "processing",
        "result_ready",
        "result_sent",
        "rejected",
        "cancelled",
        "failed"
      ]

      if (!validStatuses.includes(status)) {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid status.")
      }

      const order = await orderModel
        .findOne({ _id: id, clinic: clinicId })
        .populate("patient", "fullName email phoneNumber")
        .populate("clinic", "clinicName location currencySymbol")

      if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, "Order not found.")
      }

      const testItem = order.tests.find(
        (t) => t.test.toString() === testId.toString()
      )

      if (!testItem) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found in order.")
      }

      if (status === "rejected" && order.paymentMethod === "pawa_pay") {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Orders paid with MoMo cannot be rejected."
        )
      }

      const requiresReason = ["rejected", "cancelled", "failed"].includes(
        status
      )
      if (requiresReason && !statusReason) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Please provide a reason for marking the test as ${status}.`
        )
      }

      if (status === "cancelled") {
        const disallowedStates = ["result_ready", "result_sent"]
        if (disallowedStates.includes(testItem.status)) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            "Cannot cancel a test that is already completed or result has been sent."
          )
        }

        if (order.paymentMethod === "insurance" && !statusReason) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            "Cancelling insurance-based orders requires a reason."
          )
        }
      }

      const statusFlow = [
        "pending",
        "sample_collected",
        "processing",
        "result_ready",
        "result_sent"
      ]

      const currentStatus = testItem.status
      const currentIndex = statusFlow.indexOf(currentStatus)
      const finalIndex = statusFlow.indexOf(status)

      const statusesToFill =
        currentIndex === -1
          ? statusFlow.slice(0, finalIndex + 1)
          : statusFlow.slice(currentIndex + 1, finalIndex + 1)

      const now = new Date()

      const historyEntries: {
        status:
          | "pending"
          | "sample_collected"
          | "processing"
          | "result_ready"
          | "result_sent"
          | "rejected"
          | "cancelled"
          | "failed"
        changedAt: Date
      }[] = statusesToFill.map((s) => ({
        status: s as
          | "pending"
          | "sample_collected"
          | "processing"
          | "result_ready"
          | "result_sent"
          | "rejected"
          | "cancelled"
          | "failed",
        changedAt: now
      }))

      testItem.status = status
      testItem.statusReason = requiresReason ? statusReason : null

      if (!Array.isArray(testItem.statusHistory)) {
        testItem.statusHistory = []
      }

      testItem.statusHistory.push(...historyEntries)

      await order.save()

      const patient = await patientModel
        .findById(order.patient._id)
        .select("fullName email phoneNumber expoPushToken")
      const clinic = await clinicModel
        .findById(clinicId)
        .select("clinicName location currencySymbol")
      const admin = await adminModel.findOne()

      if (patient && clinic) {
        try {
          await OrderSmtpService.sendOrderStatusUpdateEmail(
            order,
            testItem,
            clinic,
            patient
          )
        } catch (emailErr) {
          console.error("Failed to send status update email:", emailErr)
        }

        await patientNotificationModel.create({
          patient: patient._id,
          title: "Test Status Updated",
          message: `The status of your "${formatCase(
            testItem.testName
          )}" test in order ${order.orderId} has been updated to "${status.replace(
            /_/g,
            " "
          )}".`,
          type: "order",
          isRead: false
        })

        if (patient.expoPushToken) {
          await sendPushNotification({
            expoPushToken: patient.expoPushToken,
            title: `${formatCase(testItem.testName)} Test • Status Updated`,
            message: `Your "${formatCase(
              testItem.testName
            )}" test is now "${status.replace(/_/g, " ")}". Tap to view details.`,
            type: "order",
            data: {
              screen: "OrderDetails",
              orderId: order._id.toString(),
              testId: testItem.test.toString()
            }
          })
        }

        if (admin) {
          await adminNotificationModel.create({
            admin: admin._id,
            title: "Test Status Updated by Clinic",
            message: `The clinic "${
              clinic.clinicName
            }" has updated the status of test "${formatCase(
              testItem.testName
            )}" in order ${order.orderId} to "${status.replace(/_/g, " ")}".`,
            type: "order",
            isRead: false
          })
        }

        await clinicNotificationModel.create({
          clinic: clinic._id,
          title: "Test Status Updated",
          message: `Status of test "${formatCase(
            testItem.testName
          )}" in order ${order.orderId} has been updated to "${status.replace(
            /_/g,
            " "
          )}".`,
          type: "order",
          isRead: false
        })
      }

      io.emit("orderTestStatus:update", {
        clinicId,
        orderId: order._id,
        testId: testItem.test.toString(),
        status: testItem.status,
        statusReason: testItem.statusReason,
        statusHistory: testItem.statusHistory,
        patient: {
          _id: patient?._id,
          fullName: patient?.fullName,
          email: patient?.email,
          phoneNumber: patient?.phoneNumber
        },
        clinic: {
          _id: clinic?._id,
          clinicName: clinic?.clinicName,
          location: clinic?.location,
          currencySymbol: clinic?.currencySymbol
        }
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test status updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async updateOrderPaymentMethod(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const patientId = getPatientId(req)
      const { orderId } = req.params
      const { paymentMethod } = req.body

      const order = await orderModel
        .findOne(
          {
            _id: orderId,
            patient: patientId
          },
          null,
          { session }
        )
        .populate("patient clinic")

      if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, "Order not found.")
      }

      order.paymentMethod = paymentMethod
      await order.save({ session })

      // Send email notification
      await OrderSmtpService.sendPaymentMethodUpdateEmail(order)
        .then(() => {
          console.log("Payment method email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending payment method email:", error)
        })

      // Create patient notification
      const [newNotification] = await patientNotificationModel.create(
        [
          {
            patient: patientId,
            title: "Payment Method Updated",
            message: `Payment method for order (${order.orderId}) has been updated to ${paymentMethod}.`,
            type: "order",
            isRead: false
          }
        ],
        { session }
      )

      // Fetch patient for push token
      const patient = await patientModel.findById(patientId)

      if (patient?.expoPushToken) {
        await sendPushNotification({
          expoPushToken: patient.expoPushToken,
          title: newNotification.title,
          message: newNotification.message,
          type: newNotification.type
        })
      }

      // Create clinic notification
      await clinicNotificationModel.create(
        [
          {
            clinic: (order.clinic as IClinic)._id,
            title: "Payment Method Updated",
            message: `Patient updated payment method for order (${order.orderId}) to ${paymentMethod}.`,
            type: "order",
            isRead: false
          }
        ],
        { session }
      )

      await session.commitTransaction()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Order payment method updated successfully."
      })
    } catch (error) {
      await session.abortTransaction()
      next(error)
    } finally {
      session.endSession()
    }
  }

  public static async updateDeliveryAddress(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const patientId = getPatientId(req)
      const { orderId } = req.params
      const { fullName, phoneNo, address, cityOrDistrict } = req.body

      const order = await orderModel
        .findOne(
          {
            _id: orderId,
            patient: patientId
          },
          null,
          { session }
        )
        .populate("patient clinic")

      if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, "Order not found.")
      }

      order.deliveryAddress = { fullName, phoneNo, address, cityOrDistrict }
      await order.save({ session })

      // Send email notification
      await OrderSmtpService.sendDeliveryAddressUpdateEmail(order)
        .then(() => {
          console.log("Delivery address email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending delivery address email:", error)
        })

      // Create patient notification
      const [newNotification] = await patientNotificationModel.create(
        [
          {
            patient: patientId,
            title: "Delivery Address Updated",
            message: `Delivery address for order (${order.orderId}) has been updated.`,
            type: "order",
            isRead: false
          }
        ],
        { session }
      )

      // Fetch patient to get expoPushToken
      const patient = await patientModel.findById(patientId)

      if (patient?.expoPushToken) {
        await sendPushNotification({
          expoPushToken: patient.expoPushToken,
          title: newNotification.title,
          message: newNotification.message,
          type: newNotification.type
        })
      }

      // Create clinic notification
      await clinicNotificationModel.create(
        [
          {
            clinic: (order.clinic as IClinic)._id,
            title: "Delivery Address Updated",
            message: `Patient updated delivery address for order (${order.orderId}).`,
            type: "order",
            isRead: false
          }
        ],
        { session }
      )

      await session.commitTransaction()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Delivery address updated successfully."
      })
    } catch (error) {
      await session.abortTransaction()
      next(error)
    } finally {
      session.endSession()
    }
  }

  public static async getOrderTestDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { orderId, testId } = req.params

      const order = await orderModel
        .findOne({
          _id: orderId,
          patient: patientId
        })
        .populate("clinic", "clinicName location")
        .select("-__v")
        .lean()

      if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, "Order not found.")
      }

      const testItem = order.tests.find((t) => {
        const testIdStr = isPopulatedTest(t.test)
          ? t.test._id.toString()
          : t.test.toString()
        return testIdStr === testId
      })

      if (!testItem) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found in order.")
      }

      const testRef = await testModel
        .findById(testItem.test)
        .setOptions({ includeDeleted: true })
        .select("currencySymbol image description turnaroundTime")
        .lean()

      const statusProgress = ORDER_TEST_STATUS_FLOW.map((status) => {
        const historyEntry = testItem.statusHistory?.find(
          (h) => h.status === status
        )
        return {
          status,
          date: historyEntry?.changedAt || null
        }
      })

      const terminalEntry = TERMINAL_TEST_STATUSES.find(
        (s) => s === testItem.status
      )

      if (terminalEntry) {
        const changedAt =
          testItem.statusHistory?.find((h) => h.status === terminalEntry)
            ?.changedAt ??
          order.updatedAt ??
          null

        statusProgress.push({
          status: terminalEntry,
          date: changedAt
        })
      }

      const paymentMethodLabel =
        order.paymentMethod === "pawa_pay"
          ? "momo with pawapay"
          : order.paymentMethod === "yellow_card"
            ? "bank transfer with yellow card"
            : order.paymentMethod

      res.status(httpStatus.OK).json({
        success: true,
        message: "Order details retrieved successfully.",
        data: {
          orderId: order.orderId,
          test: testRef?._id || testItem.test,
          testName: testItem.testName,
          testImage: testItem.testImage,
          price: testItem.price,
          currencySymbol: testRef?.currencySymbol,
          individuals: testItem.individuals,
          turnaroundTime: testRef?.turnaroundTime || testItem.turnaroundTime,
          description: testRef?.description || testItem.description,
          status: testItem.status,
          statusReason: testItem.statusReason,
          paymentMethod: paymentMethodLabel,
          insuranceDetails:
            order.paymentMethod === "insurance"
              ? order.insuranceDetails
              : undefined,
          deliveryMethod: mapDeliveryMethod(order.deliveryMethod),
          deliveryAddress: order.deliveryAddress,
          scheduledAt: moment(testItem.scheduledAt).format(
            "YYYY-MM-DD hh:mm A"
          ),
          date: moment(testItem.date).format("YYYY-MM-DD"),
          time: moment(testItem.time, "HH:mm").format("hh:mm A"),
          updatedAt: order.updatedAt,
          statusFlow: ORDER_TEST_STATUS_FLOW,
          terminalStatuses: TERMINAL_TEST_STATUSES,
          statusProgress
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getPawaPayConfirmationStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { transactionId } = req.params

      const orders = await orderModel.find({
        "pawaPayInfo.depositId": transactionId,
        paymentStatus: "paid"
      })

      if (!orders.length) {
        return res.status(httpStatus.NOT_FOUND).json({
          success: false,
          message: "Order not yet created for this transaction."
        })
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Order created and payment confirmed.",
        data: {
          orderCreated: true,
          cartCleared: true,
          orderIds: orders.map((order) => order.orderId)
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get All Orders with Patient Info for a Clinic
   */
  public static async getClinicOrdersForAutoComplete(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const orders = await orderModel
        .find({ clinic: clinicId })
        .select("orderId patient createdAt")
        .sort({ createdAt: -1 })
        .lean()

      const data = await Promise.all(
        orders.map(async (order) => {
          const patient = await patientModel
            .findById(order.patient)
            .select("fullName email")
            .lean()

          return {
            orderId: order.orderId,
            patientName: patient?.fullName || "Unknown",
            patientEmail: patient?.email || ""
          }
        })
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "Orders with patient info retrieved successfully.",
        data
      })
    } catch (error) {
      next(error)
    }
  }
}
