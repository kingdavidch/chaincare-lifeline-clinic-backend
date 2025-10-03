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
const app_error_1 = __importDefault(require("../utils/app.error"));
const utils_1 = require("../utils");
const subscription_model_1 = __importDefault(require("./subscription.model"));
const subscription_plans_1 = require("../constant/subscription.plans");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
require("dotenv/config");
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const moment_1 = __importDefault(require("moment"));
class SubscriptionController {
    /**
     * Subscribe to a Plan
     */
    static subscribe(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                (0, utils_1.handleRequiredFields)(req, ["id", "mtnNumber"]);
                const patient = yield patient_model_1.default.findById(patientId);
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const { id, mtnNumber } = req.body;
                const plan = subscription_plans_1.SUBSCRIPTION_PLANS.find((p) => p.id === id);
                if (!plan) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid subscription plan.");
                }
                const amountInRWF = plan.price;
                if (amountInRWF <= 0) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid payment amount.");
                }
                const depositPayload = {
                    depositId: (0, uuid_1.v4)(),
                    amount: amountInRWF.toString(),
                    currency: "RWF",
                    country: "RWA",
                    correspondent: "MTN_MOMO_RWA",
                    payer: {
                        type: "MSISDN",
                        address: { value: mtnNumber }
                    },
                    customerTimestamp: new Date().toISOString(),
                    statementDescription: "Subscription payment",
                    metadata: [
                        { fieldName: "type", fieldValue: "subscription" },
                        { fieldName: "patientId", fieldValue: patientId },
                        { fieldName: "subscriptionPlanId", fieldValue: String(plan.id) },
                        { fieldName: "customerPhone", fieldValue: mtnNumber }
                    ]
                };
                const response = yield axios_1.default.post(`${process.env.PAWAPAY_API_URL}/deposits`, depositPayload, {
                    headers: {
                        Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
                        "Content-Type": "application/json"
                    }
                });
                if (response.data.status !== "ACCEPTED") {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, response.data.rejectionReason || "Payment not accepted");
                }
                return res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Subscription payment initiated. Awaiting confirmation.",
                    paymentStatus: response.data.status,
                    depositId: response.data.depositId
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get Patient's Active Subscription
     */
    static getActiveSubscription(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const subscription = yield subscription_model_1.default
                    .findOne({ patient: patientId, status: "active" })
                    .select("planName price duration includedTests privilege initialPrivilege startDate endDate status isPaid")
                    .lean();
                if (!subscription) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No active subscription found.");
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Active subscription retrieved successfully.",
                    data: subscription
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Cancel Subscription
     */
    static cancelSubscription(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const subscription = yield subscription_model_1.default.findOneAndUpdate({ patient: patientId, status: "active" }, { status: "locked" }, { new: true });
                if (!subscription) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No active subscription found to cancel.");
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Subscription canceled successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get Patient's Subscription Privilege, Balance and Details
     */
    static getPatientPrivilegeAndBalance(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const patient = yield patient_model_1.default
                    .findById(patientId)
                    .select("fullName phoneNumber avatar")
                    .lean();
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const subscription = yield subscription_model_1.default
                    .findOne({ patient: patientId, status: "active" })
                    .select("planName monthlySpending startDate")
                    .lean();
                if (!subscription) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No active subscription found for this patient.");
                }
                const now = (0, moment_1.default)();
                const startDate = (0, moment_1.default)(subscription.startDate);
                const hoursSinceStart = now.diff(startDate, "hours");
                const isActive = hoursSinceStart >= 72;
                const activationTimeLeft = isActive ? 0 : 72 - hoursSinceStart;
                const privilege = ((_a = subscription.planName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === "premium" ? 68000 : 0;
                const totalSpent = (_c = (_b = subscription.monthlySpending) === null || _b === void 0 ? void 0 : _b.reduce((acc, month) => acc + ((month === null || month === void 0 ? void 0 : month.totalSpent) || 0), 0)) !== null && _c !== void 0 ? _c : 0;
                const balance = privilege - totalSpent;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Patient subscription privilege, balance and details retrieved successfully.",
                    data: {
                        patientName: patient.fullName,
                        phoneNumber: patient.phoneNumber,
                        avatar: patient.avatar,
                        subscription: subscription.planName,
                        privilege,
                        balance,
                        isActive,
                        activationTimeLeft // in hours
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = SubscriptionController;
