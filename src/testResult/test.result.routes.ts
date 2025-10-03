import express from "express"
import ClinicMiddleware from "../clinic/clinic.middleware"
import TestResultController from "./test.result.controller"
import { testResultUpload } from "../utils/multer"
import PatientMiddleware from "../patient/patient.middleware"
import asyncHandler from "../utils/async.handler"
import { ClinicAccessGuard } from "../clinic/clinic.access.guard"

const testResultRouter = express.Router()

testResultRouter.post(
  "/upload",
  ClinicMiddleware.authenticate,
  testResultUpload.single("resultFile"),
  ClinicAccessGuard,
  asyncHandler(TestResultController.uploadTestResult)
)

testResultRouter.get(
  "/clinic",
  ClinicMiddleware.authenticate,
  asyncHandler(TestResultController.getClinicTestResults)
)

testResultRouter.get(
  "/patient",
  PatientMiddleware.authenticate,
  asyncHandler(TestResultController.getPatientTestResults)
)

testResultRouter.post(
  "/resend-email/:testResultId",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(TestResultController.resendTestResultEmail)
)

export default testResultRouter
