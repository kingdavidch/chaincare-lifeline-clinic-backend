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
const http_status_1 = __importDefault(require("http-status"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const clinic_notification_model_1 = __importDefault(require("../clinic/clinic.notification.model"));
const order_model_1 = __importDefault(require("../order/order.model"));
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const patient_notification_model_1 = __importDefault(require("../patient/patient.notification.model"));
const smtp_test_result_service_1 = __importDefault(require("../smtp/testResult/smtp.test.result.service"));
const test_item_model_1 = __importDefault(require("../test/test.item.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
const testBooking_model_1 = __importDefault(require("../testBooking(Cart)/testBooking.model"));
const utils_1 = require("../utils");
const app_error_1 = __importDefault(require("../utils/app.error"));
const sendPushNotification_1 = require("../utils/sendPushNotification");
const test_result_model_1 = __importDefault(require("./test.result.model"));
const utils_2 = require("../order/utils");
class TestResultController {
    static uploadTestResult(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["orderId", "testName"]);
                const { orderId, testName } = req.body;
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId).select("clinicName");
                if (!clinic)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                const order = yield order_model_1.default.findOne({ orderId, clinic: clinicId });
                if (!order)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Order not found.");
                const patient = yield patient_model_1.default
                    .findById(order.patient)
                    .select("fullName email expoPushToken");
                if (!patient)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                const test = yield test_model_1.default.findOne({
                    testName: { $regex: new RegExp(`^${testName.toLowerCase()}$`, "i") },
                    clinic: clinicId
                });
                if (!test)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                const orderTest = order.tests.find((t) => String(t.test) === String(test._id));
                if (!orderTest) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "This test is not part of this order.");
                }
                if (!req.file) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Test result file is required.");
                }
                const testBooking = yield testBooking_model_1.default.findOne({
                    patient: patient._id,
                    test: test._id,
                    clinic: clinicId
                });
                if (!testBooking) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Appointments booking not found for this patient and test.");
                }
                const publicId = `${patient.fullName}_${test.testName}.pdf`;
                const result = yield (0, utils_1.uploadToCloudinary)(req.file.buffer, "raw", "test_results", { public_id: publicId });
                const refNo = `REF-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
                const existingResult = yield test_result_model_1.default.findOne({
                    order: order._id,
                    test: test._id,
                    clinic: clinicId
                });
                if (existingResult) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Result already uploaded for this order and test.");
                }
                const testResult = yield new test_result_model_1.default({
                    refNo,
                    testBooking: testBooking._id,
                    patient: patient._id,
                    test: test._id,
                    clinic: clinicId,
                    order: order._id,
                    orderId: order.orderId,
                    resultFile: result.secure_url,
                    uploadedAt: new Date(),
                    resultSent: true
                }).save();
                const statusFlow = [
                    "pending",
                    "sample_collected",
                    "processing",
                    "result_ready",
                    "result_sent"
                ];
                const currentStatus = orderTest.status;
                const currentIndex = statusFlow.indexOf(currentStatus);
                const finalIndex = statusFlow.indexOf("result_sent");
                const statusesToFill = currentIndex === -1
                    ? statusFlow.slice(0, finalIndex + 1)
                    : statusFlow.slice(currentIndex + 1, finalIndex + 1);
                const now = new Date();
                const historyEntries = statusesToFill.map((s) => ({
                    status: s,
                    changedAt: now
                }));
                yield order_model_1.default.updateOne({ _id: order._id, "tests.test": test._id }, {
                    $set: {
                        "tests.$.status": "result_sent",
                        "tests.$.statusReason": "Result uploaded and sent by clinic"
                    },
                    $push: {
                        "tests.$.statusHistory": { $each: historyEntries }
                    }
                });
                const newNotification = yield patient_notification_model_1.default.create({
                    patient: patient._id,
                    title: "Test Results Sent",
                    message: `Your ${(0, utils_2.formatCase)(test.testName)} test results have been sent. Reference No: ${refNo}`,
                    type: "test result",
                    isRead: false,
                    metadata: { resultUrl: result.secure_url }
                });
                if (patient.expoPushToken) {
                    yield (0, sendPushNotification_1.sendPushNotification)({
                        expoPushToken: patient.expoPushToken,
                        title: newNotification.title,
                        message: newNotification.message,
                        type: newNotification.type,
                        data: { resultUrl: result.secure_url, screen: "test_history" }
                    });
                }
                yield smtp_test_result_service_1.default.sendTestResultEmail(patient, {
                    refNo,
                    testName: test.testName,
                    clinicName: clinic.clinicName,
                    testDate: new Date(order.createdAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        day: "numeric",
                        month: "short"
                    }),
                    resultDate: new Date(testResult.createdAt || Date.now()).toLocaleDateString("en-US", {
                        weekday: "short",
                        day: "numeric",
                        month: "short"
                    }),
                    resultUrl: result.secure_url
                }).catch((error) => console.error("Error sending email:", error));
                yield clinic_notification_model_1.default.create({
                    clinic: clinicId,
                    title: "Test Result Sent",
                    message: `Test result for ${patient.fullName} (${test.testName}) has been sent.`,
                    type: "test result",
                    isRead: false
                });
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Appointments result uploaded and status updated to 'result_sent'."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getClinicTestResults(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { page = "1", date } = req.query;
                const pageNumber = parseInt(page, 10) || 1;
                const baseLimit = 10;
                const limit = baseLimit * pageNumber;
                const skip = 0;
                const filter = { clinic: clinicId };
                if (date) {
                    const startDate = new Date(date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(date);
                    endDate.setHours(23, 59, 59, 999);
                    filter.uploadedAt = { $gte: startDate, $lte: endDate };
                }
                const testResults = yield test_result_model_1.default
                    .find(filter)
                    .select("testBooking test refNo uploadedAt resultFile clinic _id orderId")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();
                const totalTestResultsInDatabase = yield test_result_model_1.default.countDocuments({
                    clinic: clinicId
                });
                const formattedResults = yield Promise.all(testResults.map((result) => __awaiter(this, void 0, void 0, function* () {
                    const testBooking = yield testBooking_model_1.default.findById(result.testBooking);
                    if (!testBooking || testBooking.clinic.toString() !== clinicId) {
                        return null;
                    }
                    const patient = yield patient_model_1.default
                        .findById(testBooking.patient)
                        .select("fullName");
                    const test = yield test_model_1.default
                        .findById(result.test)
                        .setOptions({ includeDeleted: true })
                        .select("testName")
                        .lean();
                    return {
                        id: result._id,
                        refNo: result.refNo,
                        orderId: result.orderId,
                        patientName: patient === null || patient === void 0 ? void 0 : patient.fullName,
                        testName: (test === null || test === void 0 ? void 0 : test.testName) || "Deleted Test",
                        resultFile: result === null || result === void 0 ? void 0 : result.resultFile,
                        date: `${new Date(result === null || result === void 0 ? void 0 : result.uploadedAt).getDate()}-${(new Date(result.uploadedAt).getMonth() + 1)
                            .toString()
                            .padStart(2, "0")}-${new Date(result === null || result === void 0 ? void 0 : result.uploadedAt).getFullYear()}`,
                        time: new Date(result.uploadedAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true
                        })
                    };
                })));
                const filteredResults = formattedResults.filter((r) => r !== null);
                const totalResults = yield test_result_model_1.default.countDocuments(filter);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic test results retrieved successfully.",
                    data: filteredResults,
                    hasNoTestResults: totalTestResultsInDatabase === 0,
                    pagination: {
                        currentPage: pageNumber,
                        totalPages: Math.ceil(totalResults / baseLimit),
                        totalResults
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getPatientTestResults(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { page = "1", sort } = req.query;
                const pageNumber = parseInt(page, 10) || 1;
                const limitNumber = 4;
                const skip = (pageNumber - 1) * limitNumber;
                const filter = { patient: patientId };
                const query = test_result_model_1.default
                    .find(filter)
                    .select("testBooking test refNo uploadedAt resultFile")
                    .sort(sort === "oldest"
                    ? { uploadedAt: 1 }
                    : sort === "newest"
                        ? { uploadedAt: -1 }
                        : {})
                    .skip(skip)
                    .limit(limitNumber);
                const testResults = yield query.lean();
                const allTestItems = yield test_item_model_1.default.find().select("name image");
                const formattedResults = yield Promise.all(testResults.map((result) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const testBooking = yield testBooking_model_1.default.findById(result.testBooking);
                    if (!testBooking)
                        return null;
                    const test = yield test_model_1.default
                        .findById(result.test)
                        .setOptions({ includeDeleted: true })
                        .select("testName")
                        .lean();
                    const clinic = yield clinic_model_1.default
                        .findById(testBooking.clinic)
                        .select("clinicName");
                    const testImage = ((_a = allTestItems.find((ti) => { var _a; return ti.name.toLowerCase() === ((_a = test === null || test === void 0 ? void 0 : test.testName) === null || _a === void 0 ? void 0 : _a.toLowerCase()); })) === null || _a === void 0 ? void 0 : _a.image) || "";
                    return {
                        testName: (test === null || test === void 0 ? void 0 : test.testName) || "Deleted Test",
                        testImage,
                        refNo: result.refNo,
                        resultFile: result.resultFile,
                        clinicName: (clinic === null || clinic === void 0 ? void 0 : clinic.clinicName) || "",
                        date: new Date(result.uploadedAt).toLocaleDateString("en-US", {
                            weekday: "short",
                            day: "numeric",
                            month: "short"
                        }),
                        status: "SUCCESS",
                        uploadedAt: result.uploadedAt
                    };
                })));
                const filteredResults = formattedResults.filter(Boolean);
                const totalResults = yield test_result_model_1.default.countDocuments(filter);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test results retrieved successfully.",
                    data: filteredResults,
                    pagination: {
                        currentPage: pageNumber,
                        totalPages: Math.ceil(totalResults / limitNumber),
                        totalResults
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static resendTestResultEmail(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { testResultId } = req.params;
                const clinicId = (0, utils_1.getClinicId)(req);
                const testResult = yield test_result_model_1.default.findOne({
                    _id: testResultId,
                    clinic: clinicId
                });
                if (!testResult) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Session result not found or does not belong to this clinic.");
                }
                const patient = yield patient_model_1.default
                    .findById(testResult.patient)
                    .select("fullName email");
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const test = yield test_model_1.default.findById(testResult.test).select("testName");
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Appointments not found.");
                }
                const testBooking = yield testBooking_model_1.default
                    .findById(testResult.testBooking)
                    .select("clinic date");
                if (!testBooking) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Appointments booking not found.");
                }
                const clinic = yield clinic_model_1.default
                    .findById(testBooking.clinic)
                    .select("clinicName");
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                yield smtp_test_result_service_1.default.sendTestResultEmail(patient, {
                    refNo: testResult.refNo,
                    testName: test.testName,
                    clinicName: clinic.clinicName,
                    testDate: new Date(testBooking.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        day: "numeric",
                        month: "short"
                    }),
                    resultDate: new Date(testResult.createdAt || Date.now()).toLocaleDateString("en-US", {
                        weekday: "short",
                        day: "numeric",
                        month: "short"
                    }),
                    resultUrl: testResult.resultFile
                })
                    .then(() => {
                    console.log("email sent");
                })
                    .catch((error) => {
                    console.error("Error sending email:", error);
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test result email resent successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = TestResultController;
