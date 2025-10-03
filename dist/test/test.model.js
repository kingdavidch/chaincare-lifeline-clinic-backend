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
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const mongoose_1 = __importStar(require("mongoose"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose_1.default);
const testSchema = new mongoose_1.Schema({
    clinic: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Clinic",
        required: true
    },
    testNo: {
        type: Number
    },
    testName: {
        type: String,
        trim: true,
        lowercase: true,
        required: [true, "Test name is required"]
    },
    testItem: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "TestItem",
        required: true
    },
    price: {
        type: Number,
        required: [true, "Price is required"],
        min: [0, "Price cannot be negative"]
    },
    currencySymbol: {
        type: String,
        required: true,
        trim: true
    },
    sampleType: {
        type: String,
        enum: [
            "blood",
            "respiratory",
            "urine",
            "stool",
            "tissue biopsies",
            "swabs",
            "no sample required"
        ],
        lowercase: true,
        trim: true
    },
    turnaroundTime: {
        type: String,
        required: [true, "Turnaround time is required"],
        lowercase: true
    },
    preTestRequirements: {
        type: String,
        lowercase: true,
        default: "None specified"
    },
    homeCollection: {
        type: String,
        lowercase: true,
        required: [true, "Home collection information is required"]
    },
    insuranceCoverage: {
        type: String,
        lowercase: true,
        required: [true, "Insurance coverage details are required"]
    },
    coveredByLifeLine: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        lowercase: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});
testSchema.plugin(autoIncrement, { inc_field: "testNo", start_seq: 1000 });
// Middleware to filter out deleted clinics
testSchema.pre(/^find/, function (next) {
    // Skip the soft-delete filter if explicitly told
    if (this.getOptions().includeDeleted !== true) {
        if (!("isDeleted" in this.getFilter())) {
            this.where({ isDeleted: false });
        }
    }
    next();
});
testSchema.pre("validate", function (next) {
    if (this.homeCollection && this.homeCollection.length === 0) {
        this.invalidate("homeCollection", "Home collection cannot be empty.");
    }
    next();
});
exports.default = (0, mongoose_1.model)("Test", testSchema);
