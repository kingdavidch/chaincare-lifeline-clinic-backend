"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const patientNotificationSchema = new mongoose_1.Schema({
    patient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Patient",
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: [
            "order",
            "test result",
            "payment",
            "info",
            "warning",
            "claim",
            "subscription"
        ],
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
exports.default = (0, mongoose_1.model)("PatientNotification", patientNotificationSchema);
