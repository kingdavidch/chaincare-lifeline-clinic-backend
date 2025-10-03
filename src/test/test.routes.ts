import { Router } from "express"
import ClinicMiddleware from "../clinic/clinic.middleware"
import asyncHandler from "../utils/async.handler"
import TestController from "./test.controller"
import PatientMiddleware from "../patient/patient.middleware"
import { ClinicAccessGuard } from "../clinic/clinic.access.guard"

const testRouter = Router()

// Create a new test
testRouter.post(
  "/",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(TestController.createTest)
)

testRouter.post(
  "/test-items",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(TestController.addTestItemByClinic)
)

// Update a test item (clinic)
testRouter.patch(
  "/test-items/:id",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(TestController.clinicUpdateTestItem)
)

// Get all clinic test items
testRouter.get(
  "/clinics/test-items",
  ClinicMiddleware.authenticate,
  asyncHandler(TestController.getAllClinicTestItems)
)

// Delete a test item (clinic)
testRouter.delete(
  "/test-items/:id",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(TestController.clinicDeleteTestItem)
)

// Get test details(Clinic)
testRouter.get(
  "/:id",
  ClinicMiddleware.authenticate,
  asyncHandler(TestController.getTestDetail)
)

// Get test details (patient)
testRouter.get(
  "/:id/patient",
  PatientMiddleware.authenticate,
  asyncHandler(TestController.getTestDetailForPatient)
)

// Get all tests (Patient)
testRouter.get(
  "/patient/all",
  PatientMiddleware.authenticate,
  asyncHandler(TestController.patientGetAllTests)
)

// Update a test by ID
testRouter.patch(
  "/:id",
  ClinicMiddleware.authenticate,
  asyncHandler(TestController.updateTest)
)

// Soft remove a test by ID
testRouter.delete(
  "/:id",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(TestController.removeTest)
)

testRouter.get(
  "/clinic/all",
  ClinicMiddleware.authenticate,
  asyncHandler(TestController.getClinicTests)
)

// Get all test names
testRouter.get(
  "/names/all",
  ClinicMiddleware.authenticate,
  asyncHandler(TestController.getTestNames)
)

testRouter.get("/clinic/tests/all", asyncHandler(TestController.getAllTests))

// Route to bulk upload 25 test records
testRouter.post(
  "/bulk-upload",
  ClinicMiddleware.authenticate,
  asyncHandler(TestController.bulkUploadTests)
)

testRouter.delete(
  "/clear-tests",
  ClinicMiddleware.authenticate,
  asyncHandler(TestController.clearAllTests)
)

testRouter.get(
  "/clinics/similar-test/:testId",
  PatientMiddleware.authenticate,
  asyncHandler(TestController.getClinicsWithSameTest)
)

// Get supported tests with clinic status
testRouter.get(
  "/clinic/supported-tests",
  ClinicMiddleware.authenticate,
  ClinicAccessGuard,
  asyncHandler(TestController.getSupportedTestsWithStatus)
)

testRouter.get(
  "/test/images",
  ClinicMiddleware.authenticate,
  asyncHandler(TestController.getCloudinaryImages)
)

export default testRouter
