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
const { FRONTEND_URL_ADMIN, EMAIL_USER, EMAIL_PASS } = process.env;
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
    static sendAdminResetPasswordEmail(admin, resetToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const resetLink = `${FRONTEND_URL_ADMIN}/reset-password/new?token=${resetToken}`;
            const data = { userName: admin.userName, resetLink };
            const filepath = path_1.default.join(__dirname, "../../views/admin/admin.reset.password.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: admin.email,
                subject: "Reset Your Password",
                text: `Hello ${admin.userName}, reset your password by clicking the following link: ${resetLink}`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
}
exports.default = SmtpService;
