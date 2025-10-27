"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clinic_controller_1 = __importDefault(require("./clinic.controller"));
const clinic_middleware_1 = __importDefault(require("./clinic.middleware"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const multer_1 = require("../utils/multer");
const clinic_access_guard_1 = require("./clinic.access.guard");
const clinicRouter = (0, express_1.Router)();
// Auth Routes
// User authentication routes
clinicRouter.post("/signup", (0, async_handler_1.default)(clinic_controller_1.default.signup));
clinicRouter.post("/login", (0, async_handler_1.default)(clinic_controller_1.default.login));
clinicRouter.post("/refresh-token", (0, async_handler_1.default)(clinic_controller_1.default.refreshToken));
clinicRouter.post("/logout", (0, async_handler_1.default)(clinic_controller_1.default.logout));
// Password reset routes (using email reset link instead of OTP)
clinicRouter.post("/forgot-password", (0, async_handler_1.default)(clinic_controller_1.default.forgotPassword));
clinicRouter.patch("/reset-password", (0, async_handler_1.default)(clinic_controller_1.default.resetPassword));
// Email verification routes
clinicRouter.get("/verify", (0, async_handler_1.default)(clinic_controller_1.default.verifyClinic));
clinicRouter.post("/resend-verification", (0, async_handler_1.default)(clinic_controller_1.default.resendVerificationLink));
// Protected Routes
clinicRouter.get("/me", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getClinic));
clinicRouter.patch("/settings", clinic_middleware_1.default.authenticate, multer_1.avatarUpload.single("avatar"), (0, async_handler_1.default)(clinic_controller_1.default.updateClinicProfile));
clinicRouter.get("/patients/metrics", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getPatientMetrics));
clinicRouter.get("/patients", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getAllPatients));
clinicRouter.get("/earnings", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getEarnings));
clinicRouter.get("/earnings-overview", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getEarningsOverview));
clinicRouter.get("/withdrawal/stats", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getWithdrawalStats));
clinicRouter.get("/test-distribution", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getTestDistribution));
clinicRouter.get("/test-sales", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getTestSales));
clinicRouter.get("/popular-tests", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getPopularTests));
clinicRouter.get("/notifications", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getClinicNotifications));
clinicRouter.patch("/notifications/mark-recent-two-as-read", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.markRecentTwoNotificationsAsRead));
clinicRouter.patch("/notifications/mark-all-as-read", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.markAllNotificationsAsRead));
clinicRouter.patch("/upload-certificate", clinic_middleware_1.default.authenticate, multer_1.certificateUpload.single("certificate"), (0, async_handler_1.default)(clinic_controller_1.default.uploadCertificate));
clinicRouter.patch("/accept-contract", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.acceptContract));
clinicRouter.post("/withdraw/pawapay", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(clinic_controller_1.default.withdrawToMobileMoney));
clinicRouter.get("/withdrawals", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getClinicWithdrawals));
clinicRouter.get("/pawapay/payout/:payoutId", (0, async_handler_1.default)(clinic_controller_1.default.getPawaPayPayoutStatus));
clinicRouter.post("/withdraw/yellowcard", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(clinic_controller_1.default.withdrawToBankWithYellowCard));
clinicRouter.delete("/notifications/clear", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.clearClinicNotifications));
clinicRouter.get("/public/:username", (0, async_handler_1.default)(clinic_controller_1.default.getPublicClinicDetails));
clinicRouter.put("/categories/update", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.updateClinicCategories));
clinicRouter.get("/practitioner-categories", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(clinic_controller_1.default.getAllCategoriesForClinic));
exports.default = clinicRouter;
