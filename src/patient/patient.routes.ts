import express from "express"
import asyncHandler from "../utils/async.handler"
import PatientController from "./patient.controller"
import PatientMiddleware from "./patient.middleware"
import { avatarUpload } from "../utils/multer"

const patientRouter = express.Router()

// Patient Signup
patientRouter.post("/signup", asyncHandler(PatientController.signUp))

// Patient Login
patientRouter.post("/login", asyncHandler(PatientController.login))

patientRouter.post("/google-login", asyncHandler(PatientController.googleLogin))

// Verify OTP (For Email Verification)
patientRouter.post(
  "/verify-otp",
  asyncHandler(PatientController.verifyEmailOtp)
)

// Resend OTP
patientRouter.post("/resend-otp", asyncHandler(PatientController.resendOtp))

// Request Password Reset (Sends OTP)
patientRouter.post(
  "/forgot-password",
  asyncHandler(PatientController.requestPasswordReset)
)

// Reset Password (Using OTP)
patientRouter.patch(
  "/reset-password",
  asyncHandler(PatientController.resetPassword)
)

// (Only authenticated users)
// Get Patient Profile
patientRouter.get(
  "/profile",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.getPatientProfile)
)

patientRouter.delete("/delete-patient", PatientController.deletePatient)

patientRouter.patch(
  "/profile",
  PatientMiddleware.authenticate,
  avatarUpload.single("avatar"),
  asyncHandler(PatientController.updatePatientProfile)
)

patientRouter.post(
  "/insurance",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.addInsurance)
)

// Update Insurance
patientRouter.patch(
  "/insurance/:insuranceId",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.updateInsurance)
)

// Delete Insurance
patientRouter.delete(
  "/insurance/:insuranceId",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.deleteInsurance)
)

// Get clinics providing a specific test
patientRouter.get(
  "/tests/:testId/clinics",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.getClinicsForTest)
)

// Get all clinics
patientRouter.get(
  "/clinics",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.getAllClinics)
)

// Get top 3 clinics based on overall rating
patientRouter.get(
  "/clinics/top",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.getTopClinics)
)

// Get supported insurance providers
patientRouter.get(
  "/insurance",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.getSupportedInsurance)
)

// View a specific clinic
patientRouter.get(
  "/clinics/:clinicId",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.getClinicDetails)
)

// Delete a patient by email
patientRouter.delete(
  "/delete-patient",
  asyncHandler(PatientController.deletePatientByEmail)
)

// Get all patients
patientRouter.get(
  "/all-patients",
  asyncHandler(PatientController.getAllPatients)
)

patientRouter.get(
  "/notifications",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.getPatientNotifications)
)

patientRouter.patch(
  "/notifications/mark-all-read",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.markAllAsRead)
)

// Clear all notifications
patientRouter.delete(
  "/notifications/clear",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.clearPatientNotifications)
)

patientRouter.patch(
  "/notifications/:id/mark-read",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.markOneAsRead)
)

patientRouter.post(
  "/push-token",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.savePushToken)
)

patientRouter.delete(
  "/delete/account",
  PatientMiddleware.authenticate,
  asyncHandler(PatientController.deletePatientAccount)
)

patientRouter.patch(
  "/reactivate-patient",
  asyncHandler(PatientController.reactivatePatientByEmail)
)

export default patientRouter
