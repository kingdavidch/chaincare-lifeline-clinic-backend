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

export default class ClaimEmailService {
  private static loadTemplate(filePath: string, data: object): string {
    const source = fs.readFileSync(filePath, "utf8").toString()
    const template = Handlebars.compile(source)
    return template(data)
  }

  /**
   * Send Claim Notification Email to the Patient
   */
  static async sendClaimNotificationEmail(
    patient: IPatient,
    claimDetails: {
      claimNo: number
      testName: string
      clinicName: string
      clinicAddress: string
      clinicPhone: string
      claimDate: string
      price: number
      turnaroundTime: string
      homeCollection: string
      preTestRequirements: string
      totalSpent: number
      remainingBalance: number
      nextClaimDate: string
    }
  ): Promise<void> {
    const data = {
      patientFullName: patient.fullName,
      ...claimDetails
    }

    const filepath = path.join(
      __dirname,
      "../../views/claim/claim-notification.html"
    )
    const htmlToSend = this.loadTemplate(filepath, data)

    const msg = {
      from: `LifeLine <${EMAIL_USER}>`,
      to: patient.email,
      subject: "Claim Submitted on Your Behalf - LifeLine",
      text: `Hello ${patient.fullName},



A claim has been made on your behalf at ${claimDetails.clinicName} for the test: ${claimDetails.testName}.

Claim Details:
- Claim Number: #${claimDetails.claimNo}
- Test: ${claimDetails.testName}
- Cost: $${claimDetails.price}
- Clinic: ${claimDetails.clinicName}
- Address: ${claimDetails.clinicAddress}
- Phone: ${claimDetails.clinicPhone}
- Date: ${claimDetails.claimDate}
- Turnaround Time: ${claimDetails.turnaroundTime}
- Home Collection: ${claimDetails?.homeCollection}
- Pre-test Requirements: ${claimDetails.preTestRequirements}

Subscription Balance:
- Total Used This Period: $${claimDetails.totalSpent}
- Remaining Balance: $${claimDetails.remainingBalance}
- Next Claim Eligible: ${claimDetails.nextClaimDate}

If you have any concerns, please contact the clinic or LifeLine support.

Best Regards,  
LifeLine Team`,
      html: htmlToSend
    }

    await transporter.sendMail(msg)
  }
}
