/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Query, Schema, model } from "mongoose"
import { ITest } from "./test.types"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const testSchema = new Schema<ITest>(
  {
    clinic: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true
    },
    testNo: {
      type: Number
    },
    testName: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, "Test name is required"]
    },
    testItem: {
      type: Schema.Types.ObjectId,
      ref: "TestItem",
      required: true
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"]
    },
    currencySymbol: {
      type: String,
      required: true,
      trim: true
    },
    sampleType: {
      type: String,
      enum: [
        "blood",
        "respiratory",
        "urine",
        "stool",
        "tissue biopsies",
        "swabs",
        "no sample required"
      ],
      lowercase: true,
      trim: true
    },
    turnaroundTime: {
      type: String,
      required: [true, "Turnaround time is required"],
      lowercase: true
    },
    preTestRequirements: {
      type: String,
      lowercase: true,
      default: "None specified"
    },
    homeCollection: {
      type: String,
      lowercase: true,
      required: [true, "Home collection information is required"]
    },
    insuranceCoverage: {
      type: String,
      lowercase: true,
      required: [true, "Insurance coverage details are required"]
    },
    coveredByLifeLine: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      lowercase: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

testSchema.plugin(autoIncrement, { inc_field: "testNo", start_seq: 1000 })

// Middleware to filter out deleted clinics
testSchema.pre<Query<any, any>>(/^find/, function (next) {
  // Skip the soft-delete filter if explicitly told
  if ((this as any).getOptions().includeDeleted !== true) {
    if (!("isDeleted" in this.getFilter())) {
      this.where({ isDeleted: false })
    }
  }
  next()
})

testSchema.pre("validate", function (next) {
  if (this.homeCollection && this.homeCollection.length === 0) {
    this.invalidate("homeCollection", "Home collection cannot be empty.")
  }
  next()
})

export default model<ITest>("Test", testSchema)
