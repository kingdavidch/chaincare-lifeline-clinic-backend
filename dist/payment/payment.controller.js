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
const axios_1 = __importDefault(require("axios"));
require("dotenv/config");
const http_status_1 = __importDefault(require("http-status"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const clinic_notification_model_1 = __importDefault(require("../clinic/clinic.notification.model"));
const order_model_1 = __importDefault(require("../order/order.model"));
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const patient_notification_model_1 = __importDefault(require("../patient/patient.notification.model"));
const smtp_order_service_1 = __importDefault(require("../smtp/order/smtp.order.service"));
const test_item_model_1 = __importDefault(require("../test/test.item.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
const testBooking_model_1 = __importDefault(require("../testBooking(Cart)/testBooking.model"));
const utils_1 = require("../utils");
const sendPushNotification_1 = require("../utils/sendPushNotification");
const payment_service_1 = require("./payment.service");
const withdrawal_model_1 = __importDefault(require("./withdrawal.model"));
const utils_2 = require("../order/utils");
const utils_3 = require("../admin/utils");
const _1 = require(".");
class PaymentController {
    static getChannels(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const country = req.query.country || "RW";
                const paymentService = new payment_service_1.YellowCardService();
                const channels = yield paymentService.getPaymentChannels(country);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Available payment channels",
                    data: channels
                });
            }
            catch (error) {
                console.error("🔴 Controller Error:", error);
                next(error);
            }
        });
    }
    static submitDepositRequest(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = req.body;
                const ycService = new payment_service_1.YellowCardService();
                const submitted = yield ycService.submitCollectionRequest(Object.assign(Object.assign({}, data), { currency: "USD", sequenceId: `txn_${Date.now()}`, source: {
                        accountType: "bank",
                        accountNumber: "1111111111"
                    } }));
                const accepted = yield ycService.acceptCollectionRequest(submitted.id);
                const bankInfo = accepted.bankInfo;
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Deposit request submitted. Transfer to the account below.",
                    data: {
                        collectionId: accepted.id,
                        amount: accepted.amount,
                        currency: accepted.currency,
                        expiresAt: accepted.expiresAt,
                        bankAccount: {
                            bankName: bankInfo.name,
                            accountNumber: bankInfo.accountNumber,
                            accountName: bankInfo.accountName
                        }
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getPaymentDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const ycService = new payment_service_1.YellowCardService();
                const payment = yield ycService.getCollectionDetails(id);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Payment details retrieved",
                    data: payment
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static handleYellowCardWebhook(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            try {
                const data = req.body;
                const transactionId = data === null || data === void 0 ? void 0 : data.id;
                const status = (_a = data === null || data === void 0 ? void 0 : data.status) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                if (!transactionId || !status) {
                    res.status(http_status_1.default.BAD_REQUEST).send("Missing data.");
                    return;
                }
                const ycService = new payment_service_1.YellowCardService();
                const payment = yield ycService.getCollectionDetails(transactionId);
                const failureReason = (payment === null || payment === void 0 ? void 0 : payment.failureReason) || (payment === null || payment === void 0 ? void 0 : payment.failureMessage) || "Unknown reason";
                // Handle failed/rejected/cancelled payments
                if (["failed", "rejected", "cancelled"].includes(status)) {
                    const order = yield order_model_1.default.findOne({
                        "yellowCardInfo.ycTransactionId": transactionId
                    });
                    if (order) {
                        order.paymentStatus = "failed";
                        order.yellowCardInfo = Object.assign(Object.assign({}, order.yellowCardInfo), { status, rejectionReason: failureReason });
                        yield order.save();
                        yield patient_notification_model_1.default.create({
                            patient: order.patient,
                            title: "Payment Failed",
                            message: `Your payment for order #${order.orderId} failed. Reason: ${failureReason}`,
                            type: "payment",
                            isRead: false
                        });
                        yield (0, utils_3.notifyAdmin)("Payment Failed", `Order #${order.orderId} (YellowCard) failed: ${failureReason}`, "payment");
                    }
                    res.status(http_status_1.default.OK).send(`Failure processed: ${failureReason}`);
                    return;
                }
                // Accept pending_approval
                if (status === "pending_approval") {
                    try {
                        if (((_b = payment.status) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === "pending_approval") {
                            yield ycService.acceptCollectionRequest(transactionId);
                            console.log("✅ Accepted pending deposit:", transactionId);
                        }
                        else {
                            console.log("⏭️ Skipped accept — already processed:", payment.status);
                        }
                    }
                    catch (err) {
                        console.error("❌ Failed to accept YC deposit:", err);
                    }
                    res.status(http_status_1.default.OK).send("Handled pending approval.");
                    return;
                }
                // Ignore non-complete statuses
                if (status !== "complete") {
                    res.status(http_status_1.default.OK).send("Status not handled.");
                    return;
                }
                // SUCCESS FLOW (unchanged except for payment already fetched above)
                const sequenceParts = payment.sequenceId.split("_");
                const patientId = sequenceParts[2];
                const deliveryMethod = (0, utils_2.deliveryMethodToNumber)(sequenceParts[3]);
                const patient = yield patient_model_1.default.findById(patientId);
                if (!patient) {
                    res.status(http_status_1.default.NOT_FOUND).send("Patient not found.");
                    return;
                }
                const cartItems = yield testBooking_model_1.default.find({
                    patient: patientId,
                    status: "pending"
                });
                if (!(cartItems === null || cartItems === void 0 ? void 0 : cartItems.length)) {
                    res.status(http_status_1.default.NOT_FOUND).send("No cart found.");
                    return;
                }
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
                    const testImage = ((_c = allTestItem.find((img) => img.name.toLowerCase() === (testData === null || testData === void 0 ? void 0 : testData.testName.toLowerCase()))) === null || _c === void 0 ? void 0 : _c.image) || "";
                    const subtotal = (_d = testData === null || testData === void 0 ? void 0 : testData.price) !== null && _d !== void 0 ? _d : 0;
                    const finalPrice = ((_e = item.discount) === null || _e === void 0 ? void 0 : _e.finalPrice) && item.discount.finalPrice > 0
                        ? item.discount.finalPrice
                        : subtotal;
                    const preparedTest = {
                        test: item.test,
                        testName: (_f = testData === null || testData === void 0 ? void 0 : testData.testName) !== null && _f !== void 0 ? _f : "Unknown Test",
                        price: subtotal,
                        turnaroundTime: (_g = testData === null || testData === void 0 ? void 0 : testData.turnaroundTime) !== null && _g !== void 0 ? _g : "N/A",
                        description: (_h = testData === null || testData === void 0 ? void 0 : testData.description) !== null && _h !== void 0 ? _h : "N/A",
                        testImage,
                        date: item.date,
                        time: item.time,
                        scheduledAt: item.scheduledAt,
                        status: "pending",
                        statusHistory: [{ status: "pending", changedAt: new Date() }]
                    };
                    if (!groupedByClinic[clinicId]) {
                        groupedByClinic[clinicId] = {
                            tests: [],
                            totalAmount: 0,
                            cartItemIds: []
                        };
                    }
                    groupedByClinic[clinicId].tests.push(preparedTest);
                    groupedByClinic[clinicId].totalAmount += finalPrice;
                    groupedByClinic[clinicId].cartItemIds.push(item._id.toString());
                }
                const rawTotalRwf = Object.values(groupedByClinic).reduce((acc, group) => acc + group.totalAmount, 0);
                const feePercentage = 0.02;
                const fullTotalRwf = Math.round(rawTotalRwf * (1 + feePercentage));
                const expectedRwf = fullTotalRwf;
                const ycRwf = payment.convertedAmount ||
                    Math.round(payment.amount * (payment.rate || 1420));
                const rwfDiff = Math.abs(expectedRwf - ycRwf);
                if (rwfDiff > 10) {
                    console.error("❌ YC RWF mismatch:", {
                        expectedRwf,
                        ycRwf,
                        rate: payment.rate,
                        difference: rwfDiff,
                        tolerance: 10
                    });
                    res
                        .status(http_status_1.default.BAD_REQUEST)
                        .send(`Payment mismatch. Expected ${expectedRwf} RWF but got ${ycRwf} RWF`);
                    return;
                }
                const finalDeliveryAddress = {
                    fullName: patient.fullName,
                    phoneNo: patient.phoneNumber,
                    address: patient.location.street,
                    cityOrDistrict: patient.location.cityOrDistrict
                };
                const createdOrderIds = [];
                for (const [clinicId, group] of Object.entries(groupedByClinic)) {
                    const orderId = (0, utils_1.generateOrderID)();
                    const order = yield order_model_1.default.create({
                        patient: patientId,
                        clinic: clinicId,
                        orderId,
                        tests: group.tests,
                        paymentMethod: "yellow_card",
                        deliveryMethod,
                        deliveryAddress: finalDeliveryAddress,
                        totalAmount: group.totalAmount,
                        paymentStatus: "paid",
                        yellowCardInfo: {
                            channelId: payment.channelId,
                            ycTransactionId: transactionId,
                            sequenceId: payment.sequenceId,
                            status: "complete"
                        }
                    });
                    yield testBooking_model_1.default.updateMany({ _id: { $in: group.cartItemIds } }, { status: "booked" });
                    const clinicRevenue = Math.round(group.totalAmount * 0.955);
                    yield clinic_model_1.default.findByIdAndUpdate(clinicId, {
                        $inc: { balance: clinicRevenue }
                    });
                    const populatedOrder = yield order_model_1.default
                        .findById(order._id)
                        .populate("clinic")
                        .populate("patient")
                        .lean();
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
                    yield (0, utils_3.notifyAdmin)("New Order Placed", `Patient "${patient.fullName}" placed a new order (${orderId})`, "order");
                    createdOrderIds.push(orderId);
                }
                res
                    .status(http_status_1.default.OK)
                    .send(`Created ${createdOrderIds.length} order(s).`);
            }
            catch (error) {
                console.error("❌ YC Webhook error:", error);
                res
                    .status(http_status_1.default.INTERNAL_SERVER_ERROR)
                    .send("Internal server error.");
            }
        });
    }
    static handlePawaPayWebhook(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const data = req.body;
                const transactionId = data === null || data === void 0 ? void 0 : data.depositId;
                const status = ((data === null || data === void 0 ? void 0 : data.status) || "").toLowerCase();
                const rawMetadata = (_a = data === null || data === void 0 ? void 0 : data.metadata) !== null && _a !== void 0 ? _a : {};
                const failureReason = (_d = (_c = (_b = data === null || data === void 0 ? void 0 : data.failureReason) === null || _b === void 0 ? void 0 : _b.failureMessage) !== null && _c !== void 0 ? _c : data === null || data === void 0 ? void 0 : data.failureMessage) !== null && _d !== void 0 ? _d : "Unknown error";
                if (!transactionId || !status) {
                    res.status(http_status_1.default.BAD_REQUEST).send("Missing data.");
                    return;
                }
                // Handle failed/rejected first
                if (["failed", "rejected"].includes(status)) {
                    yield (0, _1.handleFailedPayment)(failureReason, rawMetadata);
                    res.status(http_status_1.default.OK).send("Deposit marked as failed.");
                    return;
                }
                // Ignore non-completed
                if (status !== "completed") {
                    res.status(http_status_1.default.OK).send("Status not handled.");
                    return;
                }
                const existingOrder = yield order_model_1.default.findOne({
                    depositId: transactionId
                });
                if (existingOrder) {
                    res.status(http_status_1.default.OK).send("Order already processed.");
                    return;
                }
                const metadata = Array.isArray(rawMetadata)
                    ? Object.fromEntries(rawMetadata.map((m) => [m.fieldName, m.fieldValue]))
                    : rawMetadata;
                if ((metadata === null || metadata === void 0 ? void 0 : metadata.paymentOrigin) === "public") {
                    yield (0, _1.handlePublicPayment)(data, metadata);
                    res.status(http_status_1.default.OK).send("Public order created successfully.");
                    return;
                }
                const createdOrderIds = yield (0, _1.handlePatientPayment)(data, metadata);
                res
                    .status(http_status_1.default.OK)
                    .send(`Created ${createdOrderIds.length} order(s) from PawaPay.`);
            }
            catch (error) {
                yield (0, utils_3.notifyAdmin)("PawaPay Webhook Error", `Error occurred while processing PawaPay webhook: ${error.message}`, "warning");
                res.status(500).send("Internal server error.");
            }
        });
    }
    static handlePawaPayPayoutWebhook(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const data = req.body;
                const { payoutId, status, providerTransactionId, failureReason } = data;
                if (!payoutId || !status) {
                    res.status(http_status_1.default.BAD_REQUEST).send("Invalid webhook payload.");
                    return;
                }
                const normalizedStatus = status.toUpperCase();
                const withdrawal = yield withdrawal_model_1.default.findOne({ payoutId }).populate("clinic", "clinicName email");
                if (!withdrawal) {
                    res.status(http_status_1.default.NOT_FOUND).send("Withdrawal not found.");
                    return;
                }
                if (["COMPLETED", "FAILED", "REJECTED"].includes(withdrawal.status)) {
                    res.status(http_status_1.default.OK).send("Already processed.");
                    return;
                }
                const clinicId = (_a = withdrawal.clinic) === null || _a === void 0 ? void 0 : _a._id;
                const clinicName = (_b = withdrawal.clinic) === null || _b === void 0 ? void 0 : _b.clinicName;
                const phone = withdrawal.phoneNumber;
                const amount = withdrawal.amount;
                switch (normalizedStatus) {
                    case "COMPLETED": {
                        withdrawal.status = "completed";
                        withdrawal.providerStatus = "COMPLETED";
                        withdrawal.providerTransactionId = providerTransactionId;
                        (_c = withdrawal.statusHistory) === null || _c === void 0 ? void 0 : _c.push({
                            status: "completed",
                            changedAt: new Date()
                        });
                        yield withdrawal.save();
                        yield clinic_notification_model_1.default.create([
                            {
                                clinic: clinicId,
                                title: "Withdrawal Completed",
                                message: `Your withdrawal of ${amount.toLocaleString()} RWF to ${phone} has been completed.`,
                                type: "wallet",
                                isRead: false
                            }
                        ]);
                        yield (0, utils_3.notifyAdmin)("Clinic Withdrawal Completed", `Clinic ${clinicName} withdrawal of ${amount.toLocaleString()} RWF to ${phone} completed.`, "wallet");
                        break;
                    }
                    case "FAILED":
                    case "REJECTED": {
                        withdrawal.status = "failed";
                        withdrawal.providerStatus = normalizedStatus;
                        withdrawal.rejectionReason =
                            (_d = failureReason === null || failureReason === void 0 ? void 0 : failureReason.failureMessage) !== null && _d !== void 0 ? _d : "Unknown error";
                        withdrawal.providerTransactionId = providerTransactionId;
                        yield withdrawal.save();
                        const totalRefund = (withdrawal.amount || 0) + (withdrawal.fee || 0);
                        yield clinic_model_1.default.findByIdAndUpdate(clinicId, {
                            $inc: { balance: totalRefund }
                        });
                        yield clinic_notification_model_1.default.create([
                            {
                                clinic: clinicId,
                                title: "Withdrawal Failed",
                                message: `Your withdrawal of ${amount.toLocaleString()} RWF to ${phone} failed. Reason: ${withdrawal.rejectionReason}`,
                                type: "wallet",
                                isRead: false
                            }
                        ]);
                        yield (0, utils_3.notifyAdmin)("Clinic Withdrawal Failed", `Clinic ${clinicName} withdrawal of ${amount.toLocaleString()} RWF to ${phone} failed. Reason: ${withdrawal.rejectionReason}`, "wallet");
                        break;
                    }
                    default:
                        res.status(http_status_1.default.OK).send("Unhandled status.");
                        return;
                }
                res.status(http_status_1.default.OK).send("Webhook processed.");
            }
            catch (error) {
                console.error("❌ Withdrawal Webhook Error:", error);
                res.status(http_status_1.default.INTERNAL_SERVER_ERROR).send("Webhook error.");
            }
        });
    }
    static getPawaPayPaymentDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const response = yield axios_1.default.get(`${process.env.PAWAPAY_API_URL}/deposits/${id}`, {
                    headers: {
                        Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
                        "Content-Type": "application/json"
                    }
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "PawaPay payment details retrieved",
                    data: response.data
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static handleYellowCardPayoutWebhook(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const data = req.body;
                const payoutId = data === null || data === void 0 ? void 0 : data.id;
                const sequenceId = data === null || data === void 0 ? void 0 : data.sequenceId;
                const status = ((data === null || data === void 0 ? void 0 : data.status) || "").toLowerCase();
                const eventType = ((data === null || data === void 0 ? void 0 : data.eventType) || "").toLowerCase();
                const normalizedStatus = status || eventType;
                const errorCode = data === null || data === void 0 ? void 0 : data.errorCode;
                if (!payoutId || !sequenceId || !normalizedStatus) {
                    res.status(http_status_1.default.BAD_REQUEST).send("Invalid webhook payload.");
                    return;
                }
                const withdrawal = yield withdrawal_model_1.default.findOne({ payoutId }).populate("clinic", "clinicName email");
                if (!withdrawal) {
                    res.status(http_status_1.default.NOT_FOUND).send("Withdrawal not found.");
                    return;
                }
                if (["completed", "failed"].includes(withdrawal.status)) {
                    res.status(http_status_1.default.OK).send("Already processed.");
                    return;
                }
                const clinicId = (_a = withdrawal.clinic) === null || _a === void 0 ? void 0 : _a._id;
                const clinicName = (_b = withdrawal.clinic) === null || _b === void 0 ? void 0 : _b.clinicName;
                const account = withdrawal.accountNumber;
                const amount = withdrawal.amount;
                // Early state logging
                if (["created", "processing"].includes(normalizedStatus)) {
                    yield withdrawal_model_1.default.updateOne({ _id: withdrawal._id }, {
                        providerTransactionId: payoutId,
                        providerStatus: normalizedStatus,
                        $push: {
                            statusHistory: {
                                status: normalizedStatus,
                                changedAt: new Date()
                            }
                        }
                    });
                    console.log(`ℹ️ YC payout still in progress: ${normalizedStatus}`);
                    return res.status(http_status_1.default.OK).send("Payout in progress.");
                }
                // Completed
                if (["completed", "complete", "payout.completed"].includes(normalizedStatus)) {
                    yield withdrawal_model_1.default.updateOne({ _id: withdrawal._id }, {
                        status: "completed",
                        providerTransactionId: payoutId,
                        providerStatus: normalizedStatus,
                        $push: {
                            statusHistory: {
                                status: "completed",
                                changedAt: new Date()
                            }
                        }
                    });
                    yield clinic_notification_model_1.default.create([
                        {
                            clinic: clinicId,
                            title: "Withdrawal Completed",
                            message: `Your withdrawal of ${amount.toLocaleString()} RWF to ${account} has been completed.`,
                            type: "wallet",
                            isRead: false
                        }
                    ]);
                    yield (0, utils_3.notifyAdmin)("Clinic Withdrawal Completed", `Clinic ${clinicName} withdrawal of ${amount.toLocaleString()} RWF to ${account} completed.`, "wallet");
                    return res.status(http_status_1.default.OK).send("Withdrawal marked as completed.");
                }
                // Failed
                if (["failed", "payout.failed"].includes(normalizedStatus)) {
                    const totalRefund = (withdrawal.amount || 0) + (withdrawal.fee || 0);
                    yield withdrawal_model_1.default.updateOne({ _id: withdrawal._id }, {
                        status: "failed",
                        rejectionReason: errorCode || "Unknown error",
                        providerTransactionId: payoutId,
                        providerStatus: normalizedStatus,
                        $push: {
                            statusHistory: {
                                status: "failed",
                                changedAt: new Date()
                            }
                        }
                    });
                    yield clinic_model_1.default.findByIdAndUpdate(clinicId, {
                        $inc: { balance: totalRefund }
                    });
                    yield clinic_notification_model_1.default.create([
                        {
                            clinic: clinicId,
                            title: "Withdrawal Failed",
                            message: `Your withdrawal of ${withdrawal.amount.toLocaleString()} RWF to ${account} failed. Reason: ${errorCode || "Unknown error"}`,
                            type: "wallet",
                            isRead: false
                        }
                    ]);
                    yield (0, utils_3.notifyAdmin)("Clinic Withdrawal Failed", `Clinic ${clinicName} withdrawal of ${withdrawal.amount.toLocaleString()} RWF to ${account} failed. Reason: ${errorCode || "Unknown error"}`, "wallet");
                    return res.status(http_status_1.default.OK).send("Withdrawal marked as failed.");
                }
                yield withdrawal_model_1.default.updateOne({ _id: withdrawal._id }, {
                    providerTransactionId: payoutId,
                    providerStatus: normalizedStatus,
                    $push: {
                        statusHistory: {
                            status: normalizedStatus,
                            changedAt: new Date()
                        }
                    }
                });
                console.warn(`⚠️ Unhandled YC payout status: ${normalizedStatus}`);
                res.status(http_status_1.default.OK).send("Unhandled status.");
            }
            catch (error) {
                console.error("❌ YC Payout Webhook Error:", error);
                res.status(http_status_1.default.INTERNAL_SERVER_ERROR).send("Webhook error.");
            }
        });
    }
    static getYellowCardBanksForCountry(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const country = (req.query.country || "RWA").toUpperCase();
                const ycService = new payment_service_1.YellowCardService();
                const channels = yield ycService.getPaymentChannels(country);
                const banks = channels.map((channel) => ({
                    id: channel.id,
                    country: channel.country,
                    currency: channel.currency,
                    feeLocal: channel.feeLocal,
                    feeUSD: channel.feeUSD,
                    min: channel.min,
                    max: channel.max,
                    estimatedSettlementTime: channel.estimatedSettlementTime
                }));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: `${banks.length} banks found`,
                    data: banks
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = PaymentController;
