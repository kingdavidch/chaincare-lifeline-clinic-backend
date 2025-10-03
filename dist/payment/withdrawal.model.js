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
const mongoose_1 = __importStar(require("mongoose"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const autoIncrement = require("mongoose-sequence")(mongoose_1.default);
const withdrawalSchema = new mongoose_1.Schema({
    clinic: { type: mongoose_1.Schema.Types.ObjectId, ref: "Clinic", required: true },
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
    metadata: { type: mongoose_1.Schema.Types.Mixed },
    statusHistory: [
        {
            status: { type: String },
            changedAt: { type: Date }
        }
    ]
}, { timestamps: true });
withdrawalSchema.plugin(autoIncrement, {
    inc_field: "withdrawalId",
    start_seq: 1000
});
exports.default = (0, mongoose_1.model)("Withdrawal", withdrawalSchema);
