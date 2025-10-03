"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const clinic_middleware_1 = __importDefault(require("../clinic/clinic.middleware"));
const test_result_controller_1 = __importDefault(require("./test.result.controller"));
const multer_1 = require("../utils/multer");
const patient_middleware_1 = __importDefault(require("../patient/patient.middleware"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const clinic_access_guard_1 = require("../clinic/clinic.access.guard");
const testResultRouter = express_1.default.Router();
testResultRouter.post("/upload", clinic_middleware_1.default.authenticate, multer_1.testResultUpload.single("resultFile"), clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(test_result_controller_1.default.uploadTestResult));
testResultRouter.get("/clinic", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(test_result_controller_1.default.getClinicTestResults));
testResultRouter.get("/patient", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(test_result_controller_1.default.getPatientTestResults));
testResultRouter.post("/resend-email/:testResultId", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(test_result_controller_1.default.resendTestResultEmail));
exports.default = testResultRouter;
