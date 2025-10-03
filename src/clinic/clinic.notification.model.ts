import { Schema, Types, model } from "mongoose"

interface IClinicNotification {
  clinic: Types.ObjectId 
  title: string 
  message: string 
  type: "order" | "test result" | "claim" | "wallet" | "info" | "warning" | "alert"
  isRead: boolean 
  createdAt?: Date 
}

const clinicNotificationSchema = new Schema<IClinicNotification>(
  {
    clinic: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
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
      enum: ["order", "test result", "claim", "wallet", "info", "warning", "alert"],
      required: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
  },
  { timestamps: true } 
)

export default model<IClinicNotification>(
  "ClinicNotification",
  clinicNotificationSchema
)
