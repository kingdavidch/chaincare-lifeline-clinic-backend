"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimezoneForCountry = exports.countryToTimezone = void 0;
exports.countryToTimezone = {
    rwanda: "Africa/Kigali",
    nigeria: "Africa/Lagos",
    kenya: "Africa/Nairobi",
    ghana: "Africa/Accra",
    uganda: "Africa/Kampala",
    southafrica: "Africa/Johannesburg",
    tanzania: "Africa/Dar_es_Salaam",
    default: "UTC"
};
const getTimezoneForCountry = (country) => {
    if (!country)
        return exports.countryToTimezone.default;
    return (exports.countryToTimezone[country.toLowerCase().replace(/\s+/g, "")] ||
        exports.countryToTimezone.default);
};
exports.getTimezoneForCountry = getTimezoneForCountry;
