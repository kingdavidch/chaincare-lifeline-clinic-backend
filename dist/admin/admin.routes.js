"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = __importDefault(require("./admin.controller"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const admin_middleware_1 = __importDefault(require("./admin.middleware"));
const adminRouter = (0, express_1.Router)();
adminRouter.post("/on-board", (0, async_handler_1.default)(admin_controller_1.default.signup));
adminRouter.post("/login", (0, async_handler_1.default)(admin_controller_1.default.login));
adminRouter.post("/forgot-password", (0, async_handler_1.default)(admin_controller_1.default.forgotPassword));
adminRouter.patch("/reset-password", (0, async_handler_1.default)(admin_controller_1.default.resetPassword));
// Protected route
adminRouter.get("/me", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getAdmin));
adminRouter.patch("/me", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.updateAdminProfile));
adminRouter.get("/notifications", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getAdminNotifications));
adminRouter.patch("/notifications/mark-recent-two-as-read", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.markRecentTwoNotificationsAsRead));
adminRouter.patch("/notifications/mark-all-as-read", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.markAllNotificationsAsRead));
// clinics
adminRouter.patch("/clinic/verify-clinic-certificate/:clinicId", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.verifyClinicCertificate));
adminRouter.patch("/clinic/verify-clinic-status/:clinicId", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.verifyClinicStatus));
adminRouter.get("/clinics", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getAllClinics));
adminRouter.get("/clinics/:id", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getClinicByAdmin));
adminRouter.patch("/clinics/:clinicId", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.updateClinicProfile));
adminRouter.get("/subscriptions/stats", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getSubscriptionStats));
adminRouter.delete("/subscriptions/clear", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.clearAllSubscriptions));
adminRouter.get("/customers/stats", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getStats));
adminRouter.get("/earnings/overview", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getEarningsOverview));
adminRouter.get("/sales/data", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getSalesData));
// tests
adminRouter.get("/tests/popular", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getPopularTests));
adminRouter.get("/tests", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getAllTests));
adminRouter.get("/tests/:id", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getTestDetail));
adminRouter.get("/test-items", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getAllTestItem));
adminRouter.post("/test-items", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.addTestItem));
adminRouter.patch("/tests/item/:id", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.updateTestItem));
adminRouter.delete("/test/:testId", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.deleteTest));
adminRouter.get("/tests/all/deleted", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getDeletedTests));
adminRouter.patch("/tests/:id", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.updateTest));
adminRouter.patch("/test/restore/:testId", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.restoreDeletedTest));
adminRouter.delete("/test-item/:id", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.deleteTestItem));
adminRouter.get("/patients/metrics", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getPatientMetrics));
adminRouter.get("/patients", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getAllPatients));
adminRouter.get("/patients/:patientId/claims", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getPatientClaimHistory));
adminRouter.get("/clinics/:clinicId/claims-history", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getClinicClaimsHistory));
adminRouter.get("/clinics/stats/all", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getClinicMetrics));
adminRouter.get("/claims", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getAllClaims));
adminRouter.get("/orders", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getAllOrders));
adminRouter.get("/order/:orderId", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getOrderDetailsByAdmin));
adminRouter.get("/test/images", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getCloudinaryImages));
adminRouter.delete("/purge/clinic", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.purgeClinicOrPatient));
adminRouter.post("/clinics/create", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.createSingleClinic));
// Clear all notifications
adminRouter.delete("/notifications/clear", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.clearAdminNotifications));
// Create a new practitioner category
adminRouter.post("/practitioner-categories", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.createPractitionerCategory));
// Update an existing practitioner category
adminRouter.put("/practitioner-categories/:id", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.updatePractitionerCategory));
// Delete a practitioner category
adminRouter.delete("/practitioner-categories/:id", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.deletePractitionerCategory));
adminRouter.get("/practitioner-categories", admin_middleware_1.default.authenticate, (0, async_handler_1.default)(admin_controller_1.default.getAllCategoriesForAdmin));
exports.default = adminRouter;
