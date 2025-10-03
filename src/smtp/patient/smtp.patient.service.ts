import nodemailer from "nodemailer"
import Handlebars from "handlebars"
import path from "path"
import fs from "fs"
import "dotenv/config"
import { IPatient } from "../../patient/patient.types"

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

export default class PatientEmailService {
  private static loadTemplate(filePath: string, data: object): string {
    const source = fs.readFileSync(filePath, "utf8").toString()
    const template = Handlebars.compile(source)
    return template(data)
  }

  /**
   * Send OTP Email for Patient Account Verification
   */
  static async sendVerificationEmail(patient: IPatient): Promise<void> {
    const data = {
      fullName: patient.fullName,
      otp: patient.emailOtp
    }

    const filepath = path.join(
      __dirname,
      "../../views/patient/patient.verification.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient.email,
      subject: `Your LifeLine Verification Code: ${patient.emailOtp}`,
      text: `Hello ${patient.fullName},\n\nYour verification code is: ${patient.emailOtp}\n\nThis code expires in 10 minutes. If you didn't request this, please ignore this email.`,
      html: htmlToSend,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "High",
        Precedence: "bulk",
        "List-Unsubscribe": "<https://mylifeline.world/unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Mailer": "LifeLine Mail Service"
      },
      priority: "high" as const,
      date: new Date()
    }

    await transporter.sendMail(msg)
  }

  /**
   * Send OTP Email for Password Reset
   */
  static async sendPasswordResetOtp(patient: IPatient): Promise<void> {
    const data = {
      fullName: patient.fullName,
      otp: patient.emailOtp
    }

    const filepath = path.join(
      __dirname,
      "../../views/patient/patient.reset.password.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient.email,
      subject: "Password Reset Request - LifeLine",
      text: `Hello ${patient.fullName},\n\nYour OTP for resetting your password is: ${patient.emailOtp}\n\nIf you didn’t request this, please ignore this email.`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }

  /**
   * Send Welcome Email after Signup
   */
  static async sendWelcomeEmail(patient: IPatient): Promise<void> {
    const data = {
      fullName: patient.fullName
    }

    const filepath = path.join(
      __dirname,
      "../../views/patient/patient.welcome.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient.email,
      subject: "Welcome to LifeLine 🎉",
      text: `Hello ${patient.fullName}, welcome to LifeLine! We’re excited to have you on board.`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }
}
