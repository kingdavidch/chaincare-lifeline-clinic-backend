import nodemailer from "nodemailer"
import Handlebars from "handlebars"
import path from "path"
import fs from "fs"
import "dotenv/config"
import { IPatient } from "../../patient/patient.types"
import { ISubscriptionPlan } from "../../constant/subscription.plans"

const { EMAIL_PASS, EMAIL_USER } = process.env

const transporter = nodemailer.createTransport({
  host: "mail.privateemail.com",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
})

export default class SubscriptionEmailService {
  private static loadTemplate(filePath: string, data: object): string {
    const source = fs.readFileSync(filePath, "utf8").toString()
    const template = Handlebars.compile(source)
    return template(data)
  }

  /**
   * Send Subscription Confirmation Email
   */
  static async sendSubscriptionConfirmationEmail(
    patient: IPatient,
    plan: ISubscriptionPlan
  ): Promise<void> {
    const data = {
      fullName: patient.fullName,
      planName: plan.name,
      duration: plan.duration,
      startDate: new Date().toDateString(),
      endDate: new Date(
        new Date().setMonth(new Date().getMonth() + parseInt(plan.duration))
      ).toDateString(),
      privilege: plan.privilege ?? null,
      includedTests: plan.includedTests
    }

    const filePath = path.join(
      __dirname,
      "../../views/subscription/subscription.confirmation.html"
    )
    const htmlToSend = this.loadTemplate(filePath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient.email,
      subject: "Subscription Confirmation - LifeLine",
      text: `Hello ${patient.fullName}, You have successfully subscribed to the ${plan.name} plan.`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }
}
