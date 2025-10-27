import express from "express"
import ReviewController from "./review.controller"
import asyncHandler from "../utils/async.handler"
import PatientMiddleware from "../patient/patient.middleware"
import ClinicMiddleware from "../clinic/clinic.middleware"

const reviewRouter = express.Router()

reviewRouter.post(
  "/patient",
  PatientMiddleware.authenticate,
  asyncHandler(ReviewController.createClinicReview)
)

reviewRouter.patch(
  "/patient/:reviewId",
  PatientMiddleware.authenticate,
  asyncHandler(ReviewController.updateClinicReview)
)

reviewRouter.get(
  "/patient/:reviewId",
  PatientMiddleware.authenticate,
  asyncHandler(ReviewController.getPatientReviewById)
)

reviewRouter.get(
  "/clinic",
  ClinicMiddleware.authenticate,
  asyncHandler(ReviewController.getClinicReviews)
)

export default reviewRouter
