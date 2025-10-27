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
exports.AvailabilityController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const availability_model_1 = require("./availability.model");
const utils_1 = require("../utils");
const app_error_1 = __importDefault(require("../utils/app.error"));
const timezoneMap_1 = require("../utils/timezoneMap");
const moment_1 = __importDefault(require("moment"));
class AvailabilityController {
    static setAvailability(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { day, timeRanges, isClosed } = req.body;
                if (!day ||
                    !timeRanges ||
                    !Array.isArray(timeRanges) ||
                    timeRanges.length === 0) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Day and at least one time range are required.");
                }
                const validDays = [
                    "monday",
                    "tuesday",
                    "wednesday",
                    "thursday",
                    "friday",
                    "saturday",
                    "sunday"
                ];
                const dayLower = day.toLowerCase();
                if (!validDays.includes(dayLower)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, `${day} is not a valid day of the week.`);
                }
                for (const range of timeRanges) {
                    if (range.openHour === undefined || range.closeHour === undefined) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Each time range must have openHour and closeHour.");
                    }
                    if (range.openHour >= range.closeHour) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "openHour must be less than closeHour.");
                    }
                }
                yield availability_model_1.AvailabilityModel.findOneAndUpdate({ clinic: clinicId, day: dayLower }, { timeRanges, isClosed }, { upsert: true, new: true });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: `Availability for ${dayLower} updated successfully.`
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Delete clinic availability for a specific day
     */
    static deleteAvailability(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { day } = req.body;
                if (!day) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Day is required.");
                }
                const validDays = [
                    "monday",
                    "tuesday",
                    "wednesday",
                    "thursday",
                    "friday",
                    "saturday",
                    "sunday"
                ];
                const dayLower = day.toLowerCase();
                if (!validDays.includes(dayLower)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, `${day} is not a valid day of the week.`);
                }
                const deleted = yield availability_model_1.AvailabilityModel.findOneAndDelete({
                    clinic: clinicId,
                    day: dayLower
                });
                if (!deleted) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, `No availability found for ${dayLower}.`);
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: `Availability for ${dayLower} deleted successfully.`
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get clinic's full weekly availability schedule
     */
    static getAvailability(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const availability = yield availability_model_1.AvailabilityModel.find({
                    clinic: clinicId
                }).select("-_id -clinic -__v");
                res.status(http_status_1.default.OK).json({
                    success: true,
                    data: availability
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
                const clinic = yield clinic_model_1.default.findOne({ clinicId });
                if (!clinic)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found");
                const weeklyAvailability = yield availability_model_1.AvailabilityModel.find({
                    clinic: clinic._id
                }).select("-_id -clinic -__v");
                const timezone = (0, timezoneMap_1.getTimezoneForCountry)(clinic.country);
                const today = (0, moment_1.default)().tz(timezone).startOf("day");
                if (!date) {
                    const extendedAvailability = weeklyAvailability.map((a) => {
                        const dayIndex = (0, moment_1.default)().day(a.day.toLowerCase()).day();
                        const nextDate = today.clone().day(dayIndex);
                        if (nextDate.isBefore(today, "day")) {
                            nextDate.add(7, "days"); // mutates the moment object in place
                        }
                        return Object.assign(Object.assign({}, a.toObject()), { nextDate: nextDate.format("YYYY-MM-DD") });
                    });
                    return res.status(http_status_1.default.OK).json({
                        success: true,
                        data: extendedAvailability
                    });
                }
                const dayOfWeek = moment_1.default
                    .tz(date, timezone)
                    .format("dddd")
                    .toLowerCase();
                const dayAvailability = weeklyAvailability.find((d) => d.day.toLowerCase() === dayOfWeek);
                if (!dayAvailability) {
                    return res.status(http_status_1.default.OK).json({
                        success: true,
                        message: "Clinic is not available on this day",
                        data: null
                    });
                }
                return res.status(http_status_1.default.OK).json({
                    success: true,
                    data: dayAvailability
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.AvailabilityController = AvailabilityController;
