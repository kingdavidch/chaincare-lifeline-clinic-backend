"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clinic_middleware_1 = __importDefault(require("../clinic/clinic.middleware"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const test_controller_1 = __importDefault(require("./test.controller"));
const patient_middleware_1 = __importDefault(require("../patient/patient.middleware"));
const clinic_access_guard_1 = require("../clinic/clinic.access.guard");
const testRouter = (0, express_1.Router)();
// Create a new test
testRouter.post("/", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(test_controller_1.default.createTest));
testRouter.post("/test-items", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(test_controller_1.default.addTestItemByClinic));
// Update a test item (clinic)
testRouter.patch("/test-items/:id", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(test_controller_1.default.clinicUpdateTestItem));
// Get all clinic test items
testRouter.get("/clinics/test-items", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.getAllClinicTestItems));
// Delete a test item (clinic)
testRouter.delete("/test-items/:id", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(test_controller_1.default.clinicDeleteTestItem));
// Get test details(Clinic)
testRouter.get("/:id", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.getTestDetail));
// Get test details (patient)
testRouter.get("/:id/patient", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.getTestDetailForPatient));
// Get all tests (Patient)
testRouter.get("/patient/all", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.patientGetAllTests));
// Update a test by ID
testRouter.patch("/:id", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.updateTest));
// Soft remove a test by ID
testRouter.delete("/:id", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(test_controller_1.default.removeTest));
testRouter.get("/clinic/all", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.getClinicTests));
// Get all test names
testRouter.get("/names/all", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.getTestNames));
testRouter.get("/clinic/tests/all", (0, async_handler_1.default)(test_controller_1.default.getAllTests));
// Route to bulk upload 25 test records
testRouter.post("/bulk-upload", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.bulkUploadTests));
testRouter.get("/clinics/similar-test/:testId", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.getClinicsWithSameTest));
// Get supported tests with clinic status
testRouter.get("/clinic/supported-tests", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(test_controller_1.default.getSupportedTestsWithStatus));
testRouter.get("/test/images", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(test_controller_1.default.getCloudinaryImages));
exports.default = testRouter;
