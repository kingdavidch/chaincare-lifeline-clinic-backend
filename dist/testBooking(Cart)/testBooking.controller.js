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
const order_model_1 = __importDefault(require("../order/order.model"));
const availability_model_1 = require("../availability/availability.model");
class TestBookingController {
    static addToCart(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { testId, clinicId, date, time } = req.body;
                (0, utils_1.handleRequiredFields)(req, ["testId", "clinicId", "date", "time"]);
                const clinic = yield clinic_model_1.default.findOne({ clinicId });
                if (!clinic)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                const test = yield test_model_1.default.findById(testId);
                if (!test)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                const existingCartItem = yield testBooking_model_1.default.findOne({
                    patient: patientId,
                    test: testId,
                    clinic: clinic._id,
                    status: "pending"
                });
                if (existingCartItem) {
                    return res.status(http_status_1.default.BAD_REQUEST).json({
                        success: false,
                        message: "This appointment is already in your cart."
                    });
                }
                const timezone = (0, timezoneMap_1.getTimezoneForCountry)(clinic.country);
                const scheduledAt = moment_timezone_1.default
                    .tz(`${date} ${time}`, "YYYY-MM-DD hhA", timezone)
                    .toDate();
                const dayOfWeek = (0, moment_timezone_1.default)(scheduledAt)
                    .tz(timezone)
                    .format("dddd")
                    .toLowerCase();
                const availability = yield availability_model_1.AvailabilityModel.findOne({
                    clinic: clinic._id,
                    day: dayOfWeek
                });
                if (!availability) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, `Clinic is not available on ${dayOfWeek}`);
                }
                if (availability.isClosed) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "Clinic is closed on this day");
                }
                // --- Parse time string like "12PM", "1PM" into 24-hour number ---
                const parseTimeToHour = (t) => {
                    const match = t.match(/(\d+)(AM|PM)/);
                    if (!match)
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid time format");
                    let hour = parseInt(match[1], 10);
                    const period = match[2];
                    if (period === "PM" && hour !== 12)
                        hour += 12;
                    if (period === "AM" && hour === 12)
                        hour = 0;
                    return hour;
                };
                let requestedStartHour;
                let requestedEndHour = null;
                if (time.includes("-")) {
                    const [start, end] = time
                        .split("-")
                        .map((t) => parseTimeToHour(t.trim()));
                    requestedStartHour = start;
                    requestedEndHour = end;
                }
                else {
                    requestedStartHour = parseTimeToHour(time);
                }
                const isWithinRange = availability.timeRanges.some((range) => {
                    if (requestedEndHour !== null) {
                        return (requestedStartHour >= range.openHour &&
                            requestedEndHour <= range.closeHour);
                    }
                    else {
                        return (requestedStartHour >= range.openHour &&
                            requestedStartHour < range.closeHour);
                    }
                });
                if (!isWithinRange) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, `Clinic is not available at ${time} on ${dayOfWeek}`);
                }
                const startOfDay = moment_timezone_1.default
                    .tz(scheduledAt, timezone)
                    .startOf("day")
                    .toDate();
                const endOfDay = moment_timezone_1.default.tz(scheduledAt, timezone).endOf("day").toDate();
                const [authBookings, publicOrders] = yield Promise.all([
                    testBooking_model_1.default.find({
                        clinic: clinic._id,
                        scheduledAt: { $gte: startOfDay, $lte: endOfDay },
                        status: { $in: ["pending", "booked"] }
                    }),
                    order_model_1.default.find({
                        clinic: clinic._id,
                        "tests.scheduledAt": { $gte: startOfDay, $lte: endOfDay },
                        "tests.status": { $in: ["pending", "booked"] }
                    })
                ]);
                const bookedTimes = new Set();
                authBookings.forEach((b) => bookedTimes.add((0, moment_timezone_1.default)(b.scheduledAt).format("hhA")));
                publicOrders.forEach((o) => o.tests.forEach((t) => {
                    if (t.scheduledAt)
                        bookedTimes.add((0, moment_timezone_1.default)(t.scheduledAt).format("hhA"));
                }));
                const requestedSlot = (0, moment_timezone_1.default)(scheduledAt).format("hhA");
                if (bookedTimes.has(requestedSlot)) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "This time slot is already booked. Please choose another.");
                }
                const testLocation = test.homeCollection === "available" ? "home" : "on-site";
                const booking = yield testBooking_model_1.default.create({
                    patient: patientId,
                    clinic: clinic._id,
                    test: test._id,
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
                        finalPrice: test.price,
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
                        discount: {
                            code: (_c = (_b = item.discount) === null || _b === void 0 ? void 0 : _b.code) !== null && _c !== void 0 ? _c : null,
                            percentage: (_e = (_d = item.discount) === null || _d === void 0 ? void 0 : _d.percentage) !== null && _e !== void 0 ? _e : 0,
                            discountAmount: (_g = (_f = item.discount) === null || _f === void 0 ? void 0 : _f.discountAmount) !== null && _g !== void 0 ? _g : 0,
                            finalPrice: (_j = (_h = item.discount) === null || _h === void 0 ? void 0 : _h.finalPrice) !== null && _j !== void 0 ? _j : test.price
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
}
exports.default = TestBookingController;
