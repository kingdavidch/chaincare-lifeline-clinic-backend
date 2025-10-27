/* eslint-disable @typescript-eslint/no-explicit-any */
import { notifyAdmin } from "../admin/utils"
import clinicModel from "../clinic/clinic.model"
import clinicNotificationModel from "../clinic/clinic.notification.model"
import { IClinic } from "../clinic/clinic.types"
import orderModel from "../order/order.model"
import {
  createCalendarEventsForOrder,
  deliveryMethodToNumber
} from "../order/utils"
import patientModel from "../patient/patient.model"
import patientNotificationModel from "../patient/patient.notification.model"
import { IPatient } from "../patient/patient.types"
import OrderSmtpService from "../smtp/order/smtp.order.service"
import testItemModel from "../test/test.item.model"
import testModel from "../test/test.model"
import testBookingModel from "../testBooking(Cart)/testBooking.model"
import { generateOrderID } from "../utils"
import { sendPushNotification } from "../utils/sendPushNotification"
import { PendingPublicOrder } from "../order/pendingpublicorder.model"

export async function handleFailedPayment(
  failureReason: string,
  metadata: any
) {
  const patientId = metadata.patientId
  if (!patientId) return

  await patientNotificationModel.create({
    patient: patientId,
    title: "Payment Failed",
    message: `Your payment could not be processed. Reason: ${failureReason}`,
    type: "payment",
    isRead: false
  })

  const patient = await patientModel
    .findById(patientId)
    .select("fullName expoPushToken")
  if (patient?.expoPushToken) {
    await sendPushNotification({
      expoPushToken: patient.expoPushToken,
      title: "Payment Failed",
      message: `Your payment could not be processed. Reason: ${failureReason}`,
      type: "payment"
    })
  }

  await notifyAdmin(
    "PawaPay Payment Failed",
    `PawaPay payment failed for patient "${patient?.fullName || "Unknown"}". Reason: ${failureReason}`,
    "alert"
  )
}

export async function handlePublicPayment(data: any, meta: any) {
  try {
    const orderKey = meta.orderKey
    if (!orderKey) throw new Error("orderKey missing in meta")

    const pendingOrder = await PendingPublicOrder.findOne({ orderKey })
    if (!pendingOrder) throw new Error("Pending order not found")

    const clinic = await clinicModel.findOne({
      clinicId: Number(pendingOrder.clinicId)
    })
    if (!clinic) throw new Error("Clinic not found")

    const testDoc = await testModel
      .findOne({
        clinic: clinic._id,
        testNo: pendingOrder.testNo,
        isDeleted: false
      })
      .select("testName price turnaroundTime description")
    if (!testDoc) throw new Error("Test not found")

    const allTestItem = await testItemModel.find().select("name image")
    const matchedImg = allTestItem.find(
      (img) => img.name?.toLowerCase() === testDoc.testName.toLowerCase()
    )
    const testImage = matchedImg?.image || ""

    let finalAmount = testDoc.price
    const appliedDiscount = pendingOrder.appliedDiscount || {}
    if (appliedDiscount?.percentage) {
      finalAmount -= (testDoc.price * appliedDiscount.percentage) / 100
    }

    const orderId = generateOrderID()
    const transactionId = data.depositId

    const order = await orderModel.create({
      orderId,
      clinic: clinic._id,
      tests: [
        {
          test: testDoc._id,
          testName: testDoc.testName,
          testImage,
          price: testDoc.price,
          turnaroundTime: testDoc.turnaroundTime,
          description: testDoc.description,
          scheduledAt: pendingOrder.scheduledAt,
          status: "pending",
          statusHistory: [{ status: "pending", changedAt: new Date() }]
        }
      ],
      deliveryMethod: pendingOrder.deliveryMethod,
      deliveryAddress: pendingOrder.deliveryAddress,
      totalAmount: finalAmount,
      paymentMethod: "pawa_pay",
      paymentStatus: "paid",
      isPublicBooking: true,
      publicBooker: {
        fullName: pendingOrder.fullName,
        email: pendingOrder.email,
        phoneNumber: pendingOrder.phoneNumber
      },
      pawaPayInfo: { depositId: transactionId, status: "complete" },
      appliedDiscount,
      scheduledAt: pendingOrder.scheduledAt
    })

    const clinicEarning = Math.round(finalAmount * 0.96)
    await clinicModel.findByIdAndUpdate(clinic._id, {
      $inc: { balance: clinicEarning }
    })

    const populatedOrder = await orderModel
      .findById(order._id)
      .populate<{ clinic: IClinic }>("clinic")

    if (populatedOrder) {
      await createCalendarEventsForOrder({
        _id: populatedOrder._id,
        orderId: populatedOrder.orderId,
        clinic: populatedOrder.clinic,
        patient: {
          fullName: pendingOrder.fullName,
          email: pendingOrder.email,
          phoneNumber: pendingOrder.phoneNumber
        } as any,
        deliveryMethod: pendingOrder.deliveryMethod,
        deliveryAddress: pendingOrder.deliveryAddress,
        tests: populatedOrder.tests
      })
    }

    await OrderSmtpService.sendPublicOrderConfirmationEmail(populatedOrder!)
    await OrderSmtpService.sendClinicPublicOrderNotificationEmail(
      populatedOrder!
    )

    await clinicNotificationModel.create([
      {
        clinic: clinic._id,
        title: "New Order Received",
        message: `New order #${orderId} from ${pendingOrder.fullName}`,
        type: "order",
        isRead: false
      },
      {
        clinic: clinic._id,
        title: "Payment Processed",
        message: `Payment received for order #${orderId} (${finalAmount.toLocaleString()} RWF)`,
        type: "wallet",
        isRead: false
      }
    ])

    await notifyAdmin(
      "New Order Placed",
      `Patient "${pendingOrder.fullName}" placed a new order (${orderId})`,
      "order"
    )

    await PendingPublicOrder.deleteOne({ _id: pendingOrder._id })
  } catch (err: any) {
    console.error("handlePublicPayment error:", err)
  }
}

