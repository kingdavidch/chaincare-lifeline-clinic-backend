import mongoose, { Schema, model } from "mongoose"
import { IClaim } from "./claim.types"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const claimSchema = new Schema<IClaim>(
  {
    claimNo: {
      type: Number,
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
    testName: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    time: {
      type: String,
      default: () => new Date().toLocaleTimeString()
    },
    cost: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
)

// Auto-increment claimNo starting from 1000
claimSchema.plugin(autoIncrement, { inc_field: "claimNo", start_seq: 1000 })

export default model<IClaim>("Claim", claimSchema)
