"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateYCHeaders = generateYCHeaders;
/* eslint-disable @typescript-eslint/no-explicit-any */
const crypto_1 = __importDefault(require("crypto"));
function generateYCHeaders({ path, method, body, apiKey, apiSecret }) {
    const timestamp = new Date().toISOString();
    const hmac = crypto_1.default.createHmac("sha256", apiSecret);
    hmac.update(timestamp, "utf8");
    hmac.update(path, "utf8");
    hmac.update(method, "utf8");
    if (body) {
        const bodyHash = crypto_1.default
            .createHash("sha256")
            .update(JSON.stringify(body), "utf8")
            .digest("base64");
        hmac.update(bodyHash, "utf8");
    }
    const signature = hmac.digest("base64");
    return {
        "X-YC-Timestamp": timestamp,
        Authorization: `YcHmacV1 ${apiKey}:${signature}`
    };
}