export async function handlePatientPayment(
  data: any,
  metadata: any
): Promise<string[]> {
  const patientId = metadata.patientId
  const deliveryMethod = deliveryMethodToNumber(metadata.deliveryMethod)
  const transactionId = data.depositId

  const patient = await patientModel.findById(patientId)
  if (!patient) throw new Error("Patient not found")
  const cartItems = await testBookingModel.find({
    patient: patientId,
    status: "pending"
  })

  if (!cartItems?.length) throw new Error("No cart items found")

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

    const basePrice = testData?.price ?? 0
    const subtotal = basePrice
    const finalPrice =
      item.discount?.finalPrice && item.discount.finalPrice > 0
        ? item.discount.finalPrice
        : subtotal

    const preparedTest = {
      test: item.test,
      testName: testData?.testName ?? "Unknown Test",
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
      groupedByClinic[clinicId] = { tests: [], totalAmount: 0, cartItemIds: [] }
    }

    groupedByClinic[clinicId].tests.push(preparedTest)
    groupedByClinic[clinicId].totalAmount += finalPrice
    groupedByClinic[clinicId].cartItemIds.push(item._id.toString())
  }

  const createdOrderIds: string[] = []

  for (const [clinicId, group] of Object.entries(groupedByClinic)) {
    const orderId = generateOrderID()
    const clinic = await clinicModel.findById(clinicId)
    if (!clinic) continue

    const finalDeliveryAddress = {
      fullName: patient.fullName,
      phoneNo: patient.phoneNumber,
      address:
        `${patient.location?.street || ""}, ${patient.location?.cityOrDistrict || ""}, ${patient.location?.stateOrProvince || ""}, ${patient.location?.postalCode || ""}, ${patient.country || ""}`
          .replace(/^, |, ,/g, "")
          .trim(),
      cityOrDistrict: patient.location?.cityOrDistrict || ""
    }

    const order = await orderModel.create({
      patient: patientId,
      clinic: clinicId,
      orderId,
      tests: group.tests,
      paymentMethod: "pawa_pay",
      deliveryMethod,
      deliveryAddress: finalDeliveryAddress,
      totalAmount: group.totalAmount,
      paymentStatus: "paid",
      pawaPayInfo: { depositId: transactionId, status: "complete" }
    })

    await testBookingModel.updateMany(
      { _id: { $in: group.cartItemIds } },
      { status: "booked" }
    )

    const clinicEarning = Math.round(group.totalAmount * 0.96)
    await clinicModel.findByIdAndUpdate(clinicId, {
      $inc: { balance: clinicEarning }
    })

    const populatedOrder = await orderModel
      .findById(order._id)
      .populate<{ clinic: IClinic }>("clinic")
      .populate<{ patient: IPatient }>("patient")

    if (populatedOrder) {
      await createCalendarEventsForOrder(populatedOrder)
    }

    await OrderSmtpService.sendOrderConfirmationEmail(populatedOrder!)
    await OrderSmtpService.sendClinicOrderNotificationEmail(populatedOrder!)

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

  return createdOrderIds
}
