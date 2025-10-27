"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const adminNotificationSchema = new mongoose_1.Schema({
    admin: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Admin",
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
            "claim",
            "wallet",
            "info",
            "warning",
            "alert",
            "subscription",
            "payment"
        ],
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
exports.default = (0, mongoose_1.model)("AdminNotification", adminNotificationSchema);
