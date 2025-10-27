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
exports.revalidateDiscount = revalidateDiscount;
const moment_1 = __importDefault(require("moment"));
const discount_model_1 = __importDefault(require("../discount/discount.model"));
function revalidateDiscount(booking) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!booking)
            return booking;
        const now = moment_1.default.utc();
        const subtotal = booking.price;
        yield discount_model_1.default.updateMany({ clinic: booking.clinic, validUntil: { $lt: now.toDate() }, status: 0 }, { $set: { status: 1 } });
        if (!((_a = booking.discount) === null || _a === void 0 ? void 0 : _a.code)) {
            booking.discount = {
                code: null,
                percentage: 0,
                discountAmount: 0,
                finalPrice: subtotal,
                expiresAt: null
            };
            yield booking.save();
            return booking;
        }
        const discount = yield discount_model_1.default.findOne({
            clinic: booking.clinic,
            code: booking.discount.code,
            status: 0,
            isDeleted: false,
            validUntil: { $gte: now.toDate() }
        });
        if (discount) {
            const discountAmount = (subtotal * discount.percentage) / 100;
            booking.discount = {
                code: discount.code,
                percentage: discount.percentage,
                discountAmount,
                finalPrice: subtotal - discountAmount,
                expiresAt: discount.validUntil
            };
        }
        else {
            booking.discount = {
                code: null,
                percentage: 0,
                discountAmount: 0,
                finalPrice: subtotal,
                expiresAt: null
            };
        }
        yield booking.save();
        return booking;
    });
}
