import { Router } from "express"
import PatientMiddleware from "../patient/patient.middleware"
import OrderController from "./order.controller"
import asyncHandler from "../utils/async.handler"
import ClinicMiddleware from "../clinic/clinic.middleware"
import { ClinicAccessGuard } from "../clinic/clinic.access.guard"

const orderRouter = Router()

// Patient routes
orderRouter.post(
  "/checkout",
  PatientMiddleware.authenticate,
  asyncHandler(OrderController.checkout)
)

orderRouter.get(
  "/patient/orders",
  PatientMiddleware.authenticate,
  asyncHandler(OrderController.getUserOrders)
)

// Update delivery address
orderRouter.patch(
  "/:orderId/delivery-address",
  PatientMiddleware.authenticate,
  asyncHandler(OrderController.updateDeliveryAddress)
)

orderRouter.patch(
  "/:orderId/payment-method",
  PatientMiddleware.authenticate,
  asyncHandler(OrderController.updateOrderPaymentMethod)
)

// Clinic routes
orderRouter.get(
  "/clinic/orders",
  ClinicMiddleware.authenticate,
  asyncHandler(OrderController.getClinicOrders)
)

// Clinic routes
orderRouter.get(
  "/clinic/order-ids",
  ClinicMiddleware.authenticate,
  asyncHandler(OrderController.getClinicOrdersForAutoComplete)
)

orderRouter.get(
  "/clinic/order/:orderId",
  ClinicMiddleware.authenticate,
  asyncHandler(OrderController.getClinicOrderDetails)
)
orderRouter.patch(
  "/clinic/orders/:id/tests/:testId/status",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(OrderController.updateOrderTestStatus)
)

orderRouter.get(
  "/patient/orders/:orderId/tests/:testId/details",
  PatientMiddleware.authenticate,
  asyncHandler(OrderController.getOrderTestDetails)
)

orderRouter.get(
  "/payment/pawapay/confirmation-status/:transactionId",
  asyncHandler(OrderController.getPawaPayConfirmationStatus)
)

export default orderRouter
