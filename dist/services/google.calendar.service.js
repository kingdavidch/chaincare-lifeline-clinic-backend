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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGoogleCalendarEvent = createGoogleCalendarEvent;
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
require("dotenv/config");
const utils_1 = require("../utils");
const oauth2Client = new google_auth_library_1.OAuth2Client(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});
const calendar = googleapis_1.google.calendar({ version: "v3", auth: oauth2Client });
function createGoogleCalendarEvent(_a) {
    return __awaiter(this, arguments, void 0, function* ({ clinic, patient, testName, orderId, deliveryMethod, address, timeZone = "Africa/Kigali", startDateTime, endDateTime }) {
        var _b, _c;
        const start = startDateTime;
        const end = endDateTime !== null && endDateTime !== void 0 ? endDateTime : new Date(start.getTime() + 60 * 60 * 1000);
        const eventStart = start.toISOString();
        const eventEnd = end.toISOString();
        const capitalizedTestName = (0, utils_1.formatCase)(testName);
        const capitalizedPatientName = (0, utils_1.formatCase)(patient.fullName);
        const capitalizedClinicName = (0, utils_1.formatCase)(clinic.clinicName);
        const isOnline = deliveryMethod === 2;
        const methodLabel = deliveryMethod === 0
            ? "Home visit"
            : deliveryMethod === 1
                ? "In-person"
                : "Online";
        const descriptionLines = [
            `${methodLabel === null || methodLabel === void 0 ? void 0 : methodLabel.toUpperCase()} Appointment for ${capitalizedTestName}.`,
            `Order ID: ${orderId}`,
            `Patient: ${capitalizedPatientName}`,
            `Clinic: ${capitalizedClinicName}`
        ];
        if (address) {
            descriptionLines.push(address);
        }
        const summary = `Appointment - ${capitalizedTestName} | ${capitalizedPatientName} x ${capitalizedClinicName}`;
        try {
            const response = yield calendar.events.insert({
                calendarId: "primary",
                sendUpdates: "all",
                conferenceDataVersion: 1,
                requestBody: {
                    summary,
                    description: descriptionLines.join("\n"),
                    start: {
                        dateTime: eventStart,
                        timeZone
                    },
                    end: {
                        dateTime: eventEnd,
                        timeZone
                    },
                    attendees: [{ email: clinic.email }, { email: patient.email }],
                    conferenceData: isOnline
                        ? {
                            createRequest: {
                                requestId: "lifeline-" + Date.now(),
                                conferenceSolutionKey: { type: "hangoutsMeet" }
                            }
                        }
                        : undefined,
                    reminders: { useDefault: true }
                }
            });
            const event = response.data;
            return {
                success: true,
                eventLink: (_b = event.htmlLink) !== null && _b !== void 0 ? _b : undefined,
                meetLink: (_c = event.hangoutLink) !== null && _c !== void 0 ? _c : undefined
            };
        }
        catch (error) {
            if (error instanceof Error) {
                console.error("❌ Google Calendar error:", error.message);
                throw new Error("Failed to create Google Calendar event: " + error.message);
            }
            throw new Error("Unknown error creating Google Calendar event");
        }
    });
}
