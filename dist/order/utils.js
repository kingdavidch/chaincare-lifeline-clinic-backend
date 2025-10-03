"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapDeliveryMethod = exports.formatCase = void 0;
exports.isPopulatedTest = isPopulatedTest;
exports.deliveryMethodToNumber = deliveryMethodToNumber;
function isPopulatedTest(test) {
    return typeof test === "object" && test !== null && "_id" in test;
}
const formatCase = (str) => str.replace(/\b\w/g, (c) => c.toUpperCase());
exports.formatCase = formatCase;
const mapDeliveryMethod = (deliveryMethod) => {
    if (typeof deliveryMethod === "number") {
        return deliveryMethod === 0 ? "home service" : "in-person";
    }
    return "unknown";
};
exports.mapDeliveryMethod = mapDeliveryMethod;
// For saving (string → 0/1)
function deliveryMethodToNumber(value) {
    return value === "home service" || value === 0 || value === "0" ? 0 : 1;
}
