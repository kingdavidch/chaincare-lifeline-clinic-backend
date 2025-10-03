import { Request, Response, NextFunction } from "express"
import httpStatus from "http-status"
import { getClinicId, getPatientId, handleRequiredFields } from "../utils"
import orderModel from "../order/order.model"
import reviewModel from "./review.model"
import AppError from "../utils/app.error"
import clinicModel from "../clinic/clinic.model"
import clinicNotificationModel from "../clinic/clinic.notification.model"
import patientModel from "../patient/patient.model"

export default class ReviewController {
  /**
   * Patient creates a review for a clinic they've ordered from.
   */
  public static async createClinicReview(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      handleRequiredFields(req, ["clinicId", "rating"])
      const patientId = getPatientId(req)

      const { clinicId, rating, comment } = req.body

      const clinic = await clinicModel.findById(clinicId)

      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      const existingOrder = await orderModel.findOne({
        patient: patientId,
        clinic: clinicId,
        paymentStatus: "paid",
        "tests.status": { $in: ["result_ready", "sent"] }
      })

      if (!existingOrder) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Only clinics you've ordered from can be reviewed."
        )
      }

      const patient = await patientModel.findById(patientId).select("fullName")

      const existingReview = await reviewModel.findOne({
        patient: patientId,
        clinic: clinicId
      })

      if (existingReview) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "You have already submitted a review for this clinic."
        )
      }

      const newReview = await reviewModel.create({
        patient: patientId,
        clinic: clinicId,
        rating,
        comment
      })

      await clinicModel.findByIdAndUpdate(clinicId, {
        $push: { reviews: newReview._id }
      })

      await clinicNotificationModel.create({
        clinic: clinicId,
        title: "New Review Received",
        message: `You have received a new review from ${patient?.fullName}.`,
        type: "info",
        isRead: false
      })

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Your review has been submitted successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update a patient's review for a clinic.
   */
  public static async updateClinicReview(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { reviewId } = req.params
      const { rating, comment } = req.body

      const review = await reviewModel.findOne({
        _id: reviewId,
        patient: patientId
      })

      if (!review) {
        throw new AppError(httpStatus.NOT_FOUND, "Unauthorized.")
      }

      if (rating) review.rating = rating
      if (comment !== undefined) review.comment = comment

      await review.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Review updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all reviews for a specific clinic.
   */
  public static async getClinicReviews(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const reviews = await reviewModel
        .find({ clinic: clinicId })
        .populate("patient", "fullName patientId -_id")
        .select("patient rating comment createdAt")
        .sort({ createdAt: -1 })

      res.status(httpStatus.OK).json({
        success: true,
        data: reviews
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get a single review.
   */
  public static async getPatientReviewById(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { reviewId } = req.params

      const review = await reviewModel
        .findOne({
          _id: reviewId,
          patient: patientId
        })
        .select("rating comment createdAt")

      if (!review) {
        throw new AppError(httpStatus.NOT_FOUND, "Unauthorized.")
      }

      res.status(httpStatus.OK).json({
        success: true,
        data: {
          reviewId: review._id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async deleteAnonymousReviews(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      // 1. Fetch all reviews
      const allReviews = await reviewModel.find().populate("patient")

      // 2. Separate reviews by whether patient is null or not
      const anonymousReviews = allReviews.filter((r: any) => !r.patient)
      const patientReviews = allReviews.filter((r: any) => r.patient)

      // 3. Collect IDs for both groups
      const anonymousIds = anonymousReviews.map((r: any) => r._id)
      const patientIds = patientReviews.map((r: any) => r.patient)

      if (!anonymousIds.length && !patientIds.length) {
        return res.status(httpStatus.OK).json({
          success: true,
          message: "No reviews found to clean up."
        })
      }

      // 4. Delete anonymous reviews
      const deleteResult = await reviewModel.deleteMany({
        _id: { $in: anonymousIds }
      })

      // 5. Clean up Clinic references
      const updateResult = await clinicModel.updateMany(
        { reviews: { $in: anonymousIds } },
        { $pull: { reviews: { $in: anonymousIds } } }
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: `Deleted ${deleteResult.deletedCount} anonymous reviews and removed references from ${updateResult.modifiedCount} clinics.`,
        deletedIds: anonymousIds,
        patientRefsFound: patientIds // so you can inspect patient-linked reviews
      })
    } catch (error) {
      next(error)
    }
  }
}
