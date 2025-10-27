"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const availability_controller_1 = require("./availability.controller");
const clinic_middleware_1 = __importDefault(require("../clinic/clinic.middleware"));
const availabilityRouter = express_1.default.Router();
/**
 * Set or update clinic availability for a specific day
 */
availabilityRouter.post("/set", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(availability_controller_1.AvailabilityController.setAvailability));
/**
 * Delete clinic availability for a specific day
 */
availabilityRouter.delete("/delete", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(availability_controller_1.AvailabilityController.deleteAvailability));
/**
 * Get clinic's full weekly availability schedule
 */
availabilityRouter.get("/", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(availability_controller_1.AvailabilityController.getAvailability));
/**
 * Get available slots for a specific date
 */
availabilityRouter.get("/:clinicId/slots", (0, async_handler_1.default)(availability_controller_1.AvailabilityController.getAvailableSlots));
exports.default = availabilityRouter;
