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
exports.notifyAdmin = notifyAdmin;
const admin_model_1 = __importDefault(require("./admin.model"));
const admin_notification_model_1 = __importDefault(require("./admin.notification.model"));
function notifyAdmin(title_1, message_1) {
    return __awaiter(this, arguments, void 0, function* (title, message, type = "info") {
        const admin = yield admin_model_1.default.findOne();
        if (admin) {
            yield admin_notification_model_1.default.create({
                admin: admin._id,
                title,
                message,
                type,
                isRead: false
            });
        }
    });
}
