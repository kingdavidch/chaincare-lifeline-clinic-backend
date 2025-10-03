"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERMINAL_TEST_STATUSES = exports.ORDER_TEST_STATUS_FLOW = exports.COUNTRIES = void 0;
exports.COUNTRIES = [
    { label: "Botswana", value: "Botswana", currencySymbol: "P" }, // Botswana Pula
    { label: "Kenya", value: "Kenya", currencySymbol: "KSh" }, // Kenyan Shilling
    { label: "Nigeria", value: "Nigeria", currencySymbol: "₦" }, // Nigerian Naira
    { label: "Rwanda", value: "Rwanda", currencySymbol: "RWF" }, // Rwandan Franc
    { label: "Tanzania", value: "Tanzania", currencySymbol: "TSh" }, // Tanzanian Shilling
    { label: "Zimbabwe", value: "Zimbabwe", currencySymbol: "Z$" } // Zimbabwean Dollar
];
const ORDER_TEST_STATUS = {
    PENDING: "pending",
    SAMPLE_COLLECTED: "sample_collected",
    PROCESSING: "processing",
    RESULT_READY: "result_ready",
    RESULT_SENT: "result_sent",
    REJECTED: "rejected",
    CANCELLED: "cancelled",
    FAILED: "failed"
};
exports.ORDER_TEST_STATUS_FLOW = [
    ORDER_TEST_STATUS.PENDING,
    ORDER_TEST_STATUS.SAMPLE_COLLECTED,
    ORDER_TEST_STATUS.PROCESSING,
    ORDER_TEST_STATUS.RESULT_READY,
    ORDER_TEST_STATUS.RESULT_SENT
];
exports.TERMINAL_TEST_STATUSES = [
    ORDER_TEST_STATUS.REJECTED,
    ORDER_TEST_STATUS.CANCELLED,
    ORDER_TEST_STATUS.FAILED
];
