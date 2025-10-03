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
exports.canUseSubscription = void 0;
const moment_1 = __importDefault(require("moment"));
const http_status_1 = __importDefault(require("http-status"));
const app_error_1 = __importDefault(require("../utils/app.error"));
const subscription_model_1 = __importDefault(require("./subscription.model"));
const canUseSubscription = (patientId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const subscription = yield subscription_model_1.default.findOne({
        patient: patientId,
        status: "active",
        isPaid: true
    });
    if (!subscription) {
        throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No active subscription found.");
    }
    const now = (0, moment_1.default)();
    const startDate = (0, moment_1.default)(subscription.startDate);
    // Enforce 72-hour activation delay
    const delayPassed = now.diff(startDate, "hours") >= 72;
    if (!delayPassed) {
        const remainingHours = 72 - now.diff(startDate, "hours");
        throw new app_error_1.default(http_status_1.default.FORBIDDEN, `Subscription will be usable in ${remainingHours} hour(s).`);
    }
    // Enforce 14-day rule between tests
    const lastDates = subscription.lastTestDates || [];
    const lastTestDate = lastDates.length
        ? (0, moment_1.default)(lastDates[lastDates.length - 1])
        : null;
    if (lastTestDate && now.diff(lastTestDate, "days") < 14) {
        const nextDate = lastTestDate.add(14, "days");
        throw new app_error_1.default(http_status_1.default.FORBIDDEN, `You can only use your subscription once every 14 days. Next usage: ${nextDate.format("dddd, MMMM D, YYYY")}`);
    }
    // Enforce 2-test monthly limit
    if (((_a = subscription.remainingTests) !== null && _a !== void 0 ? _a : 0) <= 0) {
        throw new app_error_1.default(http_status_1.default.FORBIDDEN, "You have used all 2 allowed tests for this month.");
    }
    return subscription;
});
exports.canUseSubscription = canUseSubscription;
