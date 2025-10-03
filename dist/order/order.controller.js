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
const mongoose_1 = __importDefault(require("mongoose"));
const uuid_1 = require("uuid");
const __1 = require("..");
const admin_model_1 = __importDefault(require("../admin/admin.model"));
const admin_notification_model_1 = __importDefault(require("../admin/admin.notification.model"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const clinic_notification_model_1 = __importDefault(require("../clinic/clinic.notification.model"));
const constant_1 = require("../constant");
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const patient_notification_model_1 = __importDefault(require("../patient/patient.notification.model"));
const smtp_order_service_1 = __importDefault(require("../smtp/order/smtp.order.service"));
const test_item_model_1 = __importDefault(require("../test/test.item.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
const testBooking_model_1 = __importDefault(require("../testBooking(Cart)/testBooking.model"));
const test_result_model_1 = __importDefault(require("../testResult/test.result.model"));
const utils_1 = require("../utils");
const app_error_1 = __importDefault(require("../utils/app.error"));
const sendPushNotification_1 = require("../utils/sendPushNotification");
const order_model_1 = __importDefault(require("./order.model"));
const utils_2 = require("./utils");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const timezoneMap_1 = require("../utils/timezoneMap");
const discount_service_1 = require("../services/discount.service");
class OrderController {
    /**
     * Checkout (Place an Order)
     */
    static checkout(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { paymentMethod, deliveryAddress, insuranceDetails, deliveryMethod, phoneNumber } = req.body;
                const patient = yield patient_model_1.default.findById(patientId);
                if (!patient)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Account not found.");
                const cartItems = yield testBooking_model_1.default.find({
                    patient: patientId,
                    status: "pending"
                });
                if (!(cartItems === null || cartItems === void 0 ? void 0 : cartItems.length)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Your cart is empty.");
                }
                yield Promise.all(cartItems.map((item) => (0, discount_service_1.revalidateDiscount)(item)));
                const [allTestItem, testDocs] = yield Promise.all([
                    test_item_model_1.default.find().select("name image"),
                    test_model_1.default
                        .find({
                        _id: { $in: cartItems.map((item) => item.test) },
                        isDeleted: false
                    })
                        .select("testName price turnaroundTime description")
                ]);
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
                    const subtotal = basePrice * item.individuals;
                    const finalPrice = ((_c = item.discount) === null || _c === void 0 ? void 0 : _c.finalPrice) && item.discount.finalPrice > 0
                        ? item.discount.finalPrice
                        : subtotal;
                    const preparedTest = {
                        test: item.test,
                        testName: (_d = testData === null || testData === void 0 ? void 0 : testData.testName) !== null && _d !== void 0 ? _d : "Unknown Test",
                        individuals: item.individuals,
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
                const allClinicTotals = Object.values(groupedByClinic).reduce((acc, curr) => acc + curr.totalAmount, 0);
                const clinicIds = Object.keys(groupedByClinic);
                const clinics = yield clinic_model_1.default
                    .find({ _id: { $in: clinicIds } })
                    .select("onlineStatus clinicName");
                const offlineClinic = clinics.find((clinic) => clinic.onlineStatus === "offline");
                if (offlineClinic) {
                    throw new app_error_1.default(http_status_1.default.FORBIDDEN, `Clinic "${offlineClinic.clinicName}" is currently offline and cannot accept orders.`);
                }
                const name = (_g = patient === null || patient === void 0 ? void 0 : patient.fullName) === null || _g === void 0 ? void 0 : _g.trim();
                if (name.length < 5) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Full name must be at least 10 characters long for payment to be processed successfully.");
                }
                switch (paymentMethod.toLowerCase()) {
                    case "pawa_pay": {
                        if (!phoneNumber) {
                            throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Phone number is required for PawaPay payment.");
                        }
                        const prediction = yield (0, utils_1.validatePhoneWithPawaPay)(phoneNumber);
                        const predictedProvider = prediction.provider;
                        const orderId = (0, utils_1.generateOrderID)();
                        const depositId = (0, uuid_1.v4)();
                        const amountToSend = Math.round(allClinicTotals).toString();
                        const depositPayload = {
                            depositId,
                            amount: amountToSend,
                            currency: "RWF",
                            country: "RWA",
                            correspondent: predictedProvider,
                            payer: {
                                type: "MSISDN",
                                address: { value: phoneNumber }
                            },
                            customerTimestamp: new Date().toISOString(),
                            statementDescription: `Order ${orderId.slice(-6)}`,
                            metadata: [
                                {
                                    fieldName: "patientId",
                                    fieldValue: (patientId === null || patientId === void 0 ? void 0 : patientId.slice(0, 64)) || ""
                                },
                                { fieldName: "service", fieldValue: "clinic" },
                                {
                                    fieldName: "callbackUrl",
                                    fieldValue: `${process.env.BACKEND_URL}/api/v1/payment/p/d-w`
                                },
                                { fieldName: "orderId", fieldValue: orderId.slice(0, 64) },
                                {
                                    fieldName: "phoneNumber",
                                    fieldValue: phoneNumber.slice(0, 64)
                                },
                                { fieldName: "paymentMethod", fieldValue: "pawa_pay" },
                                {
                                    fieldName: "totalAmount",
                                    fieldValue: allClinicTotals.toString().slice(0, 64)
                                },
                                {
                                    fieldName: "deliveryMethod",
                                    fieldValue: String(deliveryMethod)
                                },
                                {
                                    fieldName: "deliveryAddress",
                                    fieldValue: JSON.stringify(deliveryAddress).slice(0, 64)
                                }
                            ]
                        };
                        const response = yield axios_1.default.post(`${process.env.PAWAPAY_API_URL}/deposits`, depositPayload, {
                            headers: {
                                Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
                                "Content-Type": "application/json"
                            },
                            timeout: 10000
                        });
                        if (response.data.status !== "ACCEPTED") {
                            throw new app_error_1.default(http_status_1.default.BAD_REQUEST, ((_h = response === null || response === void 0 ? void 0 : response.data) === null || _h === void 0 ? void 0 : _h.rejectionReason) || "Payment not accepted");
                        }
                        return res.status(http_status_1.default.CREATED).json({
                            success: true,
                            message: "PawaPay payment initiated. Complete the payment on your phone.",
                            data: {
                                transactionId: response.data.depositId,
                                orderId,
                                amountToSend: parseInt(amountToSend),
                                baseAmount: Math.round(allClinicTotals),
                                phoneNumber,
                                feePercentage: 0
                            }
                        });
                    }
                    case "insurance": {
                        const patient = yield patient_model_1.default.findById(patientId).lean();
                        if (!patient ||
                            !patient.insurance ||
                            patient.insurance.length === 0) {
                            throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "You must have at least one valid insurance record to use this payment method.");
                        }
                        const selectedInsuranceId = insuranceDetails === null || insuranceDetails === void 0 ? void 0 : insuranceDetails.insuranceId;
                        if (!selectedInsuranceId) {
                            throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Insurance is required when using insurance payment.");
                        }
                        // Validate clinic support
                        const clinicIds = Object.keys(groupedByClinic);
                        const clinics = yield clinic_model_1.default
                            .find({ _id: { $in: clinicIds } })
                            .select("clinicName supportInsurance");
                        const unsupported = clinics.find((clinic) => { var _a; return !((_a = clinic.supportInsurance) === null || _a === void 0 ? void 0 : _a.includes(selectedInsuranceId)); });
                        if (unsupported) {
                            throw new app_error_1.default(http_status_1.default.FORBIDDEN, `Clinic "${(_j = unsupported.clinicName) === null || _j === void 0 ? void 0 : _j.toUpperCase()}" does not support this insurance.`);
                        }
                        const allCreatedOrders = [];
                        for (const [clinicId, entry] of Object.entries(groupedByClinic)) {
                            const orderId = (0, utils_1.generateOrderID)();
                            const order = yield order_model_1.default.create({
                                patient: patientId,
                                clinic: clinicId,
                                orderId,
                                tests: entry.tests,
                                paymentMethod,
                                deliveryAddress,
                                deliveryMethod: (0, utils_2.deliveryMethodToNumber)(deliveryMethod),
                                totalAmount: entry.totalAmount,
                                insuranceDetails,
                                paymentStatus: "paid"
                            });
                            yield testBooking_model_1.default.updateMany({ _id: { $in: entry.cartItemIds } }, { status: "booked" });
                            const populatedOrder = yield order_model_1.default
                                .findById(order._id)
                                .populate("clinic")
                                .populate("patient")
                                .lean();
                            if (populatedOrder) {
                                yield smtp_order_service_1.default.sendOrderConfirmationEmail(populatedOrder);
                                yield smtp_order_service_1.default.sendClinicOrderNotificationEmail(populatedOrder);
                            }
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
                                    message: `We've received your payment of ${entry.totalAmount.toLocaleString()} RWF via insurance`,
                                    type: "payment",
                                    isRead: false
                                }
                            ]);
                            if (patient.expoPushToken) {
                                yield (0, sendPushNotification_1.sendPushNotification)({
                                    expoPushToken: patient.expoPushToken,
                                    title: "Payment Successful",
                                    message: `Your payment for order #${orderId} was received via insurance`,
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
                                    message: `Payment received for order #${orderId} (${entry.totalAmount.toLocaleString()} RWF) via insurance`,
                                    type: "wallet",
                                    isRead: false
                                }
                            ]);
                            const admin = yield admin_model_1.default.findOne();
                            if (admin) {
                                yield admin_notification_model_1.default.create([
                                    {
                                        admin: admin._id,
                                        title: "New Order Placed",
                                        message: `Patient "${patient.fullName}" placed a new order (${orderId}) via insurance`,
                                        type: "order",
                                        isRead: false
                                    }
                                ]);
                            }
                            allCreatedOrders.push(orderId);
                        }
                        return res.status(http_status_1.default.CREATED).json({
                            success: true,
                            message: "Order(s) placed using insurance.",
                            orderIds: allCreatedOrders
                        });
                    }
                    default:
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid payment method");
                }
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
    /**
     * Get All Orders for a Patient
     */
    static getUserOrders(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const patient = yield patient_model_1.default
                    .findById(patientId)
                    .select("fullName country");
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const { filter } = req.query;
                const page = parseInt(req.query.page) || 1;
                const baseLimit = 10;
                const limit = baseLimit * page;
                const skip = 0;
                let statusFilter = {};
                if (filter === "past") {
                    statusFilter = {
                        "tests.status": { $in: ["result_sent", "result_ready"] }
                    };
                }
                else if (filter === "upcoming") {
                    statusFilter = {
                        "tests.status": {
                            $in: ["pending", "sample_collected", "processing"]
                        }
                    };
                }
                const totalOrdersInDatabase = yield order_model_1.default.countDocuments({
                    patient: patientId
                });
                const totalOrders = yield order_model_1.default.countDocuments(Object.assign({ patient: patientId }, statusFilter));
                const allOrders = yield order_model_1.default
                    .find(Object.assign({ patient: patientId }, statusFilter))
                    .sort({ createdAt: -1 })
                    .select("-__v")
                    .skip(skip)
                    .limit(limit);
                const testItems = yield test_item_model_1.default.find().select("name image");
                const ordersWithDetails = yield Promise.all(allOrders.map((order) => __awaiter(this, void 0, void 0, function* () {
                    const clinic = yield clinic_model_1.default
                        .findById(order.clinic)
                        .select("clinicName");
                    if (!clinic) {
                        throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                    }
                    const formattedTests = yield Promise.all(order.tests.map((testItem) => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        const test = yield test_model_1.default
                            .findById(testItem.test)
                            .setOptions({ includeDeleted: true })
                            .select("testName price currencySymbol");
                        const testImage = ((_a = testItems === null || testItems === void 0 ? void 0 : testItems.find((ti) => { var _a, _b; return ((_a = ti.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === ((_b = test === null || test === void 0 ? void 0 : test.testName) === null || _b === void 0 ? void 0 : _b.toLowerCase()); })) === null || _a === void 0 ? void 0 : _a.image) || "";
                        const timezone = (0, timezoneMap_1.getTimezoneForCountry)(patient.country);
                        return {
                            _id: order._id,
                            orderId: order.orderId,
                            testId: testItem.test,
                            testImage,
                            testName: test === null || test === void 0 ? void 0 : test.testName,
                            individuals: testItem === null || testItem === void 0 ? void 0 : testItem.individuals,
                            date: order.createdAt
                                ? (0, moment_timezone_1.default)(order.createdAt)
                                    .tz(timezone)
                                    .format("ddd, D MMM YYYY")
                                : null,
                            selectedTestDate: (testItem === null || testItem === void 0 ? void 0 : testItem.date)
                                ? (0, moment_timezone_1.default)(testItem.date).tz(timezone).format("ddd, D MMM YYYY")
                                : null,
                            clinicName: clinic === null || clinic === void 0 ? void 0 : clinic.clinicName,
                            price: testItem === null || testItem === void 0 ? void 0 : testItem.price,
                            currencySymbol: test === null || test === void 0 ? void 0 : test.currencySymbol,
                            status: testItem.status,
                            statusReason: testItem.statusReason || null,
                            paymentStatus: order.paymentStatus
                        };
                    })));
                    return formattedTests;
                })));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "User orders retrieved successfully.",
                    hasNoOrders: totalOrdersInDatabase === 0,
                    data: ordersWithDetails.flat(),
                    pagination: {
                        currentPage: page,
                        total: totalOrders,
                        totalPages: Math.ceil(totalOrders / baseLimit)
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get Order Details for Clinic
     */
    static getClinicOrderDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orderId = req.params.orderId;
                const clinicId = (0, utils_1.getClinicId)(req);
                const order = yield order_model_1.default
                    .findOne({ _id: orderId, clinic: clinicId })
                    .populate("patient", "fullName email phoneNumber")
                    .select("-__v")
                    .lean();
                if (!order) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Order not found.");
                }
                const tests = yield Promise.all(order.tests.map((t) => __awaiter(this, void 0, void 0, function* () {
                    const testDoc = yield test_model_1.default
                        .findById(t.test)
                        .setOptions({ includeDeleted: true })
                        .select("currencySymbol image")
                        .lean();
                    return Object.assign(Object.assign({}, t), { test: testDoc });
                })));
                order.tests = tests;
                const clinic = yield clinic_model_1.default
                    .findById(clinicId)
                    .select("currencySymbol")
                    .lean();
                const currencySymbol = (clinic === null || clinic === void 0 ? void 0 : clinic.currencySymbol) || "₦";
                const allTestItems = yield test_item_model_1.default
                    .find()
                    .select("name image")
                    .lean();
                const testResults = yield test_result_model_1.default
                    .find({
                    clinic: clinicId,
                    patient: order.patient._id,
                    order: order._id,
                    test: { $in: order.tests.map((t) => t.test) }
                })
                    .select("test resultSent")
                    .lean();
                const testResultMap = new Map();
                testResults.forEach((tr) => {
                    var _a;
                    testResultMap.set(tr.test.toString(), (_a = tr.resultSent) !== null && _a !== void 0 ? _a : false);
                });
                const testsWithImages = order.tests.map((test) => {
                    var _a;
                    const testRef = test.test;
                    const image = ((_a = allTestItems.find((item) => item.name.toLowerCase() === test.testName.toLowerCase())) === null || _a === void 0 ? void 0 : _a.image) ||
                        (testRef === null || testRef === void 0 ? void 0 : testRef.image) ||
                        "";
                    const resultSent = testResultMap.get(testRef._id.toString()) || false;
                    return {
                        _id: testRef._id,
                        testName: test.testName,
                        price: test.price,
                        currencySymbol: testRef === null || testRef === void 0 ? void 0 : testRef.currencySymbol,
                        image,
                        resultSent,
                        status: test.status,
                        date: (0, moment_timezone_1.default)(test.scheduledAt || test.date).format("YYYY-MM-DD hh:mm A"),
                        statusReason: test.statusReason || null,
                        statusHistory: test.statusHistory || []
                    };
                });
                const paymentMethodLabel = order.paymentMethod === "pawa_pay"
                    ? "momo with pawapay"
                    : order.paymentMethod === "yellow_card"
                        ? "bank transfer with yellow card"
                        : order.paymentMethod;
                const orderWithImages = Object.assign(Object.assign({}, order), { tests: testsWithImages, currencySymbol,
                    paymentMethodLabel, insuranceDetails: order.paymentMethod === "insurance"
                        ? order.insuranceDetails
                        : undefined, deliveryMethod: (0, utils_2.mapDeliveryMethod)(order.deliveryMethod) });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Order details retrieved successfully.",
                    data: orderWithImages
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get All Orders for a Clinic with Pagination & Filters
     */
    static getClinicOrders(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { page = "1", limit = "10", paymentMethod, date } = req.query;
                const pageNumber = parseInt(page, 10) || 1;
                const limitNumber = parseInt(limit, 10) || 10;
                const skip = (pageNumber - 1) * limitNumber;
                const filter = { clinic: clinicId };
                if (paymentMethod) {
                    const pm = paymentMethod.toLowerCase();
                    if (pm === "momo") {
                        filter.paymentMethod = "pawa_pay";
                    }
                    else if (pm === "bank transfer") {
                        filter.paymentMethod = "yellow_card";
                    }
                    else {
                        filter.paymentMethod = pm;
                    }
                }
                if (date) {
                    const startDate = new Date(date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(date);
                    endDate.setHours(23, 59, 59, 999);
                    filter.createdAt = { $gte: startDate, $lte: endDate };
                }
                const orders = yield order_model_1.default
                    .find(filter)
                    .select("orderId patient tests totalAmount createdAt paymentMethod")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNumber)
                    .lean();
                const totalOrdersInDatabase = yield order_model_1.default.countDocuments({
                    clinic: clinicId
                });
                const formattedOrders = yield Promise.all(orders.map((order) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c, _d;
                    const patient = yield patient_model_1.default
                        .findById(order.patient)
                        .select("fullName");
                    const clinicDoc = yield clinic_model_1.default
                        .findById(clinicId)
                        .select("country");
                    const timezone = (0, timezoneMap_1.getTimezoneForCountry)(clinicDoc === null || clinicDoc === void 0 ? void 0 : clinicDoc.country);
                    let currencySymbol = "RWF";
                    if ((_a = order.tests) === null || _a === void 0 ? void 0 : _a.length) {
                        const testRef = (_b = order.tests[0]) === null || _b === void 0 ? void 0 : _b.test;
                        if (testRef) {
                            const testDoc = yield test_model_1.default
                                .findById(testRef)
                                .select("currencySymbol")
                                .lean();
                            if (testDoc === null || testDoc === void 0 ? void 0 : testDoc.currencySymbol) {
                                currencySymbol = testDoc.currencySymbol;
                            }
                        }
                    }
                    const testNames = (() => {
                        const names = order.tests.map((t) => t.testName);
                        if (names.length === 0)
                            return "N/A";
                        if (names.length <= 2)
                            return names.join(", ");
                        return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
                    })();
                    const testStatuses = ((_c = order.tests) === null || _c === void 0 ? void 0 : _c.map((t) => t.status)) || [];
                    const uniqueStatuses = [...new Set(testStatuses)];
                    let overallStatus = "pending";
                    if (uniqueStatuses.length === 1) {
                        overallStatus = uniqueStatuses[0];
                    }
                    else {
                        overallStatus = "mixed";
                    }
                    const testResults = yield test_result_model_1.default
                        .find({
                        clinic: clinicId,
                        patient: order.patient,
                        order: order._id,
                        test: { $in: ((_d = order.tests) === null || _d === void 0 ? void 0 : _d.map((t) => t.test)) || [] }
                    })
                        .select("resultSent")
                        .lean();
                    const resultSent = testResults.some((tr) => tr.resultSent === true);
                    return {
                        id: order === null || order === void 0 ? void 0 : order._id,
                        orderId: order === null || order === void 0 ? void 0 : order.orderId,
                        CustomerName: (patient === null || patient === void 0 ? void 0 : patient.fullName) || "N/A",
                        Test: testNames,
                        Date: moment_timezone_1.default.utc(order.createdAt).tz(timezone).format("DD-MM-YYYY"),
                        Time: moment_timezone_1.default.utc(order.createdAt).tz(timezone).format("hh:mm A"),
                        PaymentMethod: (order === null || order === void 0 ? void 0 : order.paymentMethod) === "pawa_pay"
                            ? "momo"
                            : (order === null || order === void 0 ? void 0 : order.paymentMethod) === "yellow_card"
                                ? "bank transfer"
                                : order === null || order === void 0 ? void 0 : order.paymentMethod,
                        price: order === null || order === void 0 ? void 0 : order.totalAmount,
                        currencySymbol,
                        Status: overallStatus,
                        resultSent
                    };
                })));
                const totalOrders = yield order_model_1.default.countDocuments(filter);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Orders retrieved successfully.",
                    hasNoOrders: totalOrdersInDatabase === 0,
                    data: formattedOrders,
                    pagination: {
                        currentPage: pageNumber,
                        totalPages: Math.ceil(totalOrders / limitNumber),
                        totalOrders
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Update Order Test Status (Clinic)
     */
    static updateOrderTestStatus(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { id, testId } = req.params;
                const { status, statusReason } = req.body;
                const validStatuses = [
                    "pending",
                    "sample_collected",
                    "processing",
                    "result_ready",
                    "result_sent",
                    "rejected",
                    "cancelled",
                    "failed"
                ];
                if (!validStatuses.includes(status)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid status.");
                }
                const order = yield order_model_1.default
                    .findOne({ _id: id, clinic: clinicId })
                    .populate("patient", "fullName email phoneNumber")
                    .populate("clinic", "clinicName location currencySymbol");
                if (!order) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Order not found.");
                }
                const testItem = order.tests.find((t) => t.test.toString() === testId.toString());
                if (!testItem) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found in order.");
                }
                if (status === "rejected" && order.paymentMethod === "pawa_pay") {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Orders paid with MoMo cannot be rejected.");
                }
                const requiresReason = ["rejected", "cancelled", "failed"].includes(status);
                if (requiresReason && !statusReason) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, `Please provide a reason for marking the test as ${status}.`);
                }
                if (status === "cancelled") {
                    const disallowedStates = ["result_ready", "result_sent"];
                    if (disallowedStates.includes(testItem.status)) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Cannot cancel a test that is already completed or result has been sent.");
                    }
                    if (order.paymentMethod === "insurance" && !statusReason) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Cancelling insurance-based orders requires a reason.");
                    }
                }
                const statusFlow = [
                    "pending",
                    "sample_collected",
                    "processing",
                    "result_ready",
                    "result_sent"
                ];
                const currentStatus = testItem.status;
                const currentIndex = statusFlow.indexOf(currentStatus);
                const finalIndex = statusFlow.indexOf(status);
                const statusesToFill = currentIndex === -1
                    ? statusFlow.slice(0, finalIndex + 1)
                    : statusFlow.slice(currentIndex + 1, finalIndex + 1);
                const now = new Date();
                const historyEntries = statusesToFill.map((s) => ({
                    status: s,
                    changedAt: now
                }));
                testItem.status = status;
                testItem.statusReason = requiresReason ? statusReason : null;
                if (!Array.isArray(testItem.statusHistory)) {
                    testItem.statusHistory = [];
                }
                testItem.statusHistory.push(...historyEntries);
                yield order.save();
                const patient = yield patient_model_1.default
                    .findById(order.patient._id)
                    .select("fullName email phoneNumber expoPushToken");
                const clinic = yield clinic_model_1.default
                    .findById(clinicId)
                    .select("clinicName location currencySymbol");
                const admin = yield admin_model_1.default.findOne();
                if (patient && clinic) {
                    try {
                        yield smtp_order_service_1.default.sendOrderStatusUpdateEmail(order, testItem, clinic, patient);
                    }
                    catch (emailErr) {
                        console.error("Failed to send status update email:", emailErr);
                    }
                    yield patient_notification_model_1.default.create({
                        patient: patient._id,
                        title: "Test Status Updated",
                        message: `The status of your "${(0, utils_2.formatCase)(testItem.testName)}" test in order ${order.orderId} has been updated to "${status.replace(/_/g, " ")}".`,
                        type: "order",
                        isRead: false
                    });
                    if (patient.expoPushToken) {
                        yield (0, sendPushNotification_1.sendPushNotification)({
                            expoPushToken: patient.expoPushToken,
                            title: `${(0, utils_2.formatCase)(testItem.testName)} Test • Status Updated`,
                            message: `Your "${(0, utils_2.formatCase)(testItem.testName)}" test is now "${status.replace(/_/g, " ")}". Tap to view details.`,
                            type: "order",
                            data: {
                                screen: "OrderDetails",
                                orderId: order._id.toString(),
                                testId: testItem.test.toString()
                            }
                        });
                    }
                    if (admin) {
                        yield admin_notification_model_1.default.create({
                            admin: admin._id,
                            title: "Test Status Updated by Clinic",
                            message: `The clinic "${clinic.clinicName}" has updated the status of test "${(0, utils_2.formatCase)(testItem.testName)}" in order ${order.orderId} to "${status.replace(/_/g, " ")}".`,
                            type: "order",
                            isRead: false
                        });
                    }
                    yield clinic_notification_model_1.default.create({
                        clinic: clinic._id,
                        title: "Test Status Updated",
                        message: `Status of test "${(0, utils_2.formatCase)(testItem.testName)}" in order ${order.orderId} has been updated to "${status.replace(/_/g, " ")}".`,
                        type: "order",
                        isRead: false
                    });
                }
                __1.io.emit("orderTestStatus:update", {
                    clinicId,
                    orderId: order._id,
                    testId: testItem.test.toString(),
                    status: testItem.status,
                    statusReason: testItem.statusReason,
                    statusHistory: testItem.statusHistory,
                    patient: {
                        _id: patient === null || patient === void 0 ? void 0 : patient._id,
                        fullName: patient === null || patient === void 0 ? void 0 : patient.fullName,
                        email: patient === null || patient === void 0 ? void 0 : patient.email,
                        phoneNumber: patient === null || patient === void 0 ? void 0 : patient.phoneNumber
                    },
                    clinic: {
                        _id: clinic === null || clinic === void 0 ? void 0 : clinic._id,
                        clinicName: clinic === null || clinic === void 0 ? void 0 : clinic.clinicName,
                        location: clinic === null || clinic === void 0 ? void 0 : clinic.location,
                        currencySymbol: clinic === null || clinic === void 0 ? void 0 : clinic.currencySymbol
                    }
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test status updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateOrderPaymentMethod(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { orderId } = req.params;
                const { paymentMethod } = req.body;
                const order = yield order_model_1.default
                    .findOne({
                    _id: orderId,
                    patient: patientId
                }, null, { session })
                    .populate("patient clinic");
                if (!order) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Order not found.");
                }
                order.paymentMethod = paymentMethod;
                yield order.save({ session });
                // Send email notification
                yield smtp_order_service_1.default.sendPaymentMethodUpdateEmail(order)
                    .then(() => {
                    console.log("Payment method email sent successfully.");
                })
                    .catch((error) => {
                    console.error("Error sending payment method email:", error);
                });
                // Create patient notification
                const [newNotification] = yield patient_notification_model_1.default.create([
                    {
                        patient: patientId,
                        title: "Payment Method Updated",
                        message: `Payment method for order (${order.orderId}) has been updated to ${paymentMethod}.`,
                        type: "order",
                        isRead: false
                    }
                ], { session });
                // Fetch patient for push token
                const patient = yield patient_model_1.default.findById(patientId);
                if (patient === null || patient === void 0 ? void 0 : patient.expoPushToken) {
                    yield (0, sendPushNotification_1.sendPushNotification)({
                        expoPushToken: patient.expoPushToken,
                        title: newNotification.title,
                        message: newNotification.message,
                        type: newNotification.type
                    });
                }
                // Create clinic notification
                yield clinic_notification_model_1.default.create([
                    {
                        clinic: order.clinic._id,
                        title: "Payment Method Updated",
                        message: `Patient updated payment method for order (${order.orderId}) to ${paymentMethod}.`,
                        type: "order",
                        isRead: false
                    }
                ], { session });
                yield session.commitTransaction();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Order payment method updated successfully."
                });
            }
            catch (error) {
                yield session.abortTransaction();
                next(error);
            }
            finally {
                session.endSession();
            }
        });
    }
    static updateDeliveryAddress(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { orderId } = req.params;
                const { fullName, phoneNo, address, cityOrDistrict } = req.body;
                const order = yield order_model_1.default
                    .findOne({
                    _id: orderId,
                    patient: patientId
                }, null, { session })
                    .populate("patient clinic");
                if (!order) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Order not found.");
                }
                order.deliveryAddress = { fullName, phoneNo, address, cityOrDistrict };
                yield order.save({ session });
                // Send email notification
                yield smtp_order_service_1.default.sendDeliveryAddressUpdateEmail(order)
                    .then(() => {
                    console.log("Delivery address email sent successfully.");
                })
                    .catch((error) => {
                    console.error("Error sending delivery address email:", error);
                });
                // Create patient notification
                const [newNotification] = yield patient_notification_model_1.default.create([
                    {
                        patient: patientId,
                        title: "Delivery Address Updated",
                        message: `Delivery address for order (${order.orderId}) has been updated.`,
                        type: "order",
                        isRead: false
                    }
                ], { session });
                // Fetch patient to get expoPushToken
                const patient = yield patient_model_1.default.findById(patientId);
                if (patient === null || patient === void 0 ? void 0 : patient.expoPushToken) {
                    yield (0, sendPushNotification_1.sendPushNotification)({
                        expoPushToken: patient.expoPushToken,
                        title: newNotification.title,
                        message: newNotification.message,
                        type: newNotification.type
                    });
                }
                // Create clinic notification
                yield clinic_notification_model_1.default.create([
                    {
                        clinic: order.clinic._id,
                        title: "Delivery Address Updated",
                        message: `Patient updated delivery address for order (${order.orderId}).`,
                        type: "order",
                        isRead: false
                    }
                ], { session });
                yield session.commitTransaction();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Delivery address updated successfully."
                });
            }
            catch (error) {
                yield session.abortTransaction();
                next(error);
            }
            finally {
                session.endSession();
            }
        });
    }
    static getOrderTestDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { orderId, testId } = req.params;
                const order = yield order_model_1.default
                    .findOne({
                    _id: orderId,
                    patient: patientId
                })
                    .populate("clinic", "clinicName location")
                    .select("-__v")
                    .lean();
                if (!order) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Order not found.");
                }
                const testItem = order.tests.find((t) => {
                    const testIdStr = (0, utils_2.isPopulatedTest)(t.test)
                        ? t.test._id.toString()
                        : t.test.toString();
                    return testIdStr === testId;
                });
                if (!testItem) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found in order.");
                }
                const testRef = yield test_model_1.default
                    .findById(testItem.test)
                    .setOptions({ includeDeleted: true })
                    .select("currencySymbol image description turnaroundTime")
                    .lean();
                const statusProgress = constant_1.ORDER_TEST_STATUS_FLOW.map((status) => {
                    var _a;
                    const historyEntry = (_a = testItem.statusHistory) === null || _a === void 0 ? void 0 : _a.find((h) => h.status === status);
                    return {
                        status,
                        date: (historyEntry === null || historyEntry === void 0 ? void 0 : historyEntry.changedAt) || null
                    };
                });
                const terminalEntry = constant_1.TERMINAL_TEST_STATUSES.find((s) => s === testItem.status);
                if (terminalEntry) {
                    const changedAt = (_d = (_c = (_b = (_a = testItem.statusHistory) === null || _a === void 0 ? void 0 : _a.find((h) => h.status === terminalEntry)) === null || _b === void 0 ? void 0 : _b.changedAt) !== null && _c !== void 0 ? _c : order.updatedAt) !== null && _d !== void 0 ? _d : null;
                    statusProgress.push({
                        status: terminalEntry,
                        date: changedAt
                    });
                }
                const paymentMethodLabel = order.paymentMethod === "pawa_pay"
                    ? "momo with pawapay"
                    : order.paymentMethod === "yellow_card"
                        ? "bank transfer with yellow card"
                        : order.paymentMethod;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Order details retrieved successfully.",
                    data: {
                        orderId: order.orderId,
                        test: (testRef === null || testRef === void 0 ? void 0 : testRef._id) || testItem.test,
                        testName: testItem.testName,
                        testImage: testItem.testImage,
                        price: testItem.price,
                        currencySymbol: testRef === null || testRef === void 0 ? void 0 : testRef.currencySymbol,
                        individuals: testItem.individuals,
                        turnaroundTime: (testRef === null || testRef === void 0 ? void 0 : testRef.turnaroundTime) || testItem.turnaroundTime,
                        description: (testRef === null || testRef === void 0 ? void 0 : testRef.description) || testItem.description,
                        status: testItem.status,
                        statusReason: testItem.statusReason,
                        paymentMethod: paymentMethodLabel,
                        insuranceDetails: order.paymentMethod === "insurance"
                            ? order.insuranceDetails
                            : undefined,
                        deliveryMethod: (0, utils_2.mapDeliveryMethod)(order.deliveryMethod),
                        deliveryAddress: order.deliveryAddress,
                        scheduledAt: (0, moment_timezone_1.default)(testItem.scheduledAt).format("YYYY-MM-DD hh:mm A"),
                        date: (0, moment_timezone_1.default)(testItem.date).format("YYYY-MM-DD"),
                        time: (0, moment_timezone_1.default)(testItem.time, "HH:mm").format("hh:mm A"),
                        updatedAt: order.updatedAt,
                        statusFlow: constant_1.ORDER_TEST_STATUS_FLOW,
                        terminalStatuses: constant_1.TERMINAL_TEST_STATUSES,
                        statusProgress
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getPawaPayConfirmationStatus(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { transactionId } = req.params;
                const orders = yield order_model_1.default.find({
                    "pawaPayInfo.depositId": transactionId,
                    paymentStatus: "paid"
                });
                if (!orders.length) {
                    return res.status(http_status_1.default.NOT_FOUND).json({
                        success: false,
                        message: "Order not yet created for this transaction."
                    });
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Order created and payment confirmed.",
                    data: {
                        orderCreated: true,
                        cartCleared: true,
                        orderIds: orders.map((order) => order.orderId)
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get All Orders with Patient Info for a Clinic
     */
    static getClinicOrdersForAutoComplete(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const orders = yield order_model_1.default
                    .find({ clinic: clinicId })
                    .select("orderId patient createdAt")
                    .sort({ createdAt: -1 })
                    .lean();
                const data = yield Promise.all(orders.map((order) => __awaiter(this, void 0, void 0, function* () {
                    const patient = yield patient_model_1.default
                        .findById(order.patient)
                        .select("fullName email")
                        .lean();
                    return {
                        orderId: order.orderId,
                        patientName: (patient === null || patient === void 0 ? void 0 : patient.fullName) || "Unknown",
                        patientEmail: (patient === null || patient === void 0 ? void 0 : patient.email) || ""
                    };
                })));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Orders with patient info retrieved successfully.",
                    data
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = OrderController;
