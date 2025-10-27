import mongoose, { Schema, Document } from "mongoose"

export interface ITimeRange {
  openHour: number
  closeHour: number
}

export interface IAvailability extends Document {
  clinic: mongoose.Types.ObjectId
  day: string // e.g. "monday"
  timeRanges: ITimeRange[] // multiple open-close slots
  isClosed: boolean
}

const timeRangeSchema = new Schema<ITimeRange>(
  {
    openHour: { type: Number, required: true },
    closeHour: { type: Number, required: true }
  },
  { _id: false }
)

const availabilitySchema = new Schema<IAvailability>(
  {
    clinic: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true
    },
    day: {
      type: String,
      required: true,
      lowercase: true,
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
      ]
    },
    timeRanges: {
      type: [timeRangeSchema],
      required: true,
      validate: (arr: ITimeRange[]) => arr.length > 0
    },
    isClosed: { type: Boolean, default: false }
  },
  { timestamps: true }
)

export const AvailabilityModel = mongoose.model<IAvailability>(
  "Availability",
  availabilitySchema
)
