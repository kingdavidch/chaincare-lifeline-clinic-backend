"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const mongoose_1 = __importStar(require("mongoose"));
const validator_1 = __importDefault(require("validator"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose_1.default);
const AddressSchema = new mongoose_1.Schema({
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
});
const patientInsuranceSchema = new mongoose_1.Schema({
    insuranceId: { type: Number, required: true },
    affiliationNumber: { type: String, required: true },
    policyNumber: { type: String, required: true },
    relationship: { type: String, required: true, lowercase: true },
    fullName: { type: String, lowercase: true },
    dateOfBirth: {
        type: Date,
        get: (date) => (date ? date.toISOString().split("T")[0] : undefined) // Format: "YYYY-MM-DD"
    },
    gender: { type: String, lowercase: true },
    phoneNumber: { type: String },
    workplaceDepartment: { type: String, lowercase: true },
    workplaceAddress: { type: String, lowercase: true }
}, {
    toJSON: { getters: true },
    toObject: { getters: true }
});
const patientSchema = new mongoose_1.Schema({
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
        validate(value) {
            if (!validator_1.default.isEmail(value)) {
                throw new Error("E-mail is invalid");
            }
        }
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId;
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
        default: null
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
}, {
    timestamps: true
});
patientSchema.plugin(autoIncrement, { inc_field: "patientId", start_seq: 1000 });
// Middleware to filter out deleted patients
patientSchema.pre(/^find/, function (next) {
    const filter = this.getFilter();
    if (filter.isDeleted !== undefined) {
        return next();
    }
    this.where({ isDeleted: { $ne: true } });
    next();
});
exports.default = (0, mongoose_1.model)("Patient", patientSchema);
