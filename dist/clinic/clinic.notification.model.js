"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const clinicNotificationSchema = new mongoose_1.Schema({
    clinic: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Clinic",
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
        enum: ["order", "test result", "claim", "wallet", "info", "warning", "alert"],
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });
exports.default = (0, mongoose_1.model)("ClinicNotification", clinicNotificationSchema);
