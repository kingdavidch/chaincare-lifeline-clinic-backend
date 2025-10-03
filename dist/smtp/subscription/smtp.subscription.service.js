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
class SubscriptionEmailService {
    static loadTemplate(filePath, data) {
        const source = fs_1.default.readFileSync(filePath, "utf8").toString();
        const template = handlebars_1.default.compile(source);
        return template(data);
    }
    /**
     * Send Subscription Confirmation Email
     */
    static sendSubscriptionConfirmationEmail(patient, plan) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const data = {
                fullName: patient.fullName,
                planName: plan.name,
                duration: plan.duration,
                startDate: new Date().toDateString(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + parseInt(plan.duration))).toDateString(),
                privilege: (_a = plan.privilege) !== null && _a !== void 0 ? _a : null,
                includedTests: plan.includedTests
            };
            const filePath = path_1.default.join(__dirname, "../../views/subscription/subscription.confirmation.html");
            const htmlToSend = this.loadTemplate(filePath, data);
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: patient.email,
                subject: "Subscription Confirmation - LifeLine",
                text: `Hello ${patient.fullName}, You have successfully subscribed to the ${plan.name} plan.`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
}
exports.default = SubscriptionEmailService;
