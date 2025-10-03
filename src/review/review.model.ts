/* eslint-disable @typescript-eslint/no-explicit-any */

import mongoose, { Schema, model } from "mongoose"
import { IReview } from "./review.types"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const reviewSchema = new Schema<IReview>(
  {
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
    clinic: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
)

reviewSchema.plugin(autoIncrement, { inc_field: "reviewNo", start_seq: 1000 })

export default model<IReview>("Review", reviewSchema)
