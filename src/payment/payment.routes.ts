import { Router } from "express"
import PaymentController from "./payment.controller"
import asyncHandler from "../utils/async.handler"
import PatientMiddleware from "../patient/patient.middleware"
import ClinicMiddleware from "../clinic/clinic.middleware"

const paymentRouter = Router()

paymentRouter.get("/channels", asyncHandler(PaymentController.getChannels))

paymentRouter.post(
  "/yellowcard/deposit",
  asyncHandler(PaymentController.submitDepositRequest)
)

paymentRouter.get(
  "/payments/:id",
  PatientMiddleware.authenticate,
  asyncHandler(PaymentController.getPaymentDetails)
)

paymentRouter.post(
  "/yellowcard/deposit-webhook",
  asyncHandler(PaymentController.handleYellowCardWebhook)
)

paymentRouter.post(
  "/p/d-w",
  asyncHandler(PaymentController.handlePawaPayWebhook)
)

paymentRouter.get(
  "/pawapay/details/:id",
  asyncHandler(PaymentController.getPawaPayPaymentDetails)
)

paymentRouter.post(
  "/p/p-w",
  asyncHandler(PaymentController.handlePawaPayPayoutWebhook)
)

paymentRouter.post(
  "/yellowcard/payout-webhook",
  asyncHandler(PaymentController.handleYellowCardPayoutWebhook)
)

paymentRouter.get(
  "/yellowcard/banks",
  ClinicMiddleware.authenticate,
  asyncHandler(PaymentController.getYellowCardBanksForCountry)
)

export default paymentRouter
