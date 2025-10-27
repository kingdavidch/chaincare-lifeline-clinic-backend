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
/* eslint-disable @typescript-eslint/no-explicit-any */
const nodemailer_1 = __importDefault(require("nodemailer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
require("dotenv/config");
const utils_1 = require("../../order/utils");
const utils_2 = require("../../utils");
const { EMAIL_USER, EMAIL_PASS } = process.env;
const transporter = nodemailer_1.default.createTransport({
    host: "mail.privateemail.com",
    port: 465,
    secure: true,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});
class OrderSmtpService {
    static loadTemplate(filePath, data) {
        const source = fs_1.default.readFileSync(filePath, "utf8").toString();
        const template = handlebars_1.default.compile(source);
        return template(data);
    }
    /**
     * Send Order Confirmation Email to Patient
     */
    static sendOrderConfirmationEmail(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            const patient = order.patient;
            const clinic = order.clinic;
            const testRows = order.tests
                .map((test) => {
                var _a, _b, _c;
                const testName = (0, utils_2.formatCase)(test === null || test === void 0 ? void 0 : test.testName);
                const price = (test === null || test === void 0 ? void 0 : test.price) ? test.price.toFixed(2) : "0.00";
                const turnaroundTime = (_a = test === null || test === void 0 ? void 0 : test.turnaroundTime) !== null && _a !== void 0 ? _a : "N/A";
                const description = (_b = test === null || test === void 0 ? void 0 : test.description) !== null && _b !== void 0 ? _b : "N/A";
                const currencySymbol = (_c = clinic === null || clinic === void 0 ? void 0 : clinic.currencySymbol) !== null && _c !== void 0 ? _c : "N/A";
                return `
        <tr>
          <td data-label="Appointment Name">${testName}</td>
          <td data-label="Price">${price} ${currencySymbol}</td>
          <td data-label="Turnaround Time">${turnaroundTime}</td>
          <td data-label="Description">${description}</td>
        </tr>
        `;
            })
                .join("");
            const filepath = path_1.default.join(__dirname, "../../views/order/order.confirmation.html");
            const isSelfPick = (0, utils_1.mapDeliveryMethod)(order === null || order === void 0 ? void 0 : order.deliveryMethod) === "in-person";
            const clinicAddress = ((_a = clinic === null || clinic === void 0 ? void 0 : clinic.location) === null || _a === void 0 ? void 0 : _a.street) || ((_b = clinic === null || clinic === void 0 ? void 0 : clinic.location) === null || _b === void 0 ? void 0 : _b.cityOrDistrict) || null;
            const clinicMapUrl = ((_d = (_c = clinic === null || clinic === void 0 ? void 0 : clinic.location) === null || _c === void 0 ? void 0 : _c.coordinates) === null || _d === void 0 ? void 0 : _d.latitude) &&
                ((_f = (_e = clinic === null || clinic === void 0 ? void 0 : clinic.location) === null || _e === void 0 ? void 0 : _e.coordinates) === null || _f === void 0 ? void 0 : _f.longitude)
                ? `https://maps.google.com/?q=${clinic.location.coordinates.latitude},${clinic.location.coordinates.longitude}`
                : clinicAddress
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicAddress)}`
                    : null;
            const htmlToSend = this.loadTemplate(filepath, {
                patientName: patient === null || patient === void 0 ? void 0 : patient.fullName,
                orderId: order === null || order === void 0 ? void 0 : order.orderId,
                clinicName: clinic === null || clinic === void 0 ? void 0 : clinic.clinicName,
                deliveryAddress: order.deliveryAddress.address,
                paymentMethod: order === null || order === void 0 ? void 0 : order.paymentMethod,
                totalAmount: (order === null || order === void 0 ? void 0 : order.totalAmount) ? order.totalAmount.toFixed(2) : "0.00",
                deliveryMethod: (0, utils_1.mapDeliveryMethod)(order === null || order === void 0 ? void 0 : order.deliveryMethod),
                testRows,
                isSelfPick,
                clinicAddress: clinicAddress || null,
                clinicMapUrl
            });
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: (_g = patient === null || patient === void 0 ? void 0 : patient.email) !== null && _g !== void 0 ? _g : "",
                subject: "Order Confirmation - LifeLine",
                text: `Your order has been placed successfully.`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    /**
     * Send Order Notification Email to Clinic
     */
    static sendClinicOrderNotificationEmail(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const clinic = order.clinic;
            const patient = order.patient;
            const testRows = order.tests
                .map((test) => {
                var _a, _b, _c;
                const testName = (0, utils_2.formatCase)(test === null || test === void 0 ? void 0 : test.testName);
                const price = (test === null || test === void 0 ? void 0 : test.price) ? test.price.toFixed(2) : "0.00";
                const turnaroundTime = (_a = test === null || test === void 0 ? void 0 : test.turnaroundTime) !== null && _a !== void 0 ? _a : "N/A";
                const description = (_b = test === null || test === void 0 ? void 0 : test.description) !== null && _b !== void 0 ? _b : "N/A";
                const currencySymbol = (_c = clinic === null || clinic === void 0 ? void 0 : clinic.currencySymbol) !== null && _c !== void 0 ? _c : "RWF";
                return `
        <tr>
          <td data-label="Appointment Name">${testName}</td>
          <td data-label="Price">${price} ${currencySymbol}</td>
          <td data-label="Turnaround Time">${turnaroundTime}</td>
          <td data-label="Description">${description}</td>
        </tr>
      `;
            })
                .join("");
            const filepath = path_1.default.join(__dirname, "../../views/order/order.clinic.confirmation.html");
            const htmlToSend = this.loadTemplate(filepath, {
                patientName: (_a = patient === null || patient === void 0 ? void 0 : patient.fullName) !== null && _a !== void 0 ? _a : "N/A",
                patientPhone: (_b = patient === null || patient === void 0 ? void 0 : patient.phoneNumber) !== null && _b !== void 0 ? _b : "N/A",
                orderId: order === null || order === void 0 ? void 0 : order.orderId,
                deliveryAddress: order.deliveryAddress.address,
                paymentMethod: (_c = order === null || order === void 0 ? void 0 : order.paymentMethod) !== null && _c !== void 0 ? _c : "N/A",
                totalAmount: (order === null || order === void 0 ? void 0 : order.totalAmount) ? order.totalAmount.toFixed(2) : "0.00",
                deliveryMethod: (0, utils_1.mapDeliveryMethod)(order === null || order === void 0 ? void 0 : order.deliveryMethod),
                testRows
            });
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: clinic === null || clinic === void 0 ? void 0 : clinic.email,
                subject: `New Order Received - #${order === null || order === void 0 ? void 0 : order.orderId}`,
                text: `A new order has been placed by ${patient === null || patient === void 0 ? void 0 : patient.fullName}.`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    /**
     * Send Order Confirmation Email to Public Booker
     */
    static sendPublicOrderConfirmationEmail(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const publicBooker = order.publicBooker;
            const clinic = order.clinic;
            if (!(publicBooker === null || publicBooker === void 0 ? void 0 : publicBooker.email)) {
                console.warn("No email defined for public booker, skipping email.");
                return;
            }
            const testRows = order.tests
                .map((test) => {
                var _a, _b, _c, _d;
                const testName = (0, utils_2.formatCase)(test === null || test === void 0 ? void 0 : test.testName);
                const price = ((_a = test === null || test === void 0 ? void 0 : test.price) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "0.00";
                const turnaroundTime = (_b = test === null || test === void 0 ? void 0 : test.turnaroundTime) !== null && _b !== void 0 ? _b : "N/A";
                const description = (_c = test === null || test === void 0 ? void 0 : test.description) !== null && _c !== void 0 ? _c : "N/A";
                const currencySymbol = (_d = clinic === null || clinic === void 0 ? void 0 : clinic.currencySymbol) !== null && _d !== void 0 ? _d : "N/A";
                return `
          <tr>
            <td data-label="Appointment Name">${testName}</td>
            <td data-label="Price">${price} ${currencySymbol}</td>
            <td data-label="Turnaround Time">${turnaroundTime}</td>
            <td data-label="Description">${description}</td>
          </tr>
        `;
            })
                .join("");
            const filepath = path_1.default.join(__dirname, "../../views/order/order.confirmation.html");
            const isSelfPick = (0, utils_1.mapDeliveryMethod)(order === null || order === void 0 ? void 0 : order.deliveryMethod) === "in-person";
            const clinicAddress = ((_a = clinic === null || clinic === void 0 ? void 0 : clinic.location) === null || _a === void 0 ? void 0 : _a.street) || ((_b = clinic === null || clinic === void 0 ? void 0 : clinic.location) === null || _b === void 0 ? void 0 : _b.cityOrDistrict) || null;
            const clinicMapUrl = ((_d = (_c = clinic === null || clinic === void 0 ? void 0 : clinic.location) === null || _c === void 0 ? void 0 : _c.coordinates) === null || _d === void 0 ? void 0 : _d.latitude) &&
                ((_f = (_e = clinic === null || clinic === void 0 ? void 0 : clinic.location) === null || _e === void 0 ? void 0 : _e.coordinates) === null || _f === void 0 ? void 0 : _f.longitude)
                ? `https://maps.google.com/?q=${clinic.location.coordinates.latitude},${clinic.location.coordinates.longitude}`
                : clinicAddress
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicAddress)}`
                    : null;
            const htmlToSend = this.loadTemplate(filepath, {
                patientName: (_g = publicBooker.fullName) !== null && _g !== void 0 ? _g : "Anonymous",
                orderId: order === null || order === void 0 ? void 0 : order.orderId,
                clinicName: clinic === null || clinic === void 0 ? void 0 : clinic.clinicName,
                deliveryAddress: order.deliveryAddress.address,
                paymentMethod: (_h = order === null || order === void 0 ? void 0 : order.paymentMethod) !== null && _h !== void 0 ? _h : "N/A",
                totalAmount: ((_j = order === null || order === void 0 ? void 0 : order.totalAmount) === null || _j === void 0 ? void 0 : _j.toFixed(2)) || "0.00",
                deliveryMethod: (0, utils_1.mapDeliveryMethod)(order === null || order === void 0 ? void 0 : order.deliveryMethod),
                testRows,
                isSelfPick,
                clinicAddress: clinicAddress || null,
                clinicMapUrl
            });
            const msg = {
                from: `LifeLine <${process.env.EMAIL_USER}>`,
                to: publicBooker.email,
                subject: "Order Confirmation - LifeLine",
                text: `Your order has been placed successfully.`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    /**
     * Send Order Notification Email to Clinic for Public Booking
     */
    static sendClinicPublicOrderNotificationEmail(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const clinic = order.clinic;
            const publicBooker = order.publicBooker;
            if (!(clinic === null || clinic === void 0 ? void 0 : clinic.email)) {
                console.warn("No clinic email defined, skipping email.");
                return;
            }
            const testRows = order.tests
                .map((test) => {
                var _a, _b, _c, _d;
                const testName = (0, utils_2.formatCase)(test === null || test === void 0 ? void 0 : test.testName);
                const price = ((_a = test === null || test === void 0 ? void 0 : test.price) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "0.00";
                const turnaroundTime = (_b = test === null || test === void 0 ? void 0 : test.turnaroundTime) !== null && _b !== void 0 ? _b : "N/A";
                const description = (_c = test === null || test === void 0 ? void 0 : test.description) !== null && _c !== void 0 ? _c : "N/A";
                const currencySymbol = (_d = clinic === null || clinic === void 0 ? void 0 : clinic.currencySymbol) !== null && _d !== void 0 ? _d : "RWF";
                return `
          <tr>
            <td data-label="Appointment Name">${testName}</td>
            <td data-label="Price">${price} ${currencySymbol}</td>
            <td data-label="Turnaround Time">${turnaroundTime}</td>
            <td data-label="Description">${description}</td>
          </tr>
        `;
            })
                .join("");
            const filepath = path_1.default.join(__dirname, "../../views/order/order.clinic.confirmation.html");
            const htmlToSend = this.loadTemplate(filepath, {
                patientName: (_a = publicBooker === null || publicBooker === void 0 ? void 0 : publicBooker.fullName) !== null && _a !== void 0 ? _a : "Anonymous",
                patientPhone: (_b = publicBooker === null || publicBooker === void 0 ? void 0 : publicBooker.phoneNumber) !== null && _b !== void 0 ? _b : "N/A",
                orderId: order === null || order === void 0 ? void 0 : order.orderId,
                deliveryAddress: order.deliveryAddress.address,
                paymentMethod: (_c = order === null || order === void 0 ? void 0 : order.paymentMethod) !== null && _c !== void 0 ? _c : "N/A",
                totalAmount: ((_d = order === null || order === void 0 ? void 0 : order.totalAmount) === null || _d === void 0 ? void 0 : _d.toFixed(2)) || "0.00",
                deliveryMethod: (0, utils_1.mapDeliveryMethod)(order === null || order === void 0 ? void 0 : order.deliveryMethod),
                testRows
            });
            const msg = {
                from: `LifeLine <${process.env.EMAIL_USER}>`,
                to: clinic.email,
                subject: `New Public Order Received - #${order === null || order === void 0 ? void 0 : order.orderId}`,
                text: `A new public order has been placed by ${(_e = publicBooker === null || publicBooker === void 0 ? void 0 : publicBooker.fullName) !== null && _e !== void 0 ? _e : "Anonymous"}.`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    /**
     * Send Order Status Update Email to Patient
     */
    static sendOrderStatusUpdateEmail(order, testItem, clinic, patient) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const isPublic = order.isPublicBooking || !!order.publicBooker;
            const receiver = isPublic ? order.publicBooker : patient;
            const receiverName = (_a = receiver === null || receiver === void 0 ? void 0 : receiver.fullName) !== null && _a !== void 0 ? _a : "Customer";
            const receiverEmail = (_b = receiver === null || receiver === void 0 ? void 0 : receiver.email) !== null && _b !== void 0 ? _b : "";
            let googleMapLink = "";
            let clinicAddress = "";
            const coords = (_c = clinic.location) === null || _c === void 0 ? void 0 : _c.coordinates;
            if ((coords === null || coords === void 0 ? void 0 : coords.latitude) && (coords === null || coords === void 0 ? void 0 : coords.longitude)) {
                googleMapLink = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
            }
            else {
                const { street = "", cityOrDistrict = "", stateOrProvince = "", postalCode = "" } = clinic.location || {};
                const fullAddress = [street, cityOrDistrict, stateOrProvince, postalCode]
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .join(", ");
                if (fullAddress) {
                    clinicAddress = fullAddress;
                    googleMapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
                }
            }
            const statusReasonText = ["rejected", "cancelled", "failed"].includes(testItem.status) &&
                testItem.statusReason
                ? testItem.statusReason
                : "";
            // 📧 Email template data
            const data = {
                patientName: receiverName,
                orderId: order.orderId,
                status: testItem.status,
                clinicName: clinic.clinicName,
                testImage: testItem.testImage,
                testName: (0, utils_2.formatCase)(testItem.testName),
                testPrice: testItem.price.toFixed(2),
                currencySymbol: clinic.currencySymbol,
                trackingLink: googleMapLink || null,
                clinicAddress: clinicAddress || null,
                statusReasonText
            };
            const filepath = path_1.default.join(__dirname, "../../views/order/order.status.update.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: receiverEmail,
                subject: `Your Order #${order.orderId} Status Update - LifeLine`,
                text: `Hello ${receiverName}, the status of your order has been updated to "${testItem.status}".`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    /**
     * Send Payment Method Update Email to Patient
     */
    static sendPaymentMethodUpdateEmail(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const patient = order.patient;
            const data = {
                patientName: (_a = patient === null || patient === void 0 ? void 0 : patient.fullName) !== null && _a !== void 0 ? _a : "N/A",
                orderId: order === null || order === void 0 ? void 0 : order.orderId,
                paymentMethod: (_b = order === null || order === void 0 ? void 0 : order.paymentMethod) !== null && _b !== void 0 ? _b : "N/A"
            };
            const filepath = path_1.default.join(__dirname, "../../views/order/order.payment.update.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: (_c = patient === null || patient === void 0 ? void 0 : patient.email) !== null && _c !== void 0 ? _c : "",
                subject: "Payment Method Updated - LifeLine",
                text: `Your payment method has been updated.`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
    /**
     * Send Delivery Address Update Email to Patient
     */
    static sendDeliveryAddressUpdateEmail(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const patient = order.patient;
            const data = {
                patientName: patient === null || patient === void 0 ? void 0 : patient.fullName,
                orderId: order === null || order === void 0 ? void 0 : order.orderId,
                deliveryMethod: (0, utils_1.mapDeliveryMethod)(order === null || order === void 0 ? void 0 : order.deliveryMethod)
            };
            const filepath = path_1.default.join(__dirname, "../../views/order/order.delivery.update.html");
            const htmlToSend = this.loadTemplate(filepath, data);
            const msg = {
                from: `LifeLine <${EMAIL_USER}>`,
                to: (_a = patient === null || patient === void 0 ? void 0 : patient.email) !== null && _a !== void 0 ? _a : "",
                subject: "Delivery Address Updated - LifeLine",
                text: `Your delivery address has been updated.`,
                html: htmlToSend
            };
            yield transporter.sendMail(msg);
        });
    }
}
exports.default = OrderSmtpService;
