import express from "express"
import asyncHandler from "../utils/async.handler"
import { AvailabilityController } from "./availability.controller"
import ClinicMiddleware from "../clinic/clinic.middleware"

const availabilityRouter = express.Router()

/**
 * Set or update clinic availability for a specific day
 */
availabilityRouter.post(
  "/set",
  ClinicMiddleware.authenticate,
  asyncHandler(AvailabilityController.setAvailability)
)

/**
 * Delete clinic availability for a specific day
 */
availabilityRouter.delete(
  "/delete",
  ClinicMiddleware.authenticate,
  asyncHandler(AvailabilityController.deleteAvailability)
)

/**
 * Get clinic's full weekly availability schedule
 */
availabilityRouter.get(
  "/",
  ClinicMiddleware.authenticate,
  asyncHandler(AvailabilityController.getAvailability)
)

/**
 * Get available slots for a specific date
 */
availabilityRouter.get(
  "/:clinicId/slots",
  asyncHandler(AvailabilityController.getAvailableSlots)
)

export default availabilityRouter
