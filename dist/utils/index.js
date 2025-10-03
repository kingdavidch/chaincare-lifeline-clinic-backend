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
exports.formatPhone = exports.formatDOB = exports.generateOrderID = exports.generateEmailOTP = exports.uploadToCloudinary = exports.validateObjectId = exports.handleRequiredFields = void 0;
exports.getClinicId = getClinicId;
exports.getAdminId = getAdminId;
exports.getPatientId = getPatientId;
exports.escapeRegex = escapeRegex;
exports.validatePhoneWithPawaPay = validatePhoneWithPawaPay;
/* eslint-disable @typescript-eslint/no-explicit-any */
const axios_1 = __importDefault(require("axios"));
require("dotenv/config");
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importDefault(require("mongoose"));
const otp_generator_1 = __importDefault(require("otp-generator"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const app_error_1 = __importDefault(require("./app.error"));
const handleRequiredFields = (req, requiredFields) => {
    const missingFields = requiredFields.filter((field) => !(field in req.body));
    if (missingFields.length > 0) {
        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Please ensure all required fields are provided.");
    }
};
exports.handleRequiredFields = handleRequiredFields;
const validateObjectId = (id, fieldName = "ID") => {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, `${fieldName} is not a valid MongoDB ObjectId`);
    }
};
exports.validateObjectId = validateObjectId;
const uploadToCloudinary = (buffer, resourceType, folder, options = {}) => {
    return new Promise((resolve, reject) => {
        cloudinary_1.default.v2.uploader
            .upload_stream({
            resource_type: resourceType,
            folder: folder,
            public_id: options.public_id,
            tags: options.tags
        }, (error, result) => {
            if (error) {
                return reject(new Error(`Cloudinary Upload Error: ${error.message}. Status Code: ${error.http_code}`));
            }
            if (!result) {
                return reject(new Error("No result from Cloudinary."));
            }
            resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
                format: result.format,
                resource_type: result.resource_type
            });
        })
            .end(buffer);
    });
};
exports.uploadToCloudinary = uploadToCloudinary;
function getClinicId(req) {
    var _a;
    return (_a = req === null || req === void 0 ? void 0 : req.clinic) === null || _a === void 0 ? void 0 : _a.id;
}
function getAdminId(req) {
    var _a;
    return (_a = req === null || req === void 0 ? void 0 : req.admin) === null || _a === void 0 ? void 0 : _a.id;
}
function getPatientId(req) {
    var _a;
    return (_a = req === null || req === void 0 ? void 0 : req.patient) === null || _a === void 0 ? void 0 : _a.id;
}
const generateEmailOTP = () => {
    return otp_generator_1.default.generate(4, {
        upperCaseAlphabets: false,
        specialChars: false,
        digits: true,
        lowerCaseAlphabets: false
    });
};
exports.generateEmailOTP = generateEmailOTP;
const generateOrderID = () => {
    const prefix = "LFC-";
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${randomNum}`;
};
exports.generateOrderID = generateOrderID;
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function validatePhoneWithPawaPay(phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const apiUrl = `${process.env.PAWAPAY_API_URL}/v2`;
        try {
            const response = yield axios_1.default.post(`${apiUrl}/predict-provider`, { phoneNumber }, {
                headers: {
                    Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
                    "Content-Type": "application/json"
                },
                timeout: 5000
            });
            const data = response.data;
            if (data.failureReason) {
                const { failureCode, failureMessage } = data.failureReason;
                throw new app_error_1.default(http_status_1.default.BAD_REQUEST, `PawaPay error (${failureCode}): ${failureMessage}`);
            }
            return {
                sanitizedPhone: data.phoneNumber,
                provider: data.provider,
                country: data.country
            };
        }
        catch (err) {
            throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Phone number validation failed", ((_b = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || "Invalid or unsupported number");
        }
    });
}
const formatDOB = (dob) => {
    const date = new Date(dob);
    return `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date
        .getDate()
        .toString()
        .padStart(2, "0")}/${date.getFullYear()}`;
};
exports.formatDOB = formatDOB;
const formatPhone = (phone) => {
    // Convert 07xxxxxxxx to +2507xxxxxxxx
    return phone.startsWith("+") ? phone : `+250${phone.replace(/^0/, "")}`;
};
exports.formatPhone = formatPhone;
