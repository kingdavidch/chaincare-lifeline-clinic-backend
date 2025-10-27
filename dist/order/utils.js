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
exports.parseTimeToHour = exports.mapDeliveryMethod = exports.formatCase = void 0;
exports.isPopulatedTest = isPopulatedTest;
exports.deliveryMethodToNumber = deliveryMethodToNumber;
exports.createCalendarEventsForOrder = createCalendarEventsForOrder;
exports.formatTestStatus = formatTestStatus;
const timezoneMap_1 = require("../utils/timezoneMap");
const google_calendar_service_1 = require("../services/google.calendar.service");
const order_model_1 = __importDefault(require("./order.model"));
const utils_1 = require("../admin/utils");
const utils_2 = require("../utils");
const moment_1 = __importDefault(require("moment"));
function isPopulatedTest(test) {
    return typeof test === "object" && test !== null && "_id" in test;
}
const formatCase = (str) => str.replace(/\b\w/g, (c) => c.toUpperCase());
exports.formatCase = formatCase;
const mapDeliveryMethod = (deliveryMethod) => {
    if (typeof deliveryMethod === "number") {
        if (deliveryMethod === 0)
            return "home service";
        if (deliveryMethod === 1)
            return "in-person";
        if (deliveryMethod === 2)
            return "online session";
    }
    return "unknown";
};
exports.mapDeliveryMethod = mapDeliveryMethod;
// For saving (string → 0/1)
function deliveryMethodToNumber(value) {
    if (typeof value === "number")
        return value;
    const normalized = value.toLowerCase();
    if (["home service", "home", "0"].includes(normalized))
        return 0;
    if (["in-person", "in person", "1"].includes(normalized))
        return 1;
    if (["online", "online session", "virtual", "2"].includes(normalized))
        return 2;
    return 1; // default fallback: in-person
}
// createMeetLinksForOrder
function isMongooseDoc(doc) {
    return (typeof doc.toObject === "function");
}
function createCalendarEventsForOrder(order) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const timeZone = (0, timezoneMap_1.getTimezoneForCountry)(order.clinic.country);
        const scheduledTests = order.tests
            .map((test, index) => {
            const plainTest = isMongooseDoc(test) ? test.toObject() : test;
            return {
                index,
                testName: plainTest.testName,
                scheduledAt: plainTest.scheduledAt
                    ? new Date(plainTest.scheduledAt)
                    : undefined
            };
        })
            .filter((test) => !!test.scheduledAt);
        for (const test of scheduledTests) {
            let success = false;
            let attempt = 0;
            while (!success && attempt < 3) {
                try {
                    attempt++;
                    const address = order.deliveryMethod === 1
                        ? `Clinic Address: ${(0, utils_2.formatAddress)(order.clinic.location)}`
                        : order.deliveryMethod === 0
                            ? `Patient Address: ${(_a = order.deliveryAddress) === null || _a === void 0 ? void 0 : _a.address}, ${(_b = order.deliveryAddress) === null || _b === void 0 ? void 0 : _b.cityOrDistrict}`
                            : undefined;
                    const calendarResult = yield (0, google_calendar_service_1.createGoogleCalendarEvent)({
                        clinic: order.clinic,
                        patient: order.patient,
                        testName: test.testName,
                        orderId: order.orderId,
                        deliveryMethod: order.deliveryMethod,
                        address,
                        startDateTime: test.scheduledAt,
                        timeZone
                    });
                    yield order_model_1.default.updateOne({ _id: order._id }, {
                        $set: {
                            [`tests.${test.index}.googleEventLink`]: calendarResult.eventLink,
                            [`tests.${test.index}.googleMeetLink`]: calendarResult.meetLink
                        }
                    });
                    success = true;
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Unknown error";
                    if (attempt === 3) {
                        yield (0, utils_1.notifyAdmin)("Google Calendar Creation Failed", `Failed to create calendar event for "${test.testName}" in order #${order.orderId}. Reason: ${message}`, "warning");
                    }
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    yield new Promise((res) => setTimeout(res, delay));
                }
            }
        }
    });
}
function formatTestStatus(status) {
    return status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
const parseTimeToHour = (t) => {
    const m = (0, moment_1.default)(t, ["hA", "HH:mm"]);
    return m.hours();
};
exports.parseTimeToHour = parseTimeToHour;
