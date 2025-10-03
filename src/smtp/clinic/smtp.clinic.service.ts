import nodemailer from "nodemailer"
import fs from "fs"
import path from "path"
import Handlebars from "handlebars"
import "dotenv/config"
import { IClinic } from "../../clinic/clinic.types"

const { BACKEND_URL, FRONTEND_URL, EMAIL_USER, EMAIL_PASS } = process.env

const transporter = nodemailer.createTransport({
  host: "mail.privateemail.com",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
})

export default class SmtpService {
  static readonly FRONTEND_URL: string = process.env.FRONTEND_URL as string
  static readonly BACKEND_URL: string = process.env.BACKEND_URL as string

  static loadTemplate(filePath: string, data: object): string {
    const source = fs.readFileSync(filePath, "utf8").toString()
    const template = Handlebars.compile(source)
    return template(data)
  }

  // Send Verification Email
  static async sendClinicVerificationEmail(clinic: IClinic): Promise<void> {
    const verificationLink = `${BACKEND_URL}/api/v1/clinic/verify?key=${clinic.clinicId}`
    const data = { clinicName: clinic.clinicName, verificationLink }

    const filepath = path.join(
      __dirname,
      "../../views/clinic/clinic.verification.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: clinic.email,
      subject: `Verify Your LifeLine Clinic Account: ${clinic.clinicName}`,
      text: `Hello ${clinic.clinicName},\n\nWelcome to LifeLine! Please verify your clinic account by clicking the following link: ${verificationLink}\n\nIf you didn't request this, please ignore this email.`,
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

  // Send Password Reset Email
  static async sendClinicResetPasswordEmail(
    clinic: IClinic,
    resetToken: string
  ): Promise<void> {
    const resetLink = `${FRONTEND_URL}/reset-password/new?token=${resetToken}`
    const data = { clinicName: clinic.clinicName, resetLink }

    const filepath = path.join(
      __dirname,
      "../../views/clinic/clinic.reset.password.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: clinic.email,
      subject: "Reset Your Password",
      text: `Hello ${clinic.clinicName}, reset your password by clicking the following link: ${resetLink}`,
      html: htmlToSend
    }
    await transporter.sendMail(msg)
  }

  // Send Certificate Status Email
  static async sendCertificateStatusEmail(
    clinic: IClinic,
    status: "approved" | "rejected",
    rejectionReason?: string
  ): Promise<void> {
    const actionLink =
      status === "approved"
        ? `${FRONTEND_URL}/login`
        : "mailto:Contact@lifelinrafrica.app"

    const data = {
      clinicName: clinic.clinicName,
      status,
      approved: status === "approved",
      actionLink,
      rejectionReason
    }

    const filepath = path.join(
      __dirname,
      "../../views/clinic/clinic.certificate.status.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const subject =
      status === "approved"
        ? "Your Clinic Certificate Has Been Approved"
        : "Your Clinic Certificate Has Been Rejected"

    const textContent =
      status === "approved"
        ? `Hello ${clinic.clinicName}, your clinic certificate has been approved. You can now log in to LifeLine: ${actionLink}`
        : `Hello ${clinic.clinicName}, your clinic certificate has been rejected. Reason: ${rejectionReason}. Please contact support for assistance: ${actionLink}`

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: clinic.email,
      subject,
      text: textContent,
      html: htmlToSend
    }
    await transporter.sendMail(msg)
  }

  // Send Status Email
  static async sendStatusUpdateEmail(
    clinic: IClinic,
    status: "approved" | "rejected" | "suspended",
    reason?: string
  ): Promise<void> {
    const isApproved = status === "approved"
    const actionLink = isApproved
      ? `${FRONTEND_URL}/login`
      : "mailto:Contact@lifelinrafrica.app"

    const data = {
      clinicName: clinic.clinicName,
      status,
      approved: isApproved,
      actionLink,
      rejectionReason: reason
    }

    const filepath = path.join(
      __dirname,
      "../../views/clinic/clinic.status.update.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const subjectMap = {
      approved: "Your Clinic Registration Has Been Approved",
      rejected: "Your Clinic Registration Has Been Rejected",
      suspended: "Your Clinic Has Been Suspended"
    }

    const textContentMap = {
      approved: `Hello ${clinic.clinicName}, your clinic registration has been approved. You can now log in to LifeLine: ${actionLink}`,
      rejected: `Hello ${clinic.clinicName}, your clinic registration has been rejected. Reason: ${reason}. Please contact support: ${actionLink}`,
      suspended: `Hello ${clinic.clinicName}, your clinic has been suspended. Reason: ${reason}. Please contact support: ${actionLink}`
    }

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: clinic.email,
      subject: subjectMap[status],
      text: textContentMap[status],
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }

  // Send Contract Acceptance Email to Clinic
  static async sendContractAcceptanceEmail(clinic: IClinic): Promise<void> {
    const data = { clinicName: clinic.clinicName }

    const filepath = path.join(
      __dirname,
      "../../views/clinic/clinic.contract.accepted.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: clinic.email,
      subject: "Contract Accepted - Welcome to LifeLine!",
      text: `Hello ${clinic.clinicName}, your contract has been accepted. Welcome to LifeLine!`,
      html: htmlToSend
    }

    transporter.sendMail(msg)
  }
}
