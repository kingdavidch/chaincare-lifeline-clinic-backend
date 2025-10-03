"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_controller_1 = __importDefault(require("../subscription/subscription.controller"));
const patient_middleware_1 = __importDefault(require("../patient/patient.middleware"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const subscriptionRouter = (0, express_1.Router)();
// Subscribe to a plan
subscriptionRouter.post("/subscribe", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(subscription_controller_1.default.subscribe));
// Get active subscription
subscriptionRouter.get("/active", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(subscription_controller_1.default.getActiveSubscription));
// Cancel subscription
subscriptionRouter.delete("/cancel", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(subscription_controller_1.default.cancelSubscription));
// Get patient's privilege, balance and details
subscriptionRouter.get("/privilege-balance", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(subscription_controller_1.default.getPatientPrivilegeAndBalance));
exports.default = subscriptionRouter;
