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
const subscriptionSchema = new mongoose_1.Schema({
    subscriptionId: {
        type: Number,
        unique: true
    },
    patient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Patient",
        required: true
    },
    planName: {
        type: String,
        required: true,
        enum: ["standard", "premium"],
        lowercase: true
    },
    price: {
        type: Number,
        required: true
    },
    duration: {
        type: String,
        required: true
    },
    includedTests: {
        type: [String],
        required: true
    },
    privilege: {
        type: Number,
        required: true,
        default: 0
    },
    initialPrivilege: {
        type: Number,
        required: true
    },
    monthlySpending: [
        {
            month: Date,
            totalSpent: Number
        }
    ],
    status: {
        type: String,
        enum: ["active", "locked", "expired"],
        default: "active",
        lowercase: true
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    lastUsed: {
        type: Date,
        default: null
    },
    remainingTests: {
        type: Number,
        default: 2
    },
    testsUsedThisMonth: {
        type: Number,
        default: 0
    },
    lastTestDates: {
        type: [Date], // track last used dates to enforce 14-day interval
        default: []
    },
    isRolloverEligible: {
        type: Boolean,
        default: false
    },
    rolloverCarried: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});
subscriptionSchema.plugin(autoIncrement, {
    inc_field: "subscriptionId",
    start_seq: 1000
});
exports.default = (0, mongoose_1.model)("Subscription", subscriptionSchema);
