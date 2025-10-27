import { Router } from "express"
import DiscountController from "./discount.controller"
import ClinicMiddleware from "../clinic/clinic.middleware"
import asyncHandler from "../utils/async.handler"
import { ClinicAccessGuard } from "../clinic/clinic.access.guard"
import PatientMiddleware from "../patient/patient.middleware"

const discountRouter = Router()

discountRouter.post(
  "/clinic",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(DiscountController.createDiscount)
)

discountRouter.get(
  "/clinic",
  ClinicMiddleware.authenticate,
  asyncHandler(DiscountController.listClinicDiscounts)
)

discountRouter.delete(
  "/clinic/:id",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(DiscountController.deleteDiscount)
)

discountRouter.get(
  "/clinic/:clinicId",
  asyncHandler(DiscountController.getActiveDiscountsForClinic)
)

discountRouter.post(
  "/patient/apply",
  PatientMiddleware.authenticate,
  asyncHandler(DiscountController.applyDiscount)
)

discountRouter.post(
  "/public/apply",
  asyncHandler(DiscountController.applyDiscountPublic)
)

export default discountRouter
