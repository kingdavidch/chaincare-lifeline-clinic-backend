import mongoose, { model, Schema } from "mongoose"
import { ITestResult } from "./test.result.types"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const testResultSchema = new Schema<ITestResult>(
  {
    refNo: {
      type: String,
      required: true,
      unique: true
    },
    testResultNo: {
      type: Number
    },
    testBooking: {
      type: Schema.Types.ObjectId,
      ref: "TestBooking",
      required: true
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
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderId: { type: String, required: true },
    test: {
      type: Schema.Types.ObjectId,
      ref: "Test",
      required: true
    },
    resultFile: {
      type: String,
      required: true
    },
    resultText: {
      type: String
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    resultSent: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

testResultSchema.plugin(autoIncrement, {
  inc_field: "testResultNo",
  start_seq: 1000
})

export default model<ITestResult>("TestResult", testResultSchema)
