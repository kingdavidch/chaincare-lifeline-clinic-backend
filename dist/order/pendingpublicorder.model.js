"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingPublicOrder = void 0;
const mongoose_1 = require("mongoose");
const pendingPublicOrderSchema = new mongoose_1.Schema({
    orderKey: { type: String, required: true, unique: true },
    clinicId: { type: Number, required: false },
    testNo: { type: Number, required: false },
    fullName: { type: String },
    email: { type: String },
    phoneNumber: { type: String },
    deliveryMethod: { type: Number, required: true },
    deliveryAddress: { type: mongoose_1.Schema.Types.Mixed, default: null },
    appliedDiscount: {
        code: { type: String },
        percentage: { type: Number },
        discountAmount: { type: Number },
        expiresAt: { type: Date }
    },
    scheduledAt: { type: Date }
});
// pendingPublicOrderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 })
pendingPublicOrderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 20 });
exports.PendingPublicOrder = (0, mongoose_1.model)("pendingpublicorder", pendingPublicOrderSchema);
