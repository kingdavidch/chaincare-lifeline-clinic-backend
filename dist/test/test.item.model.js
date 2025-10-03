"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const testItemSchema = new mongoose_1.Schema({
    clinic: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Clinic",
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    image: {
        type: String
    },
    icon: {
        type: String
    }
}, {
    timestamps: true
});
testItemSchema.index({ clinic: 1, name: 1 }, { unique: true });
exports.default = (0, mongoose_1.model)("TestItem", testItemSchema);
