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
exports.sendPushNotification = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const axios_1 = __importDefault(require("axios"));
const sendPushNotification = (_a) => __awaiter(void 0, [_a], void 0, function* ({ expoPushToken, title, message, type, data = {} }) {
    var _b, _c;
    try {
        const response = yield axios_1.default.post("https://exp.host/--/api/v2/push/send", [
            {
                to: expoPushToken,
                sound: "default",
                title,
                body: message,
                data: Object.assign(Object.assign({}, data), { type })
            }
        ]);
        const tickets = (_b = response.data) === null || _b === void 0 ? void 0 : _b.data;
        if (Array.isArray(tickets)) {
            tickets.forEach((ticket) => {
                if (ticket.status === "ok") {
                    console.log("✅ Push notification sent:", ticket.id);
                }
                else {
                    console.warn("⚠️ Push notification error:", ticket);
                }
            });
        }
        else {
            console.warn("⚠️ Unexpected push response:", response.data);
        }
    }
    catch (error) {
        console.error("❌ Push notification failed:", ((_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message || error);
    }
});
exports.sendPushNotification = sendPushNotification;
