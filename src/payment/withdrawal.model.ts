import mongoose, { Schema, model } from "mongoose"
import { IWithdrawal } from "./payment.types"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const withdrawalSchema = new Schema<IWithdrawal>(
  {
    clinic: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    amount: { type: Number, required: true },
    usdAmount: { type: Number },
    fee: { type: Number },
    phoneNumber: { type: String, required: true },
    accountNumber: { type: String, required: true },
    status: {
      type: String,
      default: "pending"
    },
    providerStatus: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    provider: { type: String, default: "pawapay" },
    providerChannel: { type: String },
    providerTransactionId: { type: String },
    payoutId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    statusHistory: [
      {
        status: { type: String },
        changedAt: { type: Date }
      }
    ]
  },
  { timestamps: true }
)

withdrawalSchema.plugin(autoIncrement, {
  inc_field: "withdrawalId",
  start_seq: 1000
})

export default model<IWithdrawal>("Withdrawal", withdrawalSchema)
