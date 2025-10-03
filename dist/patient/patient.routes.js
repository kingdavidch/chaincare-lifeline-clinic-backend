"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const patient_controller_1 = __importDefault(require("./patient.controller"));
const patient_middleware_1 = __importDefault(require("./patient.middleware"));
const multer_1 = require("../utils/multer");
const patientRouter = express_1.default.Router();
// Patient Signup
patientRouter.post("/signup", (0, async_handler_1.default)(patient_controller_1.default.signUp));
// Patient Login
patientRouter.post("/login", (0, async_handler_1.default)(patient_controller_1.default.login));
patientRouter.post("/google-login", (0, async_handler_1.default)(patient_controller_1.default.googleLogin));
// Verify OTP (For Email Verification)
patientRouter.post("/verify-otp", (0, async_handler_1.default)(patient_controller_1.default.verifyEmailOtp));
// Resend OTP
patientRouter.post("/resend-otp", (0, async_handler_1.default)(patient_controller_1.default.resendOtp));
// Request Password Reset (Sends OTP)
patientRouter.post("/forgot-password", (0, async_handler_1.default)(patient_controller_1.default.requestPasswordReset));
// Reset Password (Using OTP)
patientRouter.patch("/reset-password", (0, async_handler_1.default)(patient_controller_1.default.resetPassword));
// (Only authenticated users)
// Get Patient Profile
patientRouter.get("/profile", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.getPatientProfile));
patientRouter.delete("/delete-patient", patient_controller_1.default.deletePatient);
patientRouter.patch("/profile", patient_middleware_1.default.authenticate, multer_1.avatarUpload.single("avatar"), (0, async_handler_1.default)(patient_controller_1.default.updatePatientProfile));
patientRouter.post("/insurance", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.addInsurance));
// Update Insurance
patientRouter.patch("/insurance/:insuranceId", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.updateInsurance));
// Delete Insurance
patientRouter.delete("/insurance/:insuranceId", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.deleteInsurance));
// Get clinics providing a specific test
patientRouter.get("/tests/:testId/clinics", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.getClinicsForTest));
// Get all clinics
patientRouter.get("/clinics", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.getAllClinics));
// Get top 3 clinics based on overall rating
patientRouter.get("/clinics/top", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.getTopClinics));
// Get supported insurance providers
patientRouter.get("/insurance", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.getSupportedInsurance));
// View a specific clinic
patientRouter.get("/clinics/:clinicId", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.getClinicDetails));
// Delete a patient by email
patientRouter.delete("/delete-patient", (0, async_handler_1.default)(patient_controller_1.default.deletePatientByEmail));
// Get all patients
patientRouter.get("/all-patients", (0, async_handler_1.default)(patient_controller_1.default.getAllPatients));
patientRouter.get("/notifications", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.getPatientNotifications));
patientRouter.patch("/notifications/mark-all-read", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.markAllAsRead));
// Clear all notifications
patientRouter.delete("/notifications/clear", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.clearPatientNotifications));
patientRouter.patch("/notifications/:id/mark-read", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.markOneAsRead));
patientRouter.post("/push-token", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.savePushToken));
patientRouter.delete("/delete/account", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(patient_controller_1.default.deletePatientAccount));
patientRouter.patch("/reactivate-patient", (0, async_handler_1.default)(patient_controller_1.default.reactivatePatientByEmail));
exports.default = patientRouter;
