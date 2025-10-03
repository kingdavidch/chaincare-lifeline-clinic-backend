import mongoose, { Schema, model } from "mongoose"
import { IOrder } from "./order.types"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const orderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true
    },
    clinic: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true
    },
    tests: [
      {
        test: { type: Schema.Types.ObjectId, ref: "Test", required: true },
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
      type: Schema.Types.Mixed,
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
  },
  {
    timestamps: true
  }
)

orderSchema.plugin(autoIncrement, { inc_field: "orderNo", start_seq: 1000 })

export default model<IOrder>("Order", orderSchema)
