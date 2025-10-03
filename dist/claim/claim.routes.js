"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const claim_controller_1 = __importDefault(require("./claim.controller"));
const clinic_middleware_1 = __importDefault(require("../clinic/clinic.middleware"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const clinic_access_guard_1 = require("../clinic/clinic.access.guard");
const claimRouter = (0, express_1.Router)();
claimRouter.post("/add", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(claim_controller_1.default.addClaim));
claimRouter.get("/all", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(claim_controller_1.default.getAllClaims));
claimRouter.get("/history/:patientId", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(claim_controller_1.default.getPatientClaimHistory));
claimRouter.delete("/clear-claims/:email", (0, async_handler_1.default)(claim_controller_1.default.clearPatientClaims));
exports.default = claimRouter;
