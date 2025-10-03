import { Router } from "express"
import ClaimController from "./claim.controller"
import ClinicMiddleware from "../clinic/clinic.middleware"
import asyncHandler from "../utils/async.handler"
import { ClinicAccessGuard } from "../clinic/clinic.access.guard"

const claimRouter = Router()

claimRouter.post(
  "/add",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(ClaimController.addClaim)
)
claimRouter.get(
  "/all",
  ClinicMiddleware.authenticate,
  asyncHandler(ClaimController.getAllClaims)
)
claimRouter.get(
  "/history/:patientId",
  ClinicMiddleware.authenticate,
  asyncHandler(ClaimController.getPatientClaimHistory)
)

claimRouter.delete(
  "/clear-claims/:email",
  asyncHandler(ClaimController.clearPatientClaims)
)

export default claimRouter
