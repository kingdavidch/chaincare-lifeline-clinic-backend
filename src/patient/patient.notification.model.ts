import { Schema, Types, model } from "mongoose"

interface IPatientNotification {
  patient: Types.ObjectId
  title: string
  message: string
  type:
    | "order"
    | "test result"
    | "payment"
    | "info"
    | "warning"
    | "claim"
    | "subscription"
  isRead: boolean
  createdAt?: Date
}

const patientNotificationSchema = new Schema<IPatientNotification>(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: [
        "order",
        "test result",
        "payment",
        "info",
        "warning",
        "claim",
        "subscription"
      ],
      required: true
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
)

export default model<IPatientNotification>(
  "PatientNotification",
  patientNotificationSchema
)
