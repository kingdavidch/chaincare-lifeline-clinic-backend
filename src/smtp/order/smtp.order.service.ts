import nodemailer from "nodemailer"
import fs from "fs"
import path from "path"
import Handlebars from "handlebars"
import "dotenv/config"
import { IOrder } from "../../order/order.types"
import { IPatient } from "../../patient/patient.types"
import { IClinic } from "../../clinic/clinic.types"
import { mapDeliveryMethod } from "../../order/utils"

const { EMAIL_USER, EMAIL_PASS } = process.env

const transporter = nodemailer.createTransport({
  host: "mail.privateemail.com",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
})

export default class OrderSmtpService {
  static loadTemplate(filePath: string, data: object): string {
    const source = fs.readFileSync(filePath, "utf8").toString()
    const template = Handlebars.compile(source)
    return template(data)
  }

  /**
   * Send Order Confirmation Email to Patient
   */
  static async sendOrderConfirmationEmail(order: IOrder): Promise<void> {
    const patient = order.patient as IPatient
    const clinic = order.clinic as IClinic

    const testRows = order.tests
      .map((test) => {
        const testName = test?.testName
        const price = test?.price ? test.price.toFixed(2) : "0.00"
        const individuals = test?.individuals ?? 1
        const turnaroundTime = test?.turnaroundTime ?? "N/A"
        const description = test?.description ?? "N/A"
        const currencySymbol = clinic?.currencySymbol ?? "N/A"

        return `
        <tr>
          <td data-label="Appointment Name">${testName}</td>
          <td data-label="Price">${price} ${currencySymbol}</td>
          <td data-label="Individuals">${individuals}</td>
          <td data-label="Turnaround Time">${turnaroundTime}</td>
          <td data-label="Description">${description}</td>
        </tr>
        `
      })
      .join("")

    const filepath = path.join(
      __dirname,
      "../../views/order/order.confirmation.html"
    )

    const isSelfPick = mapDeliveryMethod(order?.deliveryMethod) === "in-person"

    const clinicAddress =
      clinic?.location?.street || clinic?.location?.cityOrDistrict || null

    const clinicMapUrl =
      clinic?.location?.coordinates?.latitude &&
      clinic?.location?.coordinates?.longitude
        ? `https://maps.google.com/?q=${clinic.location.coordinates.latitude},${clinic.location.coordinates.longitude}`
        : clinicAddress
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicAddress)}`
          : null

    const htmlToSend = this.loadTemplate(filepath, {
      patientName: patient?.fullName,
      orderId: order?.orderId,
      clinicName: clinic?.clinicName,
      deliveryAddress: `${order.deliveryAddress.fullName}, ${order.deliveryAddress.phoneNo}, ${order.deliveryAddress.address}`,
      paymentMethod: order?.paymentMethod,
      totalAmount: order?.totalAmount ? order.totalAmount.toFixed(2) : "0.00",
      deliveryMethod: mapDeliveryMethod(order?.deliveryMethod),
      testRows,
      isSelfPick,
      clinicAddress: clinicAddress || null,
      clinicMapUrl
    })

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient?.email ?? "",
      subject: "Order Confirmation - LifeLine",
      text: `Your order has been placed successfully.`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }

  /**
   * Send Order Notification Email to Clinic
   */
  static async sendClinicOrderNotificationEmail(order: IOrder): Promise<void> {
    const clinic = order.clinic as IClinic
    const patient = order.patient as IPatient

    const testRows = order.tests
      .map((test) => {
        const testName = test?.testName
        const price = test?.price ? test.price.toFixed(2) : "0.00"
        const individuals = test?.individuals ?? 1
        const turnaroundTime = test?.turnaroundTime ?? "N/A"
        const description = test?.description ?? "N/A"
        const currencySymbol = clinic?.currencySymbol ?? "RWF"

        return `
        <tr>
          <td data-label="Appointment Name">${testName}</td>
          <td data-label="Price">${price} ${currencySymbol}</td>
          <td data-label="Individuals">${individuals}</td>
          <td data-label="Turnaround Time">${turnaroundTime}</td>
          <td data-label="Description">${description}</td>
        </tr>
      `
      })
      .join("")

    const filepath = path.join(
      __dirname,
      "../../views/order/order.clinic.confirmation.html"
    )

    const htmlToSend = this.loadTemplate(filepath, {
      patientName: patient?.fullName ?? "N/A",
      patientPhone: patient?.phoneNumber ?? "N/A",
      orderId: order?.orderId,
      deliveryAddress: `${order.deliveryAddress.fullName}, ${order.deliveryAddress.phoneNo}, ${order.deliveryAddress.address}`,
      paymentMethod: order?.paymentMethod ?? "N/A",
      totalAmount: order?.totalAmount ? order.totalAmount.toFixed(2) : "0.00",
      deliveryMethod: mapDeliveryMethod(order?.deliveryMethod),
      testRows
    })

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: clinic?.email,
      subject: `New Order Received - #${order?.orderId}`,
      text: `A new order has been placed by ${patient?.fullName}.`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }

  /**
   * Send Order Status Update Email to Patient
   */
  static async sendOrderStatusUpdateEmail(
    order: IOrder,
    testItem: IOrder["tests"][number],
    clinic: IClinic,
    patient: IPatient
  ): Promise<void> {
    const coords = clinic.location?.coordinates
    let googleMapLink = ""
    let clinicAddress = ""

    if (coords?.latitude && coords?.longitude) {
      googleMapLink = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`
    } else {
      const {
        street = "",
        cityOrDistrict = "",
        stateOrProvince = "",
        postalCode = ""
      } = clinic.location || {}

      const fullAddress = [street, cityOrDistrict, stateOrProvince, postalCode]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(", ")

      if (fullAddress) {
        clinicAddress = fullAddress
        googleMapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
      }
    }

    const statusReasonText =
      ["rejected", "cancelled", "failed"].includes(testItem.status) &&
      testItem.statusReason
        ? testItem.statusReason
        : ""

    const data = {
      patientName: patient.fullName,
      orderId: order.orderId,
      status: testItem.status,
      clinicName: clinic.clinicName,
      testImage: testItem.testImage,
      testName: testItem.testName,
      testPrice: testItem.price.toFixed(2),
      currencySymbol: clinic.currencySymbol,
      trackingLink: googleMapLink || null,
      clinicAddress: clinicAddress || null,
      statusReasonText
    }

    const filepath = path.join(
      __dirname,
      "../../views/order/order.status.update.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient.email,
      subject: `Your Order #${order.orderId} Status Update - LifeLine`,
      text: `Your order status has been updated.`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }

  /**
   * Send Payment Method Update Email to Patient
   */
  static async sendPaymentMethodUpdateEmail(order: IOrder): Promise<void> {
    const patient = order.patient as IPatient

    const data = {
      patientName: patient?.fullName ?? "N/A",
      orderId: order?.orderId,
      paymentMethod: order?.paymentMethod ?? "N/A"
    }

    const filepath = path.join(
      __dirname,
      "../../views/order/order.payment.update.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient?.email ?? "",
      subject: "Payment Method Updated - LifeLine",
      text: `Your payment method has been updated.`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }

  /**
   * Send Delivery Address Update Email to Patient
   */
  static async sendDeliveryAddressUpdateEmail(order: IOrder): Promise<void> {
    const patient = order.patient as IPatient

    const data = {
      patientName: patient?.fullName,
      orderId: order?.orderId,
      deliveryMethod: mapDeliveryMethod(order?.deliveryMethod)
    }

    const filepath = path.join(
      __dirname,
      "../../views/order/order.delivery.update.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient?.email ?? "",
      subject: "Delivery Address Updated - LifeLine",
      text: `Your delivery address has been updated.`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }
}
