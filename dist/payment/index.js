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
exports.handleFailedPayment = handleFailedPayment;
exports.handlePublicPayment = handlePublicPayment;
exports.handlePatientPayment = handlePatientPayment;
/* eslint-disable @typescript-eslint/no-explicit-any */
const utils_1 = require("../admin/utils");
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const clinic_notification_model_1 = __importDefault(require("../clinic/clinic.notification.model"));
const order_model_1 = __importDefault(require("../order/order.model"));
const utils_2 = require("../order/utils");
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const patient_notification_model_1 = __importDefault(require("../patient/patient.notification.model"));
const smtp_order_service_1 = __importDefault(require("../smtp/order/smtp.order.service"));
const test_item_model_1 = __importDefault(require("../test/test.item.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
const testBooking_model_1 = __importDefault(require("../testBooking(Cart)/testBooking.model"));
const utils_3 = require("../utils");
const sendPushNotification_1 = require("../utils/sendPushNotification");
const pendingpublicorder_model_1 = require("../order/pendingpublicorder.model");
function handleFailedPayment(failureReason, metadata) {
    return __awaiter(this, void 0, void 0, function* () {
        const patientId = metadata.patientId;
        if (!patientId)
            return;
        yield patient_notification_model_1.default.create({
            patient: patientId,
            title: "Payment Failed",
            message: `Your payment could not be processed. Reason: ${failureReason}`,
            type: "payment",
            isRead: false
        });
        const patient = yield patient_model_1.default
            .findById(patientId)
            .select("fullName expoPushToken");
        if (patient === null || patient === void 0 ? void 0 : patient.expoPushToken) {
            yield (0, sendPushNotification_1.sendPushNotification)({
                expoPushToken: patient.expoPushToken,
                title: "Payment Failed",
                message: `Your payment could not be processed. Reason: ${failureReason}`,
                type: "payment"
            });
        }
        yield (0, utils_1.notifyAdmin)("PawaPay Payment Failed", `PawaPay payment failed for patient "${(patient === null || patient === void 0 ? void 0 : patient.fullName) || "Unknown"}". Reason: ${failureReason}`, "alert");
    });
}
function handlePublicPayment(data, meta) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const orderKey = meta.orderKey;
            if (!orderKey)
                throw new Error("orderKey missing in meta");
            const pendingOrder = yield pendingpublicorder_model_1.PendingPublicOrder.findOne({ orderKey });
            if (!pendingOrder)
                throw new Error("Pending order not found");
            const clinic = yield clinic_model_1.default.findOne({
                clinicId: Number(pendingOrder.clinicId)
            });
            if (!clinic)
                throw new Error("Clinic not found");
            const testDoc = yield test_model_1.default
                .findOne({
                clinic: clinic._id,
                testNo: pendingOrder.testNo,
                isDeleted: false
            })
                .select("testName price turnaroundTime description");
            if (!testDoc)
                throw new Error("Test not found");
            const allTestItem = yield test_item_model_1.default.find().select("name image");
            const matchedImg = allTestItem.find((img) => { var _a; return ((_a = img.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === testDoc.testName.toLowerCase(); });
            const testImage = (matchedImg === null || matchedImg === void 0 ? void 0 : matchedImg.image) || "";
            let finalAmount = testDoc.price;
            const appliedDiscount = pendingOrder.appliedDiscount || {};
            if (appliedDiscount === null || appliedDiscount === void 0 ? void 0 : appliedDiscount.percentage) {
                finalAmount -= (testDoc.price * appliedDiscount.percentage) / 100;
            }
            const orderId = (0, utils_3.generateOrderID)();
            const transactionId = data.depositId;
            const order = yield order_model_1.default.create({
                orderId,
                clinic: clinic._id,
                tests: [
                    {
                        test: testDoc._id,
                        testName: testDoc.testName,
                        testImage,
                        price: testDoc.price,
                        turnaroundTime: testDoc.turnaroundTime,
                        description: testDoc.description,
                        scheduledAt: pendingOrder.scheduledAt,
                        status: "pending",
                        statusHistory: [{ status: "pending", changedAt: new Date() }]
                    }
                ],
                deliveryMethod: pendingOrder.deliveryMethod,
                deliveryAddress: pendingOrder.deliveryAddress,
                totalAmount: finalAmount,
                paymentMethod: "pawa_pay",
                paymentStatus: "paid",
                isPublicBooking: true,
                publicBooker: {
                    fullName: pendingOrder.fullName,
                    email: pendingOrder.email,
                    phoneNumber: pendingOrder.phoneNumber
                },
                pawaPayInfo: { depositId: transactionId, status: "complete" },
                appliedDiscount,
                scheduledAt: pendingOrder.scheduledAt
            });
            const clinicEarning = Math.round(finalAmount * 0.96);
            yield clinic_model_1.default.findByIdAndUpdate(clinic._id, {
                $inc: { balance: clinicEarning }
            });
            const populatedOrder = yield order_model_1.default
                .findById(order._id)
                .populate("clinic");
            if (populatedOrder) {
                yield (0, utils_2.createCalendarEventsForOrder)({
                    _id: populatedOrder._id,
                    orderId: populatedOrder.orderId,
                    clinic: populatedOrder.clinic,
                    patient: {
                        fullName: pendingOrder.fullName,
                        email: pendingOrder.email,
                        phoneNumber: pendingOrder.phoneNumber
                    },
                    deliveryMethod: pendingOrder.deliveryMethod,
                    deliveryAddress: pendingOrder.deliveryAddress,
                    tests: populatedOrder.tests
                });
            }
            yield smtp_order_service_1.default.sendPublicOrderConfirmationEmail(populatedOrder);
            yield smtp_order_service_1.default.sendClinicPublicOrderNotificationEmail(populatedOrder);
            yield clinic_notification_model_1.default.create([
                {
                    clinic: clinic._id,
                    title: "New Order Received",
                    message: `New order #${orderId} from ${pendingOrder.fullName}`,
                    type: "order",
                    isRead: false
                },
                {
                    clinic: clinic._id,
                    title: "Payment Processed",
                    message: `Payment received for order #${orderId} (${finalAmount.toLocaleString()} RWF)`,
                    type: "wallet",
                    isRead: false
                }
            ]);
            yield (0, utils_1.notifyAdmin)("New Order Placed", `Patient "${pendingOrder.fullName}" placed a new order (${orderId})`, "order");
            yield pendingpublicorder_model_1.PendingPublicOrder.deleteOne({ _id: pendingOrder._id });
        }
        catch (err) {
            console.error("handlePublicPayment error:", err);
        }
    });
}
function handlePatientPayment(data, metadata) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const patientId = metadata.patientId;
        const deliveryMethod = (0, utils_2.deliveryMethodToNumber)(metadata.deliveryMethod);
        const transactionId = data.depositId;
        const patient = yield patient_model_1.default.findById(patientId);
        if (!patient)
            throw new Error("Patient not found");
        const cartItems = yield testBooking_model_1.default.find({
            patient: patientId,
            status: "pending"
        });
        if (!(cartItems === null || cartItems === void 0 ? void 0 : cartItems.length))
            throw new Error("No cart items found");
        const allTestItem = yield test_item_model_1.default.find().select("name image");
        const testIds = cartItems.map((item) => item.test);
        const testDocs = yield test_model_1.default
            .find({ _id: { $in: testIds } })
            .select("testName price turnaroundTime description");
        const testMap = new Map(testDocs.map((test) => [
            test._id.toString(),
            {
                testName: test.testName,
                price: test.price,
                turnaroundTime: test.turnaroundTime,
                description: test.description
            }
        ]));
        const groupedByClinic = {};
        for (const item of cartItems) {
            const clinicId = item.clinic.toString();
            const testData = testMap.get(item.test.toString());
            const testImage = ((_a = allTestItem.find((img) => img.name.toLowerCase() === (testData === null || testData === void 0 ? void 0 : testData.testName.toLowerCase()))) === null || _a === void 0 ? void 0 : _a.image) || "";
            const basePrice = (_b = testData === null || testData === void 0 ? void 0 : testData.price) !== null && _b !== void 0 ? _b : 0;
            const subtotal = basePrice;
            const finalPrice = ((_c = item.discount) === null || _c === void 0 ? void 0 : _c.finalPrice) && item.discount.finalPrice > 0
                ? item.discount.finalPrice
                : subtotal;
            const preparedTest = {
                test: item.test,
                testName: (_d = testData === null || testData === void 0 ? void 0 : testData.testName) !== null && _d !== void 0 ? _d : "Unknown Test",
                price: basePrice,
                turnaroundTime: (_e = testData === null || testData === void 0 ? void 0 : testData.turnaroundTime) !== null && _e !== void 0 ? _e : "N/A",
                description: (_f = testData === null || testData === void 0 ? void 0 : testData.description) !== null && _f !== void 0 ? _f : "N/A",
                testImage,
                date: item.date,
                time: item.time,
                scheduledAt: item.scheduledAt,
                status: "pending",
                statusHistory: [{ status: "pending", changedAt: new Date() }]
            };
            if (!groupedByClinic[clinicId]) {
                groupedByClinic[clinicId] = { tests: [], totalAmount: 0, cartItemIds: [] };
            }
            groupedByClinic[clinicId].tests.push(preparedTest);
            groupedByClinic[clinicId].totalAmount += finalPrice;
            groupedByClinic[clinicId].cartItemIds.push(item._id.toString());
        }
        const createdOrderIds = [];
        for (const [clinicId, group] of Object.entries(groupedByClinic)) {
            const orderId = (0, utils_3.generateOrderID)();
            const clinic = yield clinic_model_1.default.findById(clinicId);
            if (!clinic)
                continue;
            const finalDeliveryAddress = {
                fullName: patient.fullName,
                phoneNo: patient.phoneNumber,
                address: `${((_g = patient.location) === null || _g === void 0 ? void 0 : _g.street) || ""}, ${((_h = patient.location) === null || _h === void 0 ? void 0 : _h.cityOrDistrict) || ""}, ${((_j = patient.location) === null || _j === void 0 ? void 0 : _j.stateOrProvince) || ""}, ${((_k = patient.location) === null || _k === void 0 ? void 0 : _k.postalCode) || ""}, ${patient.country || ""}`
                    .replace(/^, |, ,/g, "")
                    .trim(),
                cityOrDistrict: ((_l = patient.location) === null || _l === void 0 ? void 0 : _l.cityOrDistrict) || ""
            };
            const order = yield order_model_1.default.create({
                patient: patientId,
                clinic: clinicId,
                orderId,
                tests: group.tests,
                paymentMethod: "pawa_pay",
                deliveryMethod,
                deliveryAddress: finalDeliveryAddress,
                totalAmount: group.totalAmount,
                paymentStatus: "paid",
                pawaPayInfo: { depositId: transactionId, status: "complete" }
            });
            yield testBooking_model_1.default.updateMany({ _id: { $in: group.cartItemIds } }, { status: "booked" });
            const clinicEarning = Math.round(group.totalAmount * 0.96);
            yield clinic_model_1.default.findByIdAndUpdate(clinicId, {
                $inc: { balance: clinicEarning }
            });
            const populatedOrder = yield order_model_1.default
                .findById(order._id)
                .populate("clinic")
                .populate("patient");
            if (populatedOrder) {
                yield (0, utils_2.createCalendarEventsForOrder)(populatedOrder);
            }
            yield smtp_order_service_1.default.sendOrderConfirmationEmail(populatedOrder);
            yield smtp_order_service_1.default.sendClinicOrderNotificationEmail(populatedOrder);
            yield patient_notification_model_1.default.create([
                {
                    patient: patientId,
                    title: "Order Confirmed",
                    message: `Your order #${orderId} has been received`,
                    type: "order",
                    isRead: false
                },
                {
                    patient: patientId,
                    title: "Payment Received",
                    message: `We've received your payment of ${group.totalAmount.toLocaleString()} RWF`,
                    type: "payment",
                    isRead: false
                }
            ]);
            if (patient.expoPushToken) {
                yield (0, sendPushNotification_1.sendPushNotification)({
                    expoPushToken: patient.expoPushToken,
                    title: "Payment Successful",
                    message: `Your payment for order #${orderId} was received`,
                    type: "payment"
                });
                yield (0, sendPushNotification_1.sendPushNotification)({
                    expoPushToken: patient.expoPushToken,
                    title: "Order Received",
                    message: `Your order #${orderId} has been received.`,
                    type: "order"
                });
            }
            yield clinic_notification_model_1.default.create([
                {
                    clinic: clinicId,
                    title: "New Order Received",
                    message: `New order #${orderId} from ${patient.fullName}`,
                    type: "order",
                    isRead: false
                },
                {
                    clinic: clinicId,
                    title: "Payment Processed",
                    message: `Payment received for order #${orderId} (${group.totalAmount.toLocaleString()} RWF)`,
                    type: "wallet",
                    isRead: false
                }
            ]);
            yield (0, utils_1.notifyAdmin)("New Order Placed", `Patient "${patient.fullName}" placed a new order (${orderId})`, "order");
            createdOrderIds.push(orderId);
        }
        return createdOrderIds;
    });
}
