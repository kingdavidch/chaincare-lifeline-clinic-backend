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
class TestResultEmailService {
    static loadTemplate(filePath, data) {
        const source = fs_1.default.readFileSync(filePath, "utf8").toString();
        const template = handlebars_1.default.compile(source);
        return template(data);
    }
    /**
     * Send Test Result Notification Email to the Patient
     */
    static sendTestResultEmail(patient, testDetails) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = Object.assign({ patientFullName: patient.fullName }, testDetails);
            const filepath = path_1.default.join(__dirname, "../../views/testResult/test-result-notification.html");
            const htmlToSend = this.loadTemplate(filepath, data);
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
            };
            yield transporter.sendMail(msg);
        });
    }
}
exports.default = TestResultEmailService;
