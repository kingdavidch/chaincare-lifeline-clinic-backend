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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
require("dotenv/config");
const { BACKEND_URL, FRONTEND_URL, EMAIL_USER, EMAIL_PASS } = process.env;
const transporter = nodemailer_1.default.createTransport({
    host: "mail.privateemail.com",
    port: 465,
    secure: true,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});
class SmtpService {
    static loadTemplate(filePath, data) {
        const source = fs_1.default.readFileSync(filePath, "utf8").toString();
        const template = handlebars_1.default.compile(source);
        return template(data);
    }
    // Send Verification Email
    static sendClinicVerificationEmail(clinic) {
        return __awaiter(this, void 0, void 0, function* () {
            const verificationLink = `${BACKEND_URL}/api/v1/clinic/verify?key=${clinic.clinicId}`;
            const data = { clinicName: clinic.clinicName, verificationLink };
            const filepath = path_1.default.join(__dirname, "../../views/clinic/clinic.verification.html");
            const htmlToSend = this.loadTemplate(filepath, data);
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
                priority: "high",
                date: new Date()
            };
            yield transporter.sendMail(msg);
        });
    }
    // Send Password Reset Email
    static sendClinicResetPasswordEmail(clinic, resetToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const resetLink = `${FRONTEND_URL}/reset-password/new?token=${resetToken}`;
            const data = { clinicName: clinic.clinicName, resetLink };
            const filepath = path_1.default.join(__dirname, "../../views/clinic/clinic.reset.password.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: clinic.email,
                subject: "Reset Your Password",
                text: `Hello ${clinic.clinicName}, reset your password by clicking the following link: ${resetLink}`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    // Send Certificate Status Email
    static sendCertificateStatusEmail(clinic, status, rejectionReason) {
        return __awaiter(this, void 0, void 0, function* () {
            const actionLink = status === "approved"
                ? `${FRONTEND_URL}/login`
                : "mailto:Contact@lifelinrafrica.app";
            const data = {
                clinicName: clinic.clinicName,
                status,
                approved: status === "approved",
                actionLink,
                rejectionReason
            };
            const filepath = path_1.default.join(__dirname, "../../views/clinic/clinic.certificate.status.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const subject = status === "approved"
                ? "Your Clinic Certificate Has Been Approved"
                : "Your Clinic Certificate Has Been Rejected";
            const textContent = status === "approved"
                ? `Hello ${clinic.clinicName}, your clinic certificate has been approved. You can now log in to LifeLine: ${actionLink}`
                : `Hello ${clinic.clinicName}, your clinic certificate has been rejected. Reason: ${rejectionReason}. Please contact support for assistance: ${actionLink}`;
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: clinic.email,
                subject,
                text: textContent,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    // Send Status Email
    static sendStatusUpdateEmail(clinic, status, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            const isApproved = status === "approved";
            const actionLink = isApproved
                ? `${FRONTEND_URL}/login`
                : "mailto:Contact@lifelinrafrica.app";
            const data = {
                clinicName: clinic.clinicName,
                status,
                approved: isApproved,
                actionLink,
                rejectionReason: reason
            };
            const filepath = path_1.default.join(__dirname, "../../views/clinic/clinic.status.update.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const subjectMap = {
                approved: "Your Clinic Registration Has Been Approved",
                rejected: "Your Clinic Registration Has Been Rejected",
                suspended: "Your Clinic Has Been Suspended"
            };
            const textContentMap = {
                approved: `Hello ${clinic.clinicName}, your clinic registration has been approved. You can now log in to LifeLine: ${actionLink}`,
                rejected: `Hello ${clinic.clinicName}, your clinic registration has been rejected. Reason: ${reason}. Please contact support: ${actionLink}`,
                suspended: `Hello ${clinic.clinicName}, your clinic has been suspended. Reason: ${reason}. Please contact support: ${actionLink}`
            };
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: clinic.email,
                subject: subjectMap[status],
                text: textContentMap[status],
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    // Send Contract Acceptance Email to Clinic
    static sendContractAcceptanceEmail(clinic) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = { clinicName: clinic.clinicName };
            const filepath = path_1.default.join(__dirname, "../../views/clinic/clinic.contract.accepted.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: clinic.email,
                subject: "Contract Accepted - Welcome to LifeLine!",
                text: `Hello ${clinic.clinicName}, your contract has been accepted. Welcome to LifeLine!`,
                html: htmlToSend
            };
            transporter.sendMail(msg);
        });
    }
}
SmtpService.FRONTEND_URL = process.env.FRONTEND_URL;
SmtpService.BACKEND_URL = process.env.BACKEND_URL;
exports.default = SmtpService;
