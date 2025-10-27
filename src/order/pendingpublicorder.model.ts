import { Schema, model } from "mongoose"

const pendingPublicOrderSchema = new Schema({
  orderKey: { type: String, required: true, unique: true },
  clinicId: { type: Number, required: false },
  testNo: { type: Number, required: false },
  fullName: { type: String },
  email: { type: String },
  phoneNumber: { type: String },
  deliveryMethod: { type: Number, required: true },
  deliveryAddress: { type: Schema.Types.Mixed, default: null },
  appliedDiscount: {
    code: { type: String },
    percentage: { type: Number },
    discountAmount: { type: Number },
    expiresAt: { type: Date }
  },
  scheduledAt: { type: Date }
})

// pendingPublicOrderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 })
pendingPublicOrderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 20 })

export const PendingPublicOrder = model(
  "pendingpublicorder",
  pendingPublicOrderSchema
)
