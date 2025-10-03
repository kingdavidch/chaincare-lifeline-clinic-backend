/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, model } from "mongoose"
import { ISubscription } from "./subscription.types"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const subscriptionSchema = new Schema<ISubscription>(
  {
    subscriptionId: {
      type: Number,
      unique: true
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true
    },
    planName: {
      type: String,
      required: true,
      enum: ["standard", "premium"],
      lowercase: true
    },
    price: {
      type: Number,
      required: true
    },
    duration: {
      type: String,
      required: true
    },
    includedTests: {
      type: [String],
      required: true
    },
    privilege: {
      type: Number,
      required: true,
      default: 0
    },
    initialPrivilege: {
      type: Number,
      required: true
    },
    monthlySpending: [
      {
        month: Date,
        totalSpent: Number
      }
    ],
    status: {
      type: String,
      enum: ["active", "locked", "expired"],
      default: "active",
      lowercase: true
    },
    isPaid: {
      type: Boolean,
      default: false
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },

    lastUsed: {
      type: Date,
      default: null
    },
    remainingTests: {
      type: Number,
      default: 2
    },

    testsUsedThisMonth: {
      type: Number,
      default: 0
    },

    lastTestDates: {
      type: [Date], // track last used dates to enforce 14-day interval
      default: []
    },

    isRolloverEligible: {
      type: Boolean,
      default: false
    },

    rolloverCarried: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

subscriptionSchema.plugin(autoIncrement, {
  inc_field: "subscriptionId",
  start_seq: 1000
})

export default model<ISubscription>("Subscription", subscriptionSchema)
