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
const discount_model_1 = __importDefault(require("./discount.model"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const http_status_1 = __importDefault(require("http-status"));
const app_error_1 = __importDefault(require("../utils/app.error"));
const utils_1 = require("../utils");
const moment_1 = __importDefault(require("moment"));
const __1 = require("..");
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const sendPushNotification_1 = require("../utils/sendPushNotification");
const testBooking_model_1 = __importDefault(require("../testBooking(Cart)/testBooking.model"));
class DiscountController {
    static createDiscount(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                (0, utils_1.handleRequiredFields)(req, ["code", "percentage", "validUntil"]);
                const { code, percentage, validUntil, isHidden } = req.body;
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                const existing = yield discount_model_1.default.findOne({
                    code: code.toUpperCase(),
                    isDeleted: false
                });
                if (existing) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Discount code already exists. Please choose a different one.");
                }
                const discount = yield discount_model_1.default.create({
                    clinic: clinicId,
                    code: code.toUpperCase(),
                    percentage,
                    validUntil: (0, moment_1.default)(validUntil).toDate(),
                    status: 0,
                    isHidden: !!isHidden
                });
                if (!discount.isHidden) {
                    __1.io.emit("discount:create", { clinicId, discount });
                    const restrictedClinicEmail = "damilolasanni48@gmail.com";
                    const allowedPatientEmail = "sannifortune11@gmail.com";
                    if (clinic.email === restrictedClinicEmail) {
                        const patient = yield patient_model_1.default.findOne({
                            email: allowedPatientEmail,
                            expoPushToken: { $ne: null },
                            isDeleted: false
                        });
                        if (patient === null || patient === void 0 ? void 0 : patient.expoPushToken) {
                            yield (0, sendPushNotification_1.sendPushNotification)({
                                expoPushToken: patient.expoPushToken,
                                title: "New Discount Available 🎉",
                                message: `${(_a = clinic.clinicName) === null || _a === void 0 ? void 0 : _a.toUpperCase()} is offering ${discount.percentage}% OFF with code ${discount.code}`,
                                type: "info",
                                data: {
                                    screen: "one_clinic",
                                    id: clinic._id.toString(),
                                    discountId: discount._id.toString()
                                }
                            });
                        }
                    }
                    else {
                        const patients = yield patient_model_1.default.find({ expoPushToken: { $ne: null }, isDeleted: false }, { expoPushToken: 1 });
                        const uniqueTokens = Array.from(new Set(patients.map((p) => p.expoPushToken)));
                        const pushPayloads = uniqueTokens.map((token) => {
                            var _a;
                            return (0, sendPushNotification_1.sendPushNotification)({
                                expoPushToken: token,
                                title: "New Discount Available 🎉",
                                message: `${(_a = clinic.clinicName) === null || _a === void 0 ? void 0 : _a.toUpperCase()} is offering ${discount.percentage}% OFF with code ${discount.code}`,
                                type: "info",
                                data: {
                                    screen: "one_clinic",
                                    id: clinic._id.toString(),
                                    discountId: discount._id.toString()
                                }
                            });
                        });
                        yield Promise.all(pushPayloads);
                    }
                }
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Discount created successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static listClinicDiscounts(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { page = "1", limit = "10", status, code } = req.query;
                const pageNumber = parseInt(page, 10) || 1;
                const limitNumber = parseInt(limit, 10) || 10;
                const skip = (pageNumber - 1) * limitNumber;
                const filter = {
                    clinic: clinicId,
                    isDeleted: false
                };
                if (status !== undefined && status !== "") {
                    const parsedStatus = parseInt(status, 10);
                    if (!isNaN(parsedStatus)) {
                        filter.status = parsedStatus;
                    }
                }
                if (code) {
                    filter.code = { $regex: new RegExp(code, "i") };
                }
                yield discount_model_1.default.updateMany({ clinic: clinicId, validUntil: { $lt: new Date() }, status: 0 }, { $set: { status: 1 } });
                const discounts = yield discount_model_1.default
                    .find(filter)
                    .select("code percentage status validUntil createdAt updatedAt discountNo isHidden")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNumber)
                    .lean();
                const formattedDiscounts = discounts.map((d) => {
                    const daysLeft = (0, moment_1.default)(d.validUntil).diff((0, moment_1.default)(), "days");
                    let warning = null;
                    if (d.status === 0 && daysLeft <= 7 && daysLeft >= 0) {
                        warning = `⚠️ Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
                    }
                    else if (d.status === 1) {
                        warning = "Expired";
                    }
                    return {
                        discountNo: d.discountNo,
                        code: d.code,
                        percentage: d.percentage,
                        status: d.status,
                        validUntil: (0, moment_1.default)(d.validUntil).format("DD MMM YYYY"),
                        createdAt: (0, moment_1.default)(d.createdAt).format("DD MMM YYYY, h:mm A"),
                        updatedAt: (0, moment_1.default)(d.updatedAt).format("DD MMM YYYY, h:mm A"),
                        warning,
                        isHidden: d.isHidden
                    };
                });
                const totalDiscounts = yield discount_model_1.default.countDocuments(filter);
                const totalDiscountsInDatabase = yield discount_model_1.default.countDocuments({
                    clinic: clinicId,
                    isDeleted: false
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Discounts retrieved successfully.",
                    hasNoDiscounts: totalDiscountsInDatabase === 0,
                    data: formattedDiscounts,
                    pagination: {
                        currentPage: pageNumber,
                        totalPages: Math.ceil(totalDiscounts / limitNumber),
                        totalDiscounts
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deleteDiscount(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { id } = req.params;
                const discount = yield discount_model_1.default.findOneAndUpdate({ discountNo: id, clinic: clinicId, isDeleted: false }, { $set: { isDeleted: true } }, { new: true });
                if (!discount)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Discount not found.");
                __1.io.emit("discount:delete", { clinicId, discountId: discount._id });
                res.json({ success: true, message: "Discount deleted successfully." });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getActiveDiscountsForClinic(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { clinicId } = req.params;
                const clinic = yield clinic_model_1.default.findOne({ clinicId, status: "approved" });
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                yield discount_model_1.default.updateMany({ clinic: clinic._id, validUntil: { $lt: new Date() }, status: 0 }, { $set: { status: 1 } });
                const discounts = yield discount_model_1.default
                    .find({
                    clinic: clinic._id,
                    validUntil: { $gte: new Date() },
                    status: 0,
                    isDeleted: false,
                    isHidden: false
                })
                    .select("-_id -clinic -__v");
                res.json({ success: true, data: discounts });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static applyDiscount(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["clinicId", "code", "amount"]);
                const { clinicId, code, amount } = req.body;
                const patientId = (0, utils_1.getPatientId)(req);
                const normalizedCode = code.toUpperCase();
                const now = moment_1.default.utc();
                yield discount_model_1.default.updateMany({ clinic: clinicId, validUntil: { $lt: now.toDate() }, status: 0 }, { $set: { status: 1 } });
                const activeDiscounts = yield discount_model_1.default.countDocuments({
                    clinic: clinicId,
                    status: 0,
                    isDeleted: false,
                    validUntil: { $gte: now.toDate() }
                });
                if (activeDiscounts === 0) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "This clinic does not currently have any active discount codes.");
                }
                const discount = yield discount_model_1.default.findOne({
                    clinic: clinicId,
                    code: normalizedCode,
                    status: 0,
                    isDeleted: false,
                    validUntil: { $gte: now.toDate() }
                });
                if (!discount) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid discount code.");
                }
                if (!(0, moment_1.default)(discount.validUntil).isAfter(now)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Discount code has expired.");
                }
                const finalPrice = amount - (amount * discount.percentage) / 100;
                yield testBooking_model_1.default.updateMany({ patient: patientId, clinic: clinicId, status: "pending" }, {
                    $set: {
                        "discount.code": discount.code,
                        "discount.percentage": discount.percentage,
                        "discount.finalPrice": finalPrice,
                        "discount.expiresAt": discount.validUntil
                    }
                });
                res.json({
                    success: true,
                    message: "Discount applied successfully.",
                    data: {
                        discountCode: discount.code,
                        percentage: discount.percentage,
                        newTotal: finalPrice,
                        expiresAt: (0, moment_1.default)(discount.validUntil).format("YYYY-MM-DD HH:mm:ss")
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static applyDiscountPublic(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["clinicId", "code", "amount"]);
                const { clinicId, code, amount } = req.body;
                const normalizedCode = code.toUpperCase();
                const now = moment_1.default.utc();
                const clinic = yield clinic_model_1.default.findOne({ clinicId, status: "approved" });
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                yield discount_model_1.default.updateMany({ clinic: clinic._id, validUntil: { $lt: now.toDate() }, status: 0 }, { $set: { status: 1 } });
                const activeDiscounts = yield discount_model_1.default.countDocuments({
                    clinic: clinic._id,
                    status: 0,
                    isDeleted: false,
                    validUntil: { $gte: now.toDate() }
                });
                if (activeDiscounts === 0) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "This clinic does not currently have any active discount codes.");
                }
                const discount = yield discount_model_1.default.findOne({
                    clinic: clinic._id,
                    code: normalizedCode,
                    status: 0,
                    isDeleted: false,
                    validUntil: { $gte: now.toDate() }
                });
                if (!discount) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid discount code.");
                }
                if (!(0, moment_1.default)(discount.validUntil).isAfter(now)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Discount code has expired.");
                }
                const discountAmount = (amount * discount.percentage) / 100;
                const finalPrice = amount - discountAmount;
                res.json({
                    success: true,
                    message: "Discount applied successfully.",
                    data: {
                        discountCode: discount.code,
                        percentage: discount.percentage,
                        discountAmount,
                        newTotal: finalPrice,
                        expiresAt: (0, moment_1.default)(discount.validUntil).format("YYYY-MM-DD HH:mm:ss")
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = DiscountController;
