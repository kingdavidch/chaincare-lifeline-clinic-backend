"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const utils_1 = require("../utils");
const order_model_1 = __importDefault(require("../order/order.model"));
const review_model_1 = __importDefault(require("./review.model"));
const app_error_1 = __importDefault(require("../utils/app.error"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const clinic_notification_model_1 = __importDefault(require("../clinic/clinic.notification.model"));
const patient_model_1 = __importDefault(require("../patient/patient.model"));
class ReviewController {
    /**
     * Patient creates a review for a clinic they've ordered from.
     */
    static createClinicReview(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["clinicId", "rating"]);
                const patientId = (0, utils_1.getPatientId)(req);
                const { clinicId, rating, comment } = req.body;
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const existingOrder = yield order_model_1.default.findOne({
                    patient: patientId,
                    clinic: clinicId,
                    paymentStatus: "paid",
                    "tests.status": { $in: ["result_ready", "sent"] }
                });
                if (!existingOrder) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Only clinics you've ordered from can be reviewed.");
                }
                const patient = yield patient_model_1.default.findById(patientId).select("fullName");
                const existingReview = yield review_model_1.default.findOne({
                    patient: patientId,
                    clinic: clinicId
                });
                if (existingReview) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "You have already submitted a review for this clinic.");
                }
                const newReview = yield review_model_1.default.create({
                    patient: patientId,
                    clinic: clinicId,
                    rating,
                    comment
                });
                yield clinic_model_1.default.findByIdAndUpdate(clinicId, {
                    $push: { reviews: newReview._id }
                });
                yield clinic_notification_model_1.default.create({
                    clinic: clinicId,
                    title: "New Review Received",
                    message: `You have received a new review from ${patient === null || patient === void 0 ? void 0 : patient.fullName}.`,
                    type: "info",
                    isRead: false
                });
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Your review has been submitted successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Update a patient's review for a clinic.
     */
    static updateClinicReview(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { reviewId } = req.params;
                const { rating, comment } = req.body;
                const review = yield review_model_1.default.findOne({
                    _id: reviewId,
                    patient: patientId
                });
                if (!review) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Unauthorized.");
                }
                if (rating)
                    review.rating = rating;
                if (comment !== undefined)
                    review.comment = comment;
                yield review.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Review updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get all reviews for a specific clinic.
     */
    static getClinicReviews(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const reviews = yield review_model_1.default
                    .find({ clinic: clinicId })
                    .populate("patient", "fullName patientId -_id")
                    .select("patient rating comment createdAt")
                    .sort({ createdAt: -1 });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    data: reviews
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get a single review.
     */
    static getPatientReviewById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { reviewId } = req.params;
                const review = yield review_model_1.default
                    .findOne({
                    _id: reviewId,
                    patient: patientId
                })
                    .select("rating comment createdAt");
                if (!review) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Unauthorized.");
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    data: {
                        reviewId: review._id,
                        rating: review.rating,
                        comment: review.comment,
                        createdAt: review.createdAt
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deleteAnonymousReviews(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Fetch all reviews
                const allReviews = yield review_model_1.default.find().populate("patient");
                // 2. Separate reviews by whether patient is null or not
                const anonymousReviews = allReviews.filter((r) => !r.patient);
                const patientReviews = allReviews.filter((r) => r.patient);
                // 3. Collect IDs for both groups
                const anonymousIds = anonymousReviews.map((r) => r._id);
                const patientIds = patientReviews.map((r) => r.patient);
                if (!anonymousIds.length && !patientIds.length) {
                    return res.status(http_status_1.default.OK).json({
                        success: true,
                        message: "No reviews found to clean up."
                    });
                }
                // 4. Delete anonymous reviews
                const deleteResult = yield review_model_1.default.deleteMany({
                    _id: { $in: anonymousIds }
                });
                // 5. Clean up Clinic references
                const updateResult = yield clinic_model_1.default.updateMany({ reviews: { $in: anonymousIds } }, { $pull: { reviews: { $in: anonymousIds } } });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: `Deleted ${deleteResult.deletedCount} anonymous reviews and removed references from ${updateResult.modifiedCount} clinics.`,
                    deletedIds: anonymousIds,
                    patientRefsFound: patientIds // so you can inspect patient-linked reviews
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = ReviewController;
