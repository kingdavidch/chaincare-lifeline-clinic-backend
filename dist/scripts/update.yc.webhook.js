"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const axios_1 = __importDefault(require("axios"));
require("dotenv/config");
const yc_auth_headers_1 = require("../payment/yc.auth.headers");
function updateYCWebhook() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const apiKey = process.env.YELLOWCARD_API_KEY;
        const apiSecret = process.env.YELLOWCARD_API_SECRET;
        const baseUrl = process.env.YELLOWCARD_BASE_URL;
        const webhookId = process.env.YELLOWCARD_WEBHOOK_ID;
        const BACKEND_URL = process.env.BACKEND_URL;
        const path = "/business/webhooks";
        const url = `${baseUrl}${path}`;
        const body = {
            id: webhookId,
            url: `${BACKEND_URL}/api/v1/payment/yellowcard/deposit-webhook`,
            active: true
        };
        const headers = (0, yc_auth_headers_1.generateYCHeaders)({
            path,
            method: "PUT",
            apiKey,
            apiSecret,
            body
        });
        try {
            const res = yield axios_1.default.put(url, body, { headers });
            console.log("✅ Webhook updated:", res.data);
        }
        catch (err) {
            console.error("❌ Failed to update webhook:", ((_a = err.response) === null || _a === void 0 ? void 0 : _a.data) || err.message);
        }
    });
}
updateYCWebhook();
