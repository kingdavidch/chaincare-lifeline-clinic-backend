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
const http_status_1 = __importDefault(require("http-status"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const test_item_model_1 = __importDefault(require("../test/test.item.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
const utils_1 = require("../utils");
const app_error_1 = __importDefault(require("../utils/app.error"));
const testBooking_model_1 = __importDefault(require("./testBooking.model"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const timezoneMap_1 = require("../utils/timezoneMap");
const discount_service_1 = require("../services/discount.service");
class TestBookingController {
    static addToCart(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { testId, clinicId, individuals, date, time } = req.body;
                (0, utils_1.handleRequiredFields)(req, [
                    "testId",
                    "clinicId",
                    "individuals",
                    "date"
                    // "time"
                ]);
                if (!Number.isInteger(individuals) || individuals < 1) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid quantity.");
                }
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                const test = yield test_model_1.default.findById(testId);
                if (!test)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                const existingCartItem = yield testBooking_model_1.default.findOne({
                    patient: patientId,
                    test: testId,
                    clinic: clinicId,
                    status: "pending"
                });
                if (existingCartItem) {
                    return res.status(http_status_1.default.BAD_REQUEST).json({
                        success: false,
                        message: "Appointment is already in your cart. You can increase the quantity."
                    });
                }
                const timezone = (0, timezoneMap_1.getTimezoneForCountry)(clinic.country);
                const scheduledAt = moment_timezone_1.default
                    .tz(`${date} ${time}`, "YYYY-MM-DD HH:mm", timezone)
                    .toDate();
                const conflict = yield testBooking_model_1.default.findOne({
                    clinic: clinicId,
                    scheduledAt,
                    status: { $in: ["pending", "booked"] }
                });
                if (conflict) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "This time slot is already booked. Please choose another.");
                }
                const testLocation = test.homeCollection === "available" ? "home" : "on-site";
                const subtotal = test.price * individuals;
                const booking = yield testBooking_model_1.default.create({
                    patient: patientId,
                    clinic: clinic._id,
                    test: test._id,
                    individuals,
                    price: test.price,
                    status: "pending",
                    testLocation,
                    date: moment_timezone_1.default.tz(date, "YYYY-MM-DD", timezone).toDate(),
                    time,
                    scheduledAt,
                    discount: {
                        code: null,
                        percentage: 0,
                        discountAmount: 0,
                        finalPrice: subtotal,
                        expiresAt: null
                    }
                });
                yield (0, discount_service_1.revalidateDiscount)(booking);
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Appointment added to cart successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getCart(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const cartItems = yield testBooking_model_1.default.find({
                    patient: patientId,
                    status: "pending"
                });
                yield Promise.all(cartItems.map((item) => (0, discount_service_1.revalidateDiscount)(item)));
                const allTestItems = yield test_item_model_1.default.find().select("name image");
                const cartItemsWithDetails = yield Promise.all(cartItems.map((item) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                    const test = yield test_model_1.default.findOne({
                        _id: item.test,
                        isDeleted: false
                    }).select("testName price currencySymbol");
                    if (!test)
                        return null;
                    const clinic = yield clinic_model_1.default
                        .findById(item.clinic)
                        .select("clinicName");
                    if (!clinic)
                        return null;
                    const matchedItem = allTestItems.find((ti) => ti.name.toLowerCase() === test.testName.toLowerCase());
                    return {
                        clinicId: (_a = item.clinic) === null || _a === void 0 ? void 0 : _a.toString(),
                        test: item.test,
                        _id: item._id,
                        testName: test.testName,
                        testImage: (matchedItem === null || matchedItem === void 0 ? void 0 : matchedItem.image) || "",
                        clinicName: clinic.clinicName,
                        date: item.date,
                        time: item.time,
                        scheduledAt: item.scheduledAt,
                        price: test.price,
                        currencySymbol: test.currencySymbol,
                        individuals: item.individuals,
                        discount: {
                            code: (_c = (_b = item.discount) === null || _b === void 0 ? void 0 : _b.code) !== null && _c !== void 0 ? _c : null,
                            percentage: (_e = (_d = item.discount) === null || _d === void 0 ? void 0 : _d.percentage) !== null && _e !== void 0 ? _e : 0,
                            discountAmount: (_g = (_f = item.discount) === null || _f === void 0 ? void 0 : _f.discountAmount) !== null && _g !== void 0 ? _g : 0,
                            finalPrice: (_j = (_h = item.discount) === null || _h === void 0 ? void 0 : _h.finalPrice) !== null && _j !== void 0 ? _j : test.price * item.individuals
                        }
                    };
                })));
                const filteredItems = cartItemsWithDetails.filter((item) => item !== null);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Cart items retrieved successfully.",
                    data: filteredItems
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static removeFromCart(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { bookingId } = req.params;
                const booking = yield testBooking_model_1.default.findOneAndDelete({
                    _id: bookingId,
                    patient: patientId,
                    status: "pending"
                });
                if (!booking)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Item not found in cart.");
                const remaining = yield testBooking_model_1.default.find({
                    patient: patientId,
                    status: "pending"
                });
                yield Promise.all(remaining.map((item) => (0, discount_service_1.revalidateDiscount)(item)));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test removed from cart successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateQuantity(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { bookingId } = req.params;
                const { action } = req.body;
                if (!["increase", "decrease"].includes(action)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid action. Use 'increase' or 'decrease'.");
                }
                const booking = yield testBooking_model_1.default.findOne({
                    _id: bookingId,
                    patient: patientId,
                    status: "pending"
                });
                if (!booking)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Item not found in cart.");
                if (action === "increase") {
                    booking.individuals += 1;
                }
                else {
                    if (booking.individuals <= 1) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Cannot have less than 1 individual.");
                    }
                    booking.individuals -= 1;
                }
                yield (0, discount_service_1.revalidateDiscount)(booking);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: `Quantity ${action}d successfully.`,
                    data: {
                        individuals: booking.individuals,
                        discount: booking.discount
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static clearCart(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const result = yield testBooking_model_1.default.deleteMany({
                    patient: patientId,
                    status: "pending"
                });
                if (result.deletedCount === 0) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No items found in the cart.");
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Cart cleared successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getAvailableSlots(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { clinicId } = req.params;
                const { date } = req.query;
                if (!date)
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Date is required");
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found");
                const openHour = 9;
                const closeHour = 17; // inclusive (9 → 17)
                const timezone = (0, timezoneMap_1.getTimezoneForCountry)(clinic.country);
                const slots = [];
                for (let hour = openHour; hour <= closeHour; hour++) {
                    const slot = moment_timezone_1.default.tz(`${date} ${hour}:00`, "YYYY-MM-DD HH:mm", timezone);
                    const conflict = yield testBooking_model_1.default.findOne({
                        clinic: clinicId,
                        scheduledAt: slot.toDate(),
                        status: "booked"
                    });
                    if (!conflict) {
                        slots.push(`${String(hour).padStart(2, "0")}:00`);
                    }
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Available slots retrieved successfully",
                    slots
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = TestBookingController;
