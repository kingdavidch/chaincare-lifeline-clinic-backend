import { Router } from "express"
import ClinicController from "./clinic.controller"
import ClinicMiddleware from "./clinic.middleware"
import asyncHandler from "../utils/async.handler"
import { avatarUpload, certificateUpload } from "../utils/multer"
import { ClinicAccessGuard } from "./clinic.access.guard"

const clinicRouter = Router()

// Auth Routes

// User authentication routes
clinicRouter.post("/signup", asyncHandler(ClinicController.signup))

clinicRouter.post("/login", asyncHandler(ClinicController.login))

clinicRouter.post("/refresh-token", asyncHandler(ClinicController.refreshToken))

clinicRouter.post("/logout", asyncHandler(ClinicController.logout))

// Password reset routes (using email reset link instead of OTP)
clinicRouter.post(
  "/forgot-password",
  asyncHandler(ClinicController.forgotPassword)
)

clinicRouter.patch(
  "/reset-password",
  asyncHandler(ClinicController.resetPassword)
)

// Email verification routes
clinicRouter.get("/verify", asyncHandler(ClinicController.verifyClinic))

clinicRouter.post(
  "/resend-verification",
  asyncHandler(ClinicController.resendVerificationLink)
)

// Protected Routes
clinicRouter.get(
  "/me",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getClinic)
)

clinicRouter.patch(
  "/settings",
  ClinicMiddleware.authenticate,
  avatarUpload.single("avatar"),
  asyncHandler(ClinicController.updateClinicProfile)
)

clinicRouter.get(
  "/patients/metrics",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getPatientMetrics)
)

clinicRouter.get(
  "/patients",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getAllPatients)
)

clinicRouter.get(
  "/earnings",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getEarnings)
)

clinicRouter.get(
  "/earnings-overview",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getEarningsOverview)
)

clinicRouter.get(
  "/withdrawal/stats",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getWithdrawalStats)
)

clinicRouter.get(
  "/test-distribution",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getTestDistribution)
)

clinicRouter.get(
  "/test-sales",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getTestSales)
)

clinicRouter.get(
  "/popular-tests",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getPopularTests)
)

clinicRouter.get(
  "/notifications",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getClinicNotifications)
)

clinicRouter.patch(
  "/notifications/mark-recent-two-as-read",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.markRecentTwoNotificationsAsRead)
)

clinicRouter.patch(
  "/notifications/mark-all-as-read",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.markAllNotificationsAsRead)
)

clinicRouter.patch(
  "/upload-certificate",
  ClinicMiddleware.authenticate,
  certificateUpload.single("certificate"),
  asyncHandler(ClinicController.uploadCertificate)
)

clinicRouter.patch(
  "/accept-contract",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.acceptContract)
)

clinicRouter.post(
  "/withdraw/pawapay",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(ClinicController.withdrawToMobileMoney)
)

clinicRouter.get(
  "/withdrawals",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.getClinicWithdrawals)
)

clinicRouter.get(
  "/pawapay/payout/:payoutId",
  asyncHandler(ClinicController.getPawaPayPayoutStatus)
)

clinicRouter.post(
  "/withdraw/yellowcard",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(ClinicController.withdrawToBankWithYellowCard)
)

clinicRouter.delete(
  "/notifications/clear",
  ClinicMiddleware.authenticate,
  asyncHandler(ClinicController.clearClinicNotifications)
)

export default clinicRouter
