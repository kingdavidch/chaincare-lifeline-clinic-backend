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
      unique: true,
      lowercase: true,
      maxlength: 100
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, "Bio cannot exceed 500 characters"]
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
    username: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 30
    },

    deliveryMethods: {
      type: [Number]
      // 0 = Home service
      // 1 = In-person
      // 2 = Online session
    },
    currencySymbol: {
      type: String,
      trim: true
    },
    languages: {
      type: [String],
      trim: true,
      lowercase: true,
      default: [],
      validate(value: string[]) {
        if (!Array.isArray(value)) {
          throw new Error("Languages must be an array of strings")
        }
        if (value.length > 5) {
          throw new Error("You can only specify up to 5 languages")
        }
      }
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
    socialMedia: {
      facebook: { type: String, trim: true, lowercase: true },
      twitter: { type: String, trim: true, lowercase: true },
      instagram: { type: String, trim: true, lowercase: true },
      linkedin: { type: String, trim: true, lowercase: true },
      tiktok: { type: String, trim: true, lowercase: true },
      other: { type: String, trim: true, lowercase: true },
      default: {}
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
    practitionerType: {
      type: String,
      enum: ["doctor", "therapist", "clinic", "nurse", "hospital"],
      lowercase: true,
      trim: true
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "practitionercategory"
      }
    ],
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
