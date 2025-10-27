import { Router } from "express"
import AdminController from "./admin.controller"
import asyncHandler from "../utils/async.handler"
import AdminMiddleware from "./admin.middleware"

const adminRouter = Router()

adminRouter.post("/on-board", asyncHandler(AdminController.signup))
adminRouter.post("/login", asyncHandler(AdminController.login))

adminRouter.post(
  "/forgot-password",
  asyncHandler(AdminController.forgotPassword)
)

adminRouter.patch(
  "/reset-password",
  asyncHandler(AdminController.resetPassword)
)

// Protected route
adminRouter.get(
  "/me",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getAdmin)
)

adminRouter.patch(
  "/me",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.updateAdminProfile)
)

adminRouter.get(
  "/notifications",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getAdminNotifications)
)

adminRouter.patch(
  "/notifications/mark-recent-two-as-read",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.markRecentTwoNotificationsAsRead)
)

adminRouter.patch(
  "/notifications/mark-all-as-read",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.markAllNotificationsAsRead)
)

// clinics
adminRouter.patch(
  "/clinic/verify-clinic-certificate/:clinicId",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.verifyClinicCertificate)
)

adminRouter.patch(
  "/clinic/verify-clinic-status/:clinicId",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.verifyClinicStatus)
)

adminRouter.get(
  "/clinics",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getAllClinics)
)

adminRouter.get(
  "/clinics/:id",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getClinicByAdmin)
)

adminRouter.patch(
  "/clinics/:clinicId",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.updateClinicProfile)
)

adminRouter.get(
  "/subscriptions/stats",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getSubscriptionStats)
)

adminRouter.delete(
  "/subscriptions/clear",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.clearAllSubscriptions)
)

adminRouter.get(
  "/customers/stats",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getStats)
)

adminRouter.get(
  "/earnings/overview",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getEarningsOverview)
)

adminRouter.get(
  "/sales/data",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getSalesData)
)

// tests
adminRouter.get(
  "/tests/popular",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getPopularTests)
)

adminRouter.get(
  "/tests",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getAllTests)
)

adminRouter.get(
  "/tests/:id",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getTestDetail)
)

adminRouter.get(
  "/test-items",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getAllTestItem)
)

adminRouter.post(
  "/test-items",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.addTestItem)
)

adminRouter.patch(
  "/tests/item/:id",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.updateTestItem)
)

adminRouter.delete(
  "/test/:testId",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.deleteTest)
)

adminRouter.get(
  "/tests/all/deleted",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getDeletedTests)
)

adminRouter.patch(
  "/tests/:id",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.updateTest)
)

adminRouter.patch(
  "/test/restore/:testId",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.restoreDeletedTest)
)

adminRouter.delete(
  "/test-item/:id",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.deleteTestItem)
)

adminRouter.get(
  "/patients/metrics",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getPatientMetrics)
)

adminRouter.get(
  "/patients",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getAllPatients)
)

adminRouter.get(
  "/patients/:patientId/claims",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getPatientClaimHistory)
)

adminRouter.get(
  "/clinics/:clinicId/claims-history",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getClinicClaimsHistory)
)

adminRouter.get(
  "/clinics/stats/all",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getClinicMetrics)
)

adminRouter.get(
  "/claims",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getAllClaims)
)

adminRouter.get(
  "/orders",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getAllOrders)
)

adminRouter.get(
  "/order/:orderId",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getOrderDetailsByAdmin)
)

adminRouter.get(
  "/test/images",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getCloudinaryImages)
)

adminRouter.delete(
  "/purge/clinic",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.purgeClinicOrPatient)
)

adminRouter.post(
  "/clinics/create",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.createSingleClinic)
)

// Clear all notifications
adminRouter.delete(
  "/notifications/clear",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.clearAdminNotifications)
)

// Create a new practitioner category
adminRouter.post(
  "/practitioner-categories",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.createPractitionerCategory)
)

// Update an existing practitioner category
adminRouter.put(
  "/practitioner-categories/:id",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.updatePractitionerCategory)
)

// Delete a practitioner category
adminRouter.delete(
  "/practitioner-categories/:id",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.deletePractitionerCategory)
)

adminRouter.get(
  "/practitioner-categories",
  AdminMiddleware.authenticate,
  asyncHandler(AdminController.getAllCategoriesForAdmin)
)

export default adminRouter
