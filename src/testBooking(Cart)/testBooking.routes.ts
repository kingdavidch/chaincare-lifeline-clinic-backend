import express from "express"
import PatientMiddleware from "../patient/patient.middleware"
import TestBookingController from "./testBooking.controller"
import asyncHandler from "../utils/async.handler"

const testBookingRouter = express.Router()

/**
 * Add a test to cart
 */
testBookingRouter.post(
  "/add",
  PatientMiddleware.authenticate,
  asyncHandler(TestBookingController.addToCart)
)

/**
 * Get all cart items
 */
testBookingRouter.get(
  "/",
  PatientMiddleware.authenticate,
  asyncHandler(TestBookingController.getCart)
)

/**
 * Remove an item from cart
 */
testBookingRouter.delete(
  "/remove/:bookingId",
  PatientMiddleware.authenticate,
  asyncHandler(TestBookingController.removeFromCart)
)

/**
 * Update Quantity of Individuals in Cart (Increase or Decrease)
 */
testBookingRouter.patch(
  "/update-quantity/:bookingId",
  PatientMiddleware.authenticate,
  asyncHandler(TestBookingController.updateQuantity)
)

/**
 * Get available slots for a clinic on a date
 */
testBookingRouter.get(
  "/:clinicId/available-slots",
  PatientMiddleware.authenticate,
  asyncHandler(TestBookingController.getAvailableSlots)
)

/**
 * Clear patient's cart
 */
testBookingRouter.delete(
  "/clear",
  PatientMiddleware.authenticate,
  asyncHandler(TestBookingController.clearCart)
)

export default testBookingRouter
