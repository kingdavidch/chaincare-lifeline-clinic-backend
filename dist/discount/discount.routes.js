"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const discount_controller_1 = __importDefault(require("./discount.controller"));
const clinic_middleware_1 = __importDefault(require("../clinic/clinic.middleware"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const clinic_access_guard_1 = require("../clinic/clinic.access.guard");
const patient_middleware_1 = __importDefault(require("../patient/patient.middleware"));
const discountRouter = (0, express_1.Router)();
discountRouter.post("/clinic", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(discount_controller_1.default.createDiscount));
discountRouter.get("/clinic", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(discount_controller_1.default.listClinicDiscounts));
discountRouter.delete("/clinic/:id", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(discount_controller_1.default.deleteDiscount));
discountRouter.get("/clinic/:clinicId", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(discount_controller_1.default.getActiveDiscountsForClinic));
discountRouter.post("/patient/apply", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(discount_controller_1.default.applyDiscount));
exports.default = discountRouter;
