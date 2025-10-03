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

export default class TestResultEmailService {
  private static loadTemplate(filePath: string, data: object): string {
    const source = fs.readFileSync(filePath, "utf8").toString()
    const template = Handlebars.compile(source)
    return template(data)
  }

  /**
   * Send Test Result Notification Email to the Patient
   */
  static async sendTestResultEmail(
    patient: IPatient,
    testDetails: {
      refNo: string
      testName: string
      clinicName: string
      testDate: string
      resultDate: string
      resultUrl: string
    }
  ): Promise<void> {
    const data = {
      patientFullName: patient.fullName,
      ...testDetails
    }

    const filepath = path.join(
      __dirname,
      "../../views/testResult/test-result-notification.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient.email,
      subject: `Your Test Result is Ready - ${testDetails.testName}`,
      text: `Hello ${patient.fullName},

Your test result for ${testDetails.testName} at ${testDetails.clinicName} is now available.

Test Details:
- Reference Number: ${testDetails.refNo}
- Test: ${testDetails.testName}
- Clinic: ${testDetails.clinicName}
- Test Date: ${testDetails.testDate}

You can view and download your test result using the link below:
${testDetails.resultUrl}

If you have any questions, please contact the clinic.

Best Regards,  
LifeLine Team`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }
}
