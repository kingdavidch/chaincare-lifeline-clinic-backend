"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const review_controller_1 = __importDefault(require("./review.controller"));
const async_handler_1 = __importDefault(require("../utils/async.handler"));
const patient_middleware_1 = __importDefault(require("../patient/patient.middleware"));
const clinic_middleware_1 = __importDefault(require("../clinic/clinic.middleware"));
const reviewRouter = express_1.default.Router();
reviewRouter.post("/patient", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(review_controller_1.default.createClinicReview));
reviewRouter.patch("/patient/:reviewId", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(review_controller_1.default.updateClinicReview));
reviewRouter.get("/patient/:reviewId", patient_middleware_1.default.authenticate, (0, async_handler_1.default)(review_controller_1.default.getPatientReviewById));
reviewRouter.get("/clinic", clinic_middleware_1.default.authenticate, (0, async_handler_1.default)(review_controller_1.default.getClinicReviews));
exports.default = reviewRouter;
