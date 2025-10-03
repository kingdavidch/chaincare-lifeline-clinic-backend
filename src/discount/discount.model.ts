import mongoose, { model, Schema } from "mongoose"
import { IDiscount } from "./discount.types"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const discountSchema = new Schema<IDiscount>(
  {
    clinic: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true
    },
    discountNo: {
      type: Number
    },
    code: {
      type: String,
      required: true
    },
    percentage: {
      type: Number,
      required: true,
      min: 1,
      max: 100
    },
    validUntil: {
      type: Date,
      required: true
    },
    status: {
      type: Number,
      default: 0 // 0 = active, 1 = expired
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
)

discountSchema.index({ code: 1, clinic: 1 }, { unique: true })

discountSchema.plugin(autoIncrement, {
  inc_field: "discountNo",
  start_seq: 1000
})

export default model<IDiscount>("Discount", discountSchema)
