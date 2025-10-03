import nodemailer from "nodemailer"
import fs from "fs"
import path from "path"
import Handlebars from "handlebars"
import "dotenv/config"
import { IAdmin } from "../../admin/admin.types"

const { FRONTEND_URL_ADMIN, EMAIL_USER, EMAIL_PASS } = process.env

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
  static loadTemplate(filePath: string, data: object): string {
    const source = fs.readFileSync(filePath, "utf8").toString()
    const template = Handlebars.compile(source)
    return template(data)
  }

  static async sendAdminResetPasswordEmail(
    admin: IAdmin,
    resetToken: string
  ): Promise<void> {
    const resetLink = `${FRONTEND_URL_ADMIN}/reset-password/new?token=${resetToken}`
    const data = { userName: admin.userName, resetLink }

    const filepath = path.join(
      __dirname,
      "../../views/admin/admin.reset.password.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: admin.email,
      subject: "Reset Your Password",
      text: `Hello ${admin.userName}, reset your password by clicking the following link: ${resetLink}`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }
}
