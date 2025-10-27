"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const patient_middleware_1 = __importDefault(require("../patient/patient.middleware"));
const testBooking_controller_1 = __importDefault(require("./testBooking.controller"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const testBookingRouter = express_1.default.Router();
/**
 * Add a test to cart
 */
testBookingRouter.post("/add", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(testBooking_controller_1.default.addToCart));
/**
 * Get all cart items
 */
testBookingRouter.get("/", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(testBooking_controller_1.default.getCart));
/**
 * Remove an item from cart
 */
testBookingRouter.delete("/remove/:bookingId", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(testBooking_controller_1.default.removeFromCart));
/**
 * Clear patient's cart
 */
testBookingRouter.delete("/clear", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(testBooking_controller_1.default.clearCart));
exports.default = testBookingRouter;
