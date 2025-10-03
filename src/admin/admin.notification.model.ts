import { Schema, Types, model } from "mongoose"

interface IAdminNotification {
  admin: Types.ObjectId
  title: string
  message: string
  type:
    | "order"
    | "test result"
    | "claim"
    | "wallet"
    | "info"
    | "warning"
    | "alert"
    | "subscription"
  isRead: boolean
  createdAt?: Date
}

const adminNotificationSchema = new Schema<IAdminNotification>(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
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
        "claim",
        "wallet",
        "info",
        "warning",
        "alert",
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

export default model<IAdminNotification>(
  "AdminNotification",
  adminNotificationSchema
)
