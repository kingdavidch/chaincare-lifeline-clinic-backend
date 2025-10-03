/* eslint-disable @typescript-eslint/no-explicit-any */

import mongoose, { Schema, model } from "mongoose"
import { ITestBooking } from "./testBooking.types"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const testBookingSchema = new Schema<ITestBooking>(
  {
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
    test: {
      type: Schema.Types.ObjectId,
      ref: "Test",
      required: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    time: {
      type: String // store in HH:mm format
      // required: true
    },
    scheduledAt: {
      type: Date
      // required: true
    },
    individuals: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    price: {
      type: Number,
      required: true,
      default: 0
    },
    status: {
      type: String,
      enum: ["pending", "booked", "completed", "cancelled"],
      default: "pending"
    },
    testLocation: {
      type: String,
      enum: ["home", "on-site"],
      required: true
    },
    discount: {
      code: { type: String, default: null },
      percentage: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      finalPrice: { type: Number, default: 0 },
      expiresAt: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
)

testBookingSchema.plugin(autoIncrement, {
  inc_field: "testBookingNo",
  start_seq: 1000
})

export default model<ITestBooking>("TestBooking", testBookingSchema)
