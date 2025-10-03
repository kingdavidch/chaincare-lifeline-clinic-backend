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
class PatientEmailService {
    static loadTemplate(filePath, data) {
        const source = fs_1.default.readFileSync(filePath, "utf8").toString();
        const template = handlebars_1.default.compile(source);
        return template(data);
    }
    /**
     * Send OTP Email for Patient Account Verification
     */
    static sendVerificationEmail(patient) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = {
                fullName: patient.fullName,
                otp: patient.emailOtp
            };
            const filepath = path_1.default.join(__dirname, "../../views/patient/patient.verification.html");
            const htmlToSend = this.loadTemplate(filepath, data);
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
                priority: "high",
                date: new Date()
            };
            yield transporter.sendMail(msg);
        });
    }
    /**
     * Send OTP Email for Password Reset
     */
    static sendPasswordResetOtp(patient) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = {
                fullName: patient.fullName,
                otp: patient.emailOtp
            };
            const filepath = path_1.default.join(__dirname, "../../views/patient/patient.reset.password.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: patient.email,
                subject: "Password Reset Request - LifeLine",
                text: `Hello ${patient.fullName},\n\nYour OTP for resetting your password is: ${patient.emailOtp}\n\nIf you didn’t request this, please ignore this email.`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    /**
     * Send Welcome Email after Signup
     */
    static sendWelcomeEmail(patient) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = {
                fullName: patient.fullName
            };
            const filepath = path_1.default.join(__dirname, "../../views/patient/patient.welcome.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: patient.email,
                subject: "Welcome to LifeLine 🎉",
                text: `Hello ${patient.fullName}, welcome to LifeLine! We’re excited to have you on board.`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
}
exports.default = PatientEmailService;
