/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, model, Query } from "mongoose"
import { IAddress, IClinic } from "./clinic.types"
import validator from "validator"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const AddressSchema = new Schema<IAddress>({
  stateOrProvince: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50
  },
  cityOrDistrict: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50
  },
  street: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 100
  },
  postalCode: {
    type: String,
    trim: true,
    maxlength: 20
  },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  }
})

const clinicSchema = new Schema<IClinic>(
  {
    clinicId: {
      type: Number
    },
    clinicName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500
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
    phoneNo: {
      type: String,
      required: true,
      trim: true
    },
    location: { type: AddressSchema },
    country: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    currencySymbol: {
      type: String,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    termsAccepted: {
      type: Boolean,
      required: true
    },
    /**
     * Supported Insurance List
     * This field stores an array of numbers representing supported insurance providers.
     * The frontend will map these numbers to actual insurance provider names.
     *
     * Insurance Mapping:
     * 1 → LifeLine (We are your LifeLine) (Pending)
     * 2 → Britam (With you every step of the way)
     * 3 → Eden Care (Empowering Health)
     * 4 → MUA (Mauritius Union Assurance)
     * 5 → Old Mutual (Do great things)
     * 6 → Prime (Secure Tomorrow Today)
     * 7 → Radiant (Illuminating Your Health Journey)
     * 8 → RSSB (Our Health, Our Future)
     * 9 → Sanlam (Live with confidence)
     * 10 → Misur
     * 11 → Mituweli
     * 12 → MMI
     * 13 → BK Insurance
     * 14 → GoodLife
     *
     * Example: [1, 3] → Clinic or Patient supports LifeLine & Prime.
     */
    supportInsurance: {
      type: [Number],
      default: []
    },
    onlineStatus: {
      type: String,
      enum: ["online", "offline"],
      default: "online"
    },
    avatar: {
      type: String
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending"
    },
    balance: {
      type: Number,
      default: 0 // In RWF
    },
    statusReason: {
      type: [String],
      default: []
    },
    certificate: {
      file: {
        type: String,
        trim: true
      },
      status: {
        type: String,
        lowercase: true,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
      },
      rejectionReasons: [String]
    },
    contractAccepted: {
      type: Boolean,
      required: true,
      default: false
    },
    totalMoneyOwed: {
      type: Number,
      default: 0
    },
    tests: [
      {
        type: Schema.Types.ObjectId,
        ref: "Test"
      }
    ],
    reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
    resetPasswordToken: {
      type: String
    },
    resetPasswordExpires: {
      type: Date
    },
    isVerified: {
      type: Boolean,
      default: false
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

clinicSchema.plugin(autoIncrement, { inc_field: "clinicId", start_seq: 1000 })

// Middleware to filter out deleted clinics
clinicSchema.pre<Query<any, any>>(/^find/, function (next) {
  const filter = this.getFilter()

  if (filter.isDeleted !== undefined) {
    return next()
  }

  this.where({ isDeleted: { $ne: true } })
  next()
})

export default model<IClinic>("Clinic", clinicSchema)
