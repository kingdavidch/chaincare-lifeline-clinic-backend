"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const handlebars_1 = __importDefault(require("handlebars"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
require("dotenv/config");
const { EMAIL_PASS, EMAIL_USER } = process.env;
const transporter = nodemailer_1.default.createTransport({
    host: "mail.privateemail.com",
    port: 465,
    secure: true,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});
class ClaimEmailService {
    static loadTemplate(filePath, data) {
        const source = fs_1.default.readFileSync(filePath, "utf8").toString();
        const template = handlebars_1.default.compile(source);
        return template(data);
    }
    /**
     * Send Claim Notification Email to the Patient
     */
    static sendClaimNotificationEmail(patient, claimDetails) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = Object.assign({ patientFullName: patient.fullName }, claimDetails);
            const filepath = path_1.default.join(__dirname, "../../views/claim/claim-notification.html");
            const htmlToSend = this.loadTemplate(filepath, data);
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
- Home Collection: ${claimDetails === null || claimDetails === void 0 ? void 0 : claimDetails.homeCollection}
- Pre-test Requirements: ${claimDetails.preTestRequirements}

Subscription Balance:
- Total Used This Period: $${claimDetails.totalSpent}
- Remaining Balance: $${claimDetails.remainingBalance}
- Next Claim Eligible: ${claimDetails.nextClaimDate}

If you have any concerns, please contact the clinic or LifeLine support.

Best Regards,  
LifeLine Team`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
}
exports.default = ClaimEmailService;
