import { Router } from "express"
import SubscriptionController from "../subscription/subscription.controller"
import PatientMiddleware from "../patient/patient.middleware"
import asyncHandler from "../utils/async.handler"

const subscriptionRouter = Router()

// Subscribe to a plan
subscriptionRouter.post(
  "/subscribe",
  PatientMiddleware.authenticate,
  asyncHandler(SubscriptionController.subscribe)
)

// Get active subscription
subscriptionRouter.get(
  "/active",
  PatientMiddleware.authenticate,
  asyncHandler(SubscriptionController.getActiveSubscription)
)

// Cancel subscription
subscriptionRouter.delete(
  "/cancel",
  PatientMiddleware.authenticate,
  asyncHandler(SubscriptionController.cancelSubscription)
)

// Get patient's privilege, balance and details
subscriptionRouter.get(
  "/privilege-balance",
  PatientMiddleware.authenticate,
  asyncHandler(SubscriptionController.getPatientPrivilegeAndBalance)
)

export default subscriptionRouter
