"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patient_middleware_1 = __importDefault(require("../patient/patient.middleware"));
const order_controller_1 = __importDefault(require("./order.controller"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const clinic_middleware_1 = __importDefault(require("../clinic/clinic.middleware"));
const clinic_access_guard_1 = require("../clinic/clinic.access.guard");
const orderRouter = (0, express_1.Router)();
// Patient routes
orderRouter.post("/checkout", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(order_controller_1.default.checkout));
// Public order checkout (no authentication)
orderRouter.post("/checkout/public", (0, async_handler_1.default)(order_controller_1.default.checkoutPublic));
orderRouter.get("/patient/orders", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(order_controller_1.default.getUserOrders));
// Update delivery address
orderRouter.patch("/:orderId/delivery-address", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(order_controller_1.default.updateDeliveryAddress));
orderRouter.patch("/:orderId/payment-method", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(order_controller_1.default.updateOrderPaymentMethod));
// Clinic routes
orderRouter.get("/clinic/orders", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(order_controller_1.default.getClinicOrders));
// Clinic routes
orderRouter.get("/clinic/order-ids", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(order_controller_1.default.getClinicOrdersForAutoComplete));
orderRouter.get("/clinic/order/:orderId", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(order_controller_1.default.getClinicOrderDetails));
orderRouter.patch("/clinic/orders/:id/tests/:testId/status", clinic_middleware_1.default.authenticate, clinic_access_guard_1.ClinicAccessGuard, (0, async_handler_1.default)(order_controller_1.default.updateOrderTestStatus));
orderRouter.get("/patient/orders/:orderId/tests/:testId/details", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(order_controller_1.default.getOrderTestDetails));
orderRouter.get("/payment/pawapay/confirmation-status/:transactionId", (0, async_handler_1.default)(order_controller_1.default.getPawaPayConfirmationStatus));
exports.default = orderRouter;
