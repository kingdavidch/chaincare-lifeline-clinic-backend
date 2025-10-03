"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose_1.default);
const orderSchema = new mongoose_1.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    patient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Patient",
        required: true
    },
    clinic: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Clinic",
        required: true
    },
    tests: [
        {
            test: { type: mongoose_1.Schema.Types.ObjectId, ref: "Test", required: true },
            testName: { type: String, required: true },
            price: { type: Number, required: true },
            individuals: { type: Number, required: true },
            turnaroundTime: { type: String, required: true },
            description: { type: String },
            testImage: { type: String },
            date: { type: Date },
            time: { type: String },
            scheduledAt: { type: Date },
            status: {
                type: String,
                enum: [
                    "pending",
                    "sample_collected",
                    "processing",
                    "result_ready",
                    "result_sent",
                    "rejected",
                    "cancelled",
                    "failed"
                ],
                default: "pending"
            },
            statusReason: { type: String, trim: true, default: null },
            statusHistory: [
                {
                    status: {
                        type: String,
                        enum: [
                            "pending",
                            "sample_collected",
                            "processing",
                            "result_ready",
                            "result_sent",
                            "rejected",
                            "cancelled",
                            "failed"
                        ],
                        required: true
                    },
                    changedAt: {
                        type: Date,
                        default: Date.now
                    }
                }
            ]
        }
    ],
    paymentMethod: {
        type: String,
        enum: ["lifeline subscription", "insurance", "pawa_pay", "yellow_card"],
        required: true,
        lowercase: true
    },
    insuranceDetails: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null
    },
    deliveryAddress: {
        fullName: { type: String },
        phoneNo: { type: String },
        address: { type: String },
        cityOrDistrict: { type: String, lowercase: true, trim: true }
    },
    deliveryMethod: {
        type: Number,
        required: true
        // 0 = Home service
        // 1 = In-person
    },
    totalAmount: { type: Number, required: true },
    appliedDiscount: {
        code: { type: String },
        percentage: { type: Number },
        discountAmount: { type: Number },
        expiresAt: { type: Date }
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending"
    },
    yellowCardInfo: {
        channelId: { type: String },
        sequenceId: { type: String },
        ycTransactionId: { type: String },
        status: {
            type: String,
            default: "pending"
        },
        rejectionReason: { type: String }
    },
    pawaPayInfo: {
        transactionId: { type: String },
        depositId: { type: String },
        phoneNumber: { type: String },
        status: {
            type: String,
            enum: [
                "initiated",
                "pending",
                "network_error",
                "rejected",
                "complete",
                "successful"
            ],
            default: "initiated"
        },
        errorMessage: { type: String },
        rejectionReason: { type: String },
        initiatedAt: { type: Date }
    }
}, {
    timestamps: true
});
orderSchema.plugin(autoIncrement, { inc_field: "orderNo", start_seq: 1000 });
exports.default = (0, mongoose_1.model)("Order", orderSchema);
