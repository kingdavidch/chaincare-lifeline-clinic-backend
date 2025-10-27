/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, model, Query } from "mongoose"
import { IPatient, IPatientInsurance } from "./patient.types"
import validator from "validator"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose)

const AddressSchema = new Schema({
  stateOrProvince: {
    type: String,
    lowercase: true,
    trim: true,
    maxlength: 50
  },
  cityOrDistrict: {
    type: String,
    lowercase: true,
    trim: true,
    maxlength: 50
  },
  street: {
    type: String,
    lowercase: true,
    trim: true,
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

const patientInsuranceSchema = new Schema<IPatientInsurance>(
  {
    insuranceId: { type: Number, required: true },
    affiliationNumber: { type: String, required: true },
    policyNumber: { type: String, required: true },
    relationship: { type: String, required: true, lowercase: true },
    fullName: { type: String, lowercase: true },
    dateOfBirth: {
      type: Date,
      get: (date: Date) => (date ? date.toISOString().split("T")[0] : undefined) // Format: "YYYY-MM-DD"
    },
    gender: { type: String, lowercase: true },
    phoneNumber: { type: String },
    workplaceDepartment: { type: String, lowercase: true },
    workplaceAddress: { type: String, lowercase: true }
  },
  {
    toJSON: { getters: true },
    toObject: { getters: true }
  }
)

const patientSchema = new Schema<IPatient>(
  {
    patientId: {
      type: Number
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
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
      required: function () {
        return !this.googleId
      }
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true
    },
    loginProvider: {
      type: String,
      enum: ["email", "google"],
      default: "email"
    },
    country: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    location: { type: AddressSchema },
    avatar: {
      type: String
    },
    termsAccepted: {
      type: Boolean,
      required: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    insurance: [patientInsuranceSchema] /**
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
     */,
    dob: {
      type: String,
      trim: true
    },
    idNumber: { type: String, trim: true },
    idType: {
      type: String,
      enum: ["national_id", "passport", "license", "other"],
      trim: true
    },
    expoPushToken: {
      type: String,
      default: null,
      unique: true,
      sparse: true
    },
    resetPasswordToken: {
      type: String
    },
    resetPasswordExpires: {
      type: Date
    },
    emailOtp: { type: String },
    emailOtpExpiresAt: { type: Date },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
)

patientSchema.plugin(autoIncrement, { inc_field: "patientId", start_seq: 1000 })

// Middleware to filter out deleted patients
patientSchema.pre<Query<any, any>>(/^find/, function (next) {
  const filter = this.getFilter()

  if (filter.isDeleted !== undefined) {
    return next()
  }

  this.where({ isDeleted: { $ne: true } })
  next()
})

export default model<IPatient>("Patient", patientSchema)
