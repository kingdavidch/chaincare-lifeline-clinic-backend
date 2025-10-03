import { Schema, model } from "mongoose"
import { IAdmin } from "./admin.types"
import validator from "validator"

const adminSchema = new Schema<IAdmin>(
  {
    userName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value: string) {
        if (!validator.isEmail(value)) {
          throw new Error("E-mail is invalid")
        }
      }
    },
    password: {
      type: String,
      required: true
    },
    lastLogin: {
      type: Date
    },
    resetPasswordToken: {
      type: String
    },
    resetPasswordExpires: {
      type: Date
    }
  },
  {
    timestamps: true
  }
)

export default model<IAdmin>("Admin", adminSchema)
