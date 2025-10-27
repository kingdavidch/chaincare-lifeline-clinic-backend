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
/* eslint-disable @typescript-eslint/no-explicit-any */
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
require("dotenv/config");
const http_status_1 = __importDefault(require("http-status"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const moment_1 = __importDefault(require("moment"));
const mongoose_1 = __importDefault(require("mongoose"));
const uuid_1 = require("uuid");
const __1 = require("..");
const order_model_1 = __importDefault(require("../order/order.model"));
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const payment_service_1 = require("../payment/payment.service");
const withdrawal_model_1 = __importDefault(require("../payment/withdrawal.model"));
const smtp_clinic_service_1 = __importDefault(require("../smtp/clinic/smtp.clinic.service"));
const subscription_model_1 = __importDefault(require("../subscription/subscription.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
const testBooking_model_1 = __importDefault(require("../testBooking(Cart)/testBooking.model"));
const utils_1 = require("../utils");
const app_error_1 = __importDefault(require("../utils/app.error"));
const password_utils_1 = require("../utils/password.utils");
const clinic_model_1 = __importDefault(require("./clinic.model"));
const clinic_notification_model_1 = __importDefault(require("./clinic.notification.model"));
const utils_2 = require("../admin/utils");
const test_item_model_1 = __importDefault(require("../test/test.item.model"));
const world_countries_1 = __importDefault(require("world-countries"));
const currency_symbol_map_1 = __importDefault(require("currency-symbol-map"));
const discount_model_1 = __importDefault(require("../discount/discount.model"));
const practitionercategory_model_1 = __importDefault(require("./practitionercategory.model"));
class ClinicController {
    static signup(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                (0, utils_1.handleRequiredFields)(req, [
                    "clinicName",
                    "email",
                    "phoneNo",
                    "stateOrProvince",
                    "cityOrDistrict",
                    "street",
                    "postalCode",
                    "password",
                    "country",
                    "termsAccepted"
                ]);
                const { clinicName, email, phoneNo, stateOrProvince, cityOrDistrict, street, postalCode, coordinates, password, termsAccepted, country } = req.body;
                const matchedCountry = world_countries_1.default.find((c) => c.name.common.toLowerCase() === country.toLowerCase());
                const currencyCode = matchedCountry
                    ? Object.keys(matchedCountry.currencies || {})[0]
                    : "RWF";
                const currencySymbol = (0, currency_symbol_map_1.default)(currencyCode) || "$";
                const existingPatientByEmail = yield patient_model_1.default.findOne({ email });
                const existingClinicByEmail = yield clinic_model_1.default.findOne({ email });
                if (existingPatientByEmail || existingClinicByEmail) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "An account with this email already exists.");
                }
                const existingPatientPhone = yield patient_model_1.default.findOne({ phoneNo });
                const existingClinicPhone = yield clinic_model_1.default.findOne({ phoneNo });
                if (existingPatientPhone || existingClinicPhone) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "Phone number is already in use.");
                }
                const existingClinicName = yield clinic_model_1.default.findOne({
                    clinicName: { $regex: new RegExp(`^${clinicName}$`, "i") }
                });
                if (existingClinicName) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "A clinic with this name already exists.");
                }
                if (!termsAccepted) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "You must accept the terms and policies.");
                }
                const hashedPassword = yield (0, password_utils_1.hashPassword)(password);
                const location = {
                    stateOrProvince: stateOrProvince || null,
                    cityOrDistrict: cityOrDistrict || null,
                    street: street || null,
                    postalCode: postalCode || null,
                    coordinates: coordinates
                        ? {
                            latitude: (_a = coordinates.latitude) !== null && _a !== void 0 ? _a : null,
                            longitude: (_b = coordinates.longitude) !== null && _b !== void 0 ? _b : null
                        }
                        : { latitude: null, longitude: null }
                };
                const formattedUsername = clinicName
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, "_");
                const existingUsername = yield clinic_model_1.default.findOne({
                    username: formattedUsername
                });
                if (existingUsername) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "Clinic name already in use, please choose another.");
                }
                const newClinic = new clinic_model_1.default({
                    clinicName,
                    email,
                    phoneNo,
                    location,
                    password: hashedPassword,
                    termsAccepted,
                    country,
                    currencySymbol,
                    username: formattedUsername
                });
                yield newClinic.save();
                yield (0, utils_2.notifyAdmin)("New Clinic Registration", `Clinic "${clinicName}" has just signed up and is awaiting approval.`, "info");
                yield smtp_clinic_service_1.default.sendClinicVerificationEmail(newClinic)
                    .then(() => console.log("Verification email sent successfully."))
                    .catch((error) => console.error("Error sending verification email:", error));
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Registration successful. Please verify your email.",
                    data: { email: newClinic.email, id: newClinic.clinicId }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getCookieOptions(maxAge) {
        return {
            httpOnly: true,
            secure: ClinicController.isProd,
            sameSite: "none",
            domain: ClinicController.isProd ? ".mylifeline.world" : undefined,
            maxAge
        };
    }
    static login(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email", "password"]);
                const email = req.body.email.trim().toLowerCase();
                const password = req.body.password;
                const clinic = yield clinic_model_1.default.findOne({ email });
                if (!clinic)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Invalid email or password.");
                if (!clinic.isVerified) {
                    throw new app_error_1.default(http_status_1.default.FORBIDDEN, "Your account is not verified. Please verify your email.");
                }
                const isPasswordValid = yield (0, password_utils_1.comparePasswords)(password, clinic.password);
                if (!isPasswordValid) {
                    throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Invalid email or password.");
                }
                const payload = {
                    id: clinic._id.toString(),
                    email: clinic.email,
                    clinicName: clinic.clinicName
                };
                const accessToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, {
                    expiresIn: "15m"
                });
                const refreshToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "30d" });
                res
                    .cookie("token", accessToken, ClinicController.getCookieOptions(1000 * 60 * 15))
                    .cookie("refreshToken", refreshToken, ClinicController.getCookieOptions(1000 * 60 * 60 * 24 * 30))
                    .status(http_status_1.default.OK)
                    .json({
                    success: true,
                    message: "Login successful",
                    id: clinic === null || clinic === void 0 ? void 0 : clinic.clinicId,
                    accessToken,
                    expiresIn: "15min"
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static refreshToken(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const token = req.cookies.refreshToken;
                if (!token) {
                    throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Missing refresh token.");
                }
                const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_REFRESH_SECRET);
                const newAccessToken = jsonwebtoken_1.default.sign({
                    id: payload.id,
                    email: payload.email,
                    clinicName: payload.clinicName
                }, process.env.JWT_SECRET, { expiresIn: "15m" });
                res
                    .cookie("token", newAccessToken, ClinicController.getCookieOptions(1000 * 60 * 15))
                    .status(http_status_1.default.OK)
                    .json({
                    success: true,
                    accessToken: newAccessToken,
                    message: "Token refreshed successfully"
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.clearCookie("token", ClinicController.getCookieOptions(0));
            res.clearCookie("refreshToken", ClinicController.getCookieOptions(0));
            res
                .status(http_status_1.default.OK)
                .json({ success: true, message: "Logged out successfully" });
        });
    }
    static verifyClinic(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { key } = req.query;
                if (!key || typeof key !== "string") {
                    return res.redirect(`${smtp_clinic_service_1.default.FRONTEND_URL}/login?status=invalid-link`);
                }
                const clinic = yield clinic_model_1.default.findOne({ clinicId: key });
                if (!clinic) {
                    return res.redirect(`${smtp_clinic_service_1.default.FRONTEND_URL}/login?status=invalid-link`);
                }
                clinic.isVerified = true;
                yield clinic.save();
                return res.redirect(`${smtp_clinic_service_1.default.FRONTEND_URL}/login?status=verified`);
            }
            catch (error) {
                return res.redirect(`${smtp_clinic_service_1.default.FRONTEND_URL}/login?status=failure`);
            }
        });
    }
    static forgotPassword(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email"]);
                const { email } = req.body;
                const clinic = yield clinic_model_1.default.findOne({ email });
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Account not found.");
                }
                const resetToken = crypto_1.default.randomBytes(32).toString("hex");
                const hashedToken = crypto_1.default
                    .createHash("sha256")
                    .update(resetToken)
                    .digest("hex");
                clinic.resetPasswordToken = hashedToken;
                clinic.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
                yield clinic.save();
                yield smtp_clinic_service_1.default.sendClinicResetPasswordEmail(clinic, resetToken)
                    .then(() => {
                    console.log("email sent successfully.");
                })
                    .catch((error) => {
                    console.error("Error sending email:", error);
                });
                yield clinic_notification_model_1.default.create({
                    clinic: clinic._id,
                    title: "Password Reset Requested",
                    message: "A password reset has been requested for your account.",
                    type: "info"
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Password reset link has been sent to your email."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static resetPassword(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["token", "newPassword", "confirmPassword"]);
                const { token, newPassword, confirmPassword } = req.body;
                if (newPassword !== confirmPassword) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Passwords do not match.");
                }
                const hashedToken = crypto_1.default
                    .createHash("sha256")
                    .update(token)
                    .digest("hex");
                const clinic = yield clinic_model_1.default.findOne({
                    resetPasswordToken: hashedToken,
                    resetPasswordExpires: { $gt: Date.now() }
                });
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Token is invalid or has expired.");
                }
                clinic.password = yield (0, password_utils_1.hashPassword)(newPassword);
                clinic.resetPasswordToken = undefined;
                clinic.resetPasswordExpires = undefined;
                yield clinic.save();
                yield clinic_notification_model_1.default.create({
                    clinic: clinic._id,
                    title: "Password Reset Successful",
                    message: "Your password has been successfully reset.",
                    type: "info"
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Password has been reset successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static resendVerificationLink(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email"]);
                const { email } = req.body;
                const clinic = yield clinic_model_1.default.findOne({ email });
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Account not found.");
                }
                if (clinic.isVerified) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Account is already verified.");
                }
                yield smtp_clinic_service_1.default.sendClinicVerificationEmail(clinic)
                    .then(() => {
                    console.log("Verification email sent successfully.");
                })
                    .catch((error) => {
                    console.error("Error sending verification email:", error);
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "A new verification link has been sent to your email."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getClinic(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId)
                    .select("-password -resetPasswordToken -resetPasswordExpires -tests -certificate -termsAccepted")
                    .populate({
                    path: "reviews",
                    select: "rating comment patient createdAt",
                    options: { sort: { createdAt: -1 }, limit: 10 },
                    populate: {
                        path: "patient",
                        select: "fullName"
                    }
                });
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const discounts = yield discount_model_1.default
                    .find({
                    clinic: clinicId,
                    validUntil: { $gte: new Date() },
                    status: 0,
                    isDeleted: false,
                    isHidden: false
                })
                    .select("code percentage validUntil status isHidden createdAt updatedAt discountNo -_id")
                    .lean();
                const shareUrl = `${process.env.CLINIC_PUBLIC_URL}/${clinic.username}`;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic information retrieved successfully.",
                    data: Object.assign(Object.assign({}, clinic.toObject()), { discounts: discounts || [], shareUrl })
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateClinicProfile(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const { clinicName, bio, email, phoneNo, stateOrProvince, cityOrDistrict, street, postalCode, coordinates, password, country, supportInsurance, onlineStatus, languages, deliveryMethods, username, socialMedia, practitionerType } = req.body;
                let profilePhotoUrl = clinic.avatar;
                // Check if the email already exists in either patients or clinics
                if (email) {
                    const existingPatientByEmail = yield patient_model_1.default.findOne({ email });
                    const existingClinicByEmail = yield clinic_model_1.default.findOne({
                        email,
                        _id: { $ne: clinicId }
                    });
                    if (existingPatientByEmail || existingClinicByEmail) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "An account with this email already exists.");
                    }
                }
                if (phoneNo) {
                    const existingPatientPhone = yield patient_model_1.default.findOne({
                        phoneNumber: phoneNo
                    });
                    const existingClinicPhone = yield clinic_model_1.default.findOne({
                        phoneNo,
                        _id: { $ne: clinicId }
                    });
                    if (existingPatientPhone || existingClinicPhone) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "Phone number is already in use.");
                    }
                }
                if (req.file) {
                    const result = yield (0, utils_1.uploadToCloudinary)(req.file.buffer, "image", `clinic_avatars/${req.file.originalname}`);
                    profilePhotoUrl = result.secure_url;
                }
                const updatedFields = [];
                if (clinicName) {
                    clinic.clinicName = clinicName;
                    updatedFields.push("clinicName");
                }
                if (onlineStatus) {
                    clinic.onlineStatus = onlineStatus;
                    updatedFields.push("onlineStatus");
                }
                if (phoneNo) {
                    clinic.phoneNo = phoneNo;
                    updatedFields.push("phoneNo");
                }
                if (practitionerType) {
                    clinic.practitionerType = practitionerType.toLowerCase().trim();
                    updatedFields.push("practitionerType");
                }
                if (bio) {
                    clinic.bio = bio;
                    updatedFields.push("bio");
                }
                if (!clinic.location) {
                    clinic.location = {
                        stateOrProvince: "",
                        cityOrDistrict: "",
                        street: "",
                        postalCode: "",
                        coordinates: { latitude: 0, longitude: 0 }
                    };
                }
                if (stateOrProvince) {
                    clinic.location.stateOrProvince = stateOrProvince;
                    updatedFields.push("stateOrProvince");
                }
                if (cityOrDistrict) {
                    clinic.location.cityOrDistrict = cityOrDistrict;
                    updatedFields.push("cityOrDistrict");
                }
                if (street) {
                    clinic.location.street = street;
                    updatedFields.push("street");
                }
                if (postalCode) {
                    clinic.location.postalCode = postalCode;
                    updatedFields.push("postalCode");
                }
                if (coordinates) {
                    clinic.location.coordinates = JSON.parse(coordinates);
                    updatedFields.push("coordinates");
                }
                if (country) {
                    clinic.country = country;
                    updatedFields.push("country");
                }
                if (password) {
                    clinic.password = yield (0, password_utils_1.hashPassword)(password);
                    updatedFields.push("password");
                }
                if (supportInsurance) {
                    clinic.supportInsurance = JSON.parse(supportInsurance);
                    updatedFields.push("supportInsurance");
                }
                if (profilePhotoUrl) {
                    clinic.avatar = profilePhotoUrl;
                    updatedFields.push("avatar");
                }
                if (languages) {
                    clinic.languages = JSON.parse(languages);
                    updatedFields.push("languages");
                }
                if (username) {
                    const formattedUsername = username
                        .toLowerCase()
                        .trim()
                        .replace(/\s+/g, "_");
                    const existingUsername = yield clinic_model_1.default.findOne({
                        username: formattedUsername,
                        _id: { $ne: clinicId }
                    });
                    if (existingUsername) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "Username already in use.");
                    }
                    clinic.username = formattedUsername;
                    updatedFields.push("username");
                }
                if (deliveryMethods) {
                    const parsedDelivery = Array.isArray(deliveryMethods)
                        ? deliveryMethods
                        : JSON.parse(deliveryMethods);
                    clinic.deliveryMethods = parsedDelivery;
                    updatedFields.push("deliveryMethods");
                }
                if (socialMedia) {
                    try {
                        const parsedSocial = typeof socialMedia === "string"
                            ? JSON.parse(socialMedia)
                            : socialMedia;
                        clinic.socialMedia = parsedSocial;
                        clinic.markModified("socialMedia");
                        updatedFields.push("socialMedia");
                    }
                    catch (err) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid socialMedia format");
                    }
                }
                yield clinic.save();
                __1.io.emit("clinic:update", { clinicId, updatedFields });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Profile updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateClinicCategories(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { categories } = req.body;
                if (!Array.isArray(categories) || categories.length === 0) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Categories are required.");
                }
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const validCategories = yield practitionercategory_model_1.default.find({
                    _id: { $in: categories }
                });
                if (validCategories.length !== categories.length) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Some categories are invalid.");
                }
                clinic.categories = categories;
                yield clinic.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic categories updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getAllPatients(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const skip = (page - 1) * limit;
                const { status } = req.query;
                // Prepare status filter
                const validStatuses = ["active", "locked", "expired"];
                const isStatusFilterApplied = status && validStatuses.includes(status.toString().toLowerCase());
                // Fetch subscriptions (filtered by status if provided)
                const subscriptions = yield subscription_model_1.default
                    .find(isStatusFilterApplied
                    ? { status: status.toString().toLowerCase() }
                    : {})
                    .select("patient status");
                const patientIds = subscriptions.map((s) => s.patient.toString());
                // Fetch only patients that match filtered subscriptions (if status is applied)
                const patientQuery = isStatusFilterApplied
                    ? { _id: { $in: patientIds } }
                    : {};
                // Get total matching patients before pagination
                const totalMatchingPatients = yield patient_model_1.default.countDocuments(patientQuery);
                // Fetch paginated patients
                const patients = yield patient_model_1.default.find(patientQuery)
                    .sort({ createdAt: -1 })
                    .select("patientId fullName email phoneNumber")
                    .skip(skip)
                    .limit(limit);
                const patientStatusMap = subscriptions.reduce((acc, sub) => {
                    acc[sub.patient.toString()] = sub.status.toLowerCase();
                    return acc;
                }, {});
                const formattedPatients = patients.map((patient) => ({
                    patientId: patient.patientId,
                    patientName: patient.fullName,
                    email: patient.email,
                    phoneNumber: patient.phoneNumber,
                    status: patientStatusMap[patient._id.toString()] || "not member"
                }));
                // Total patients in DB (not filtered)
                const totalPatientsInDatabase = yield patient_model_1.default.countDocuments();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All patients retrieved successfully.",
                    hasNoPatients: totalPatientsInDatabase === 0,
                    data: {
                        patients: formattedPatients,
                        pagination: {
                            totalPages: Math.ceil(totalMatchingPatients / limit),
                            currentPage: page,
                            totalRecords: totalMatchingPatients
                        }
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get clinic earnings and total tests conducted
     */
    static getEarnings(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId).select("balance");
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const balance = clinic.balance || 0;
                const totalTests = yield test_model_1.default.countDocuments({
                    clinic: clinicId,
                    isDeleted: false
                });
                const startOfMonth = (0, moment_1.default)().startOf("month").toDate();
                const startOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .startOf("month")
                    .toDate();
                const endOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .endOf("month")
                    .toDate();
                const thisMonthEarnings = yield order_model_1.default.aggregate([
                    {
                        $match: {
                            clinic: new mongoose_1.default.Types.ObjectId(clinicId),
                            paymentStatus: "paid",
                            paymentMethod: { $in: ["pawa_pay", "yellow_card"] },
                            createdAt: { $gte: startOfMonth }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
                ]);
                const lastMonthEarnings = yield order_model_1.default.aggregate([
                    {
                        $match: {
                            clinic: new mongoose_1.default.Types.ObjectId(clinicId),
                            paymentStatus: "paid",
                            paymentMethod: { $in: ["pawa_pay", "yellow_card"] },
                            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
                ]);
                const startOfLastWeek = (0, moment_1.default)()
                    .subtract(1, "week")
                    .startOf("week")
                    .toDate();
                const endOfLastWeek = (0, moment_1.default)().subtract(1, "week").endOf("week").toDate();
                const lastWeekTests = yield test_model_1.default
                    .countDocuments({
                    clinic: clinicId,
                    createdAt: { $gte: startOfLastWeek, $lte: endOfLastWeek }
                })
                    .setOptions({ includeDeleted: true });
                const thisMonthEarningsValue = ((_a = thisMonthEarnings === null || thisMonthEarnings === void 0 ? void 0 : thisMonthEarnings[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
                const lastMonthEarningsValue = ((_b = lastMonthEarnings === null || lastMonthEarnings === void 0 ? void 0 : lastMonthEarnings[0]) === null || _b === void 0 ? void 0 : _b.total) || 0;
                const percentageChangeEarnings = lastMonthEarningsValue > 0
                    ? ((thisMonthEarningsValue - lastMonthEarningsValue) /
                        lastMonthEarningsValue) *
                        100
                    : thisMonthEarningsValue > 0
                        ? 100
                        : 0;
                const lastMonthCreditedBalance = lastMonthEarningsValue * 0.955;
                const percentageChangeBalance = lastMonthCreditedBalance > 0
                    ? ((balance - lastMonthCreditedBalance) / lastMonthCreditedBalance) *
                        100
                    : balance > 0
                        ? 100
                        : 0;
                const percentageChangeTests = lastWeekTests > 0
                    ? ((totalTests - lastWeekTests) / lastWeekTests) * 100
                    : totalTests > 0
                        ? 100
                        : 0;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic earnings and test count retrieved successfully.",
                    data: {
                        earnings: {
                            amount: thisMonthEarningsValue,
                            percentageChange: percentageChangeEarnings.toFixed(1)
                        },
                        balance: {
                            amount: balance,
                            percentageChange: percentageChangeBalance.toFixed(1)
                        },
                        totalTests: {
                            amount: totalTests,
                            percentageChange: percentageChangeTests.toFixed(1)
                        }
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get clinic earnings overview (daily, weekly, monthly, yearly)
     */
    static getEarningsOverview(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const filter = req.query.filter || "monthly";
                let startDate;
                let groupFormat;
                switch (filter) {
                    case "daily":
                        startDate = (0, moment_1.default)().subtract(30, "days").toDate();
                        groupFormat = "%Y-%m-%d";
                        break;
                    case "weekly":
                        startDate = (0, moment_1.default)().subtract(12, "weeks").toDate();
                        groupFormat = "%Y-%U";
                        break;
                    case "yearly":
                        startDate = (0, moment_1.default)().subtract(5, "years").toDate();
                        groupFormat = "%Y";
                        break;
                    case "monthly":
                    default:
                        startDate = (0, moment_1.default)().subtract(12, "months").toDate();
                        groupFormat = "%Y-%m";
                        break;
                }
                const earningsData = yield order_model_1.default.aggregate([
                    {
                        $match: {
                            clinic: new mongoose_1.default.Types.ObjectId(clinicId),
                            paymentStatus: "paid",
                            createdAt: { $gte: startDate }
                        }
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
                            totalEarnings: { $sum: "$totalAmount" }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);
                const formattedData = earningsData.map((entry) => ({
                    period: entry._id,
                    earnings: +(entry.totalEarnings * 0.955).toFixed(2)
                }));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic earnings overview retrieved successfully.",
                    data: formattedData
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getTestDistribution(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = new mongoose_1.default.Types.ObjectId((0, utils_1.getClinicId)(req));
                const homeTestsCount = yield testBooking_model_1.default.countDocuments({
                    clinic: clinicId,
                    testLocation: "home",
                    status: "completed"
                });
                const onSiteTestsCount = yield testBooking_model_1.default.countDocuments({
                    clinic: clinicId,
                    testLocation: "on-site",
                    status: "completed"
                });
                const totalTests = homeTestsCount + onSiteTestsCount;
                const homePercentage = totalTests > 0 ? +((homeTestsCount / totalTests) * 100).toFixed(1) : 0;
                const onSitePercentage = totalTests > 0 ? +((onSiteTestsCount / totalTests) * 100).toFixed(1) : 0;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic test distribution retrieved successfully.",
                    data: {
                        homeTests: {
                            count: homeTestsCount,
                            percentage: homePercentage
                        },
                        onSiteTests: {
                            count: onSiteTestsCount,
                            percentage: onSitePercentage
                        }
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get clinic test sales data (Daily, Weekly, Monthly, Yearly)
     */
    static getTestSales(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { filter = "monthly", testName } = req.query;
                let startDate;
                let groupFormat;
                switch (filter) {
                    case "daily":
                        startDate = (0, moment_1.default)().subtract(30, "days").toDate();
                        groupFormat = "%Y-%m-%d";
                        break;
                    case "weekly":
                        startDate = (0, moment_1.default)().subtract(12, "weeks").toDate();
                        groupFormat = "%Y-%U";
                        break;
                    case "yearly":
                        startDate = (0, moment_1.default)().subtract(5, "years").toDate();
                        groupFormat = "%Y";
                        break;
                    case "monthly":
                    default:
                        startDate = (0, moment_1.default)().subtract(12, "months").toDate();
                        groupFormat = "%Y-%m";
                        break;
                }
                const matchStage = {
                    clinic: new mongoose_1.default.Types.ObjectId(clinicId),
                    paymentStatus: "paid",
                    createdAt: { $gte: startDate }
                };
                const pipeline = [{ $match: matchStage }, { $unwind: "$tests" }];
                if (testName) {
                    pipeline.push({
                        $match: { "tests.testName": testName }
                    });
                }
                pipeline.push({
                    $group: {
                        _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
                        totalSales: { $sum: "$tests.price" }
                    }
                }, { $sort: { _id: 1 } });
                const salesData = yield order_model_1.default.aggregate(pipeline);
                const formattedData = salesData.map((entry) => ({
                    period: entry._id,
                    sales: entry.totalSales
                }));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic test sales data retrieved successfully.",
                    data: formattedData
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get the top 2 most popular tests based on bookings
     */
    static getPopularTests(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = new mongoose_1.default.Types.ObjectId((0, utils_1.getClinicId)(req));
                const popularTests = yield testBooking_model_1.default.aggregate([
                    {
                        $match: {
                            clinic: clinicId,
                            status: { $in: ["booked", "completed"] }
                        }
                    },
                    {
                        $group: {
                            _id: "$test",
                            totalBookings: { $sum: 1 }
                        }
                    },
                    { $sort: { totalBookings: -1 } },
                    { $limit: 2 }
                ]);
                const testIds = popularTests.map((test) => test._id);
                const testDetails = yield test_model_1.default
                    .find({ _id: { $in: testIds } })
                    .setOptions({ includeDeleted: true })
                    .select("testName price")
                    .lean();
                const formattedTests = popularTests.map((test) => {
                    const matched = testDetails.find((t) => t._id.toString() === test._id.toString());
                    return {
                        testName: (matched === null || matched === void 0 ? void 0 : matched.testName) || "Unknown Test",
                        price: (matched === null || matched === void 0 ? void 0 : matched.price) || 0,
                        totalBookings: test.totalBookings
                    };
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Top 2 popular tests retrieved successfully.",
                    data: formattedTests
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get patient statistics including all patients, members, and active patients
     */
    static getPatientMetrics(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.getClinicId)(req);
                // Timestamps for calculations
                const startOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .startOf("month")
                    .toDate();
                const endOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .endOf("month")
                    .toDate();
                // 1️⃣ All Patients
                const allPatients = yield patient_model_1.default.find({ isDeleted: false })
                    .select("avatar")
                    .lean();
                // 2️⃣ Members (Patients with subscriptions)
                const members = yield subscription_model_1.default
                    .distinct("patient")
                    .then((patients) => patients === null || patients === void 0 ? void 0 : patients.length);
                // 3️⃣ Members Last Month
                const lastMonthMembers = yield subscription_model_1.default
                    .distinct("patient", {
                    startDate: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                })
                    .then((patients) => patients === null || patients === void 0 ? void 0 : patients.length);
                // 4️⃣ Active Patients
                const activeSubscriptions = yield subscription_model_1.default
                    .find({ status: "active" })
                    .select("patient")
                    .lean();
                const lastMonthActivePatients = yield subscription_model_1.default
                    .distinct("patient", {
                    status: "active",
                    startDate: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                })
                    .then((patients) => patients === null || patients === void 0 ? void 0 : patients.length);
                const activePatientIds = activeSubscriptions.map((sub) => sub.patient);
                const activePatients = yield patient_model_1.default.find({
                    _id: { $in: activePatientIds },
                    isDeleted: false
                })
                    .select("avatar")
                    .lean();
                const activeData = activePatients.map((p) => p.avatar).filter(Boolean);
                // Percentage calculations
                const percentageChangeAllPatients = lastMonthMembers
                    ? ((allPatients.length - lastMonthMembers) / lastMonthMembers) * 100
                    : 0;
                const percentageChangeMembers = lastMonthMembers
                    ? ((members - lastMonthMembers) / lastMonthMembers) * 100
                    : 0;
                const percentageChangeActive = lastMonthActivePatients
                    ? ((activePatients.length - lastMonthActivePatients) /
                        lastMonthActivePatients) *
                        100
                    : 0;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Patient metrics retrieved successfully.",
                    data: {
                        allPatients: {
                            amount: allPatients.length,
                            percentageChange: percentageChangeAllPatients.toFixed(1)
                        },
                        members: {
                            amount: members,
                            percentageChange: percentageChangeMembers.toFixed(1)
                        },
                        active: {
                            amount: activePatients === null || activePatients === void 0 ? void 0 : activePatients.length,
                            percentageChange: percentageChangeActive.toFixed(1),
                            images: (activeData === null || activeData === void 0 ? void 0 : activeData.length) ? activeData.slice(0, 5) : undefined
                        }
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getClinicNotifications(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { type, page = 1, limit = 20 } = req.query;
                const filter = {
                    clinic: clinicId,
                    isDeleted: { $ne: true }
                };
                const allowedTypes = [
                    "order",
                    "test result",
                    "claim",
                    "wallet",
                    "info",
                    "warning",
                    "alert"
                ];
                if (type) {
                    if (allowedTypes.includes(type)) {
                        filter.type = type;
                    }
                    else {
                        return res.status(400).json({
                            success: false,
                            message: `Invalid notification type '${type}'. Allowed types: ${allowedTypes.join(", ")}`
                        });
                    }
                }
                const skip = (Number(page) - 1) * Number(limit);
                const [notifications, total] = yield Promise.all([
                    clinic_notification_model_1.default
                        .find(filter)
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(Number(limit)),
                    clinic_notification_model_1.default.countDocuments(filter)
                ]);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic notifications fetched successfully.",
                    data: notifications,
                    pagination: {
                        totalItems: total,
                        currentPage: Number(page),
                        totalPages: Math.ceil(total / Number(limit)),
                        limit: Number(limit)
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static markRecentTwoNotificationsAsRead(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                // Fetch the two most recent unread notifications for the clinic
                const recentNotifications = yield clinic_notification_model_1.default
                    .find({
                    clinic: clinicId,
                    isRead: false
                })
                    .sort({ createdAt: -1 })
                    .limit(2);
                if (recentNotifications.length === 0) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No unread notifications found.");
                }
                const notificationIds = recentNotifications === null || recentNotifications === void 0 ? void 0 : recentNotifications.map((notification) => notification._id);
                yield clinic_notification_model_1.default.updateMany({
                    _id: { $in: notificationIds }
                }, { isRead: true });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Recent two notifications marked as read."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static markAllNotificationsAsRead(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const result = yield clinic_notification_model_1.default.updateMany({
                    clinic: clinicId,
                    isRead: false,
                    isDeleted: { $ne: true }
                }, { isRead: true });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: `Marked ${result.modifiedCount} notifications as read.`,
                    data: {
                        markedCount: result.modifiedCount
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static uploadCertificate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                if (!req.file) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "No file uploaded.");
                }
                const isImage = /jpeg|jpg|png|gif/i.test(req.file.mimetype);
                const resourceType = isImage ? "image" : "raw";
                const fileExtension = isImage
                    ? req.file.originalname.split(".").pop()
                    : "pdf";
                const publicId = `clinic_certificates/${clinic.clinicName}_certificate.${fileExtension}`;
                const result = yield (0, utils_1.uploadToCloudinary)(req.file.buffer, resourceType, "certificate", { public_id: publicId });
                clinic.certificate.file = result.secure_url;
                clinic.certificate.status = "pending";
                yield clinic.save();
                yield (0, utils_2.notifyAdmin)("Clinic Certificate", `Clinic ${clinic.clinicName} has uploaded a new certificate for verification.`, "info");
                yield clinic_notification_model_1.default.create({
                    clinic: clinic._id,
                    title: "Certificate Uploaded",
                    message: "Your certificate has been uploaded and is pending verification.",
                    type: "info",
                    isRead: false
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Certificate uploaded successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Clinic Accepts Contract
     */
    static acceptContract(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                if (clinic.contractAccepted) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Contract already accepted.");
                }
                clinic.contractAccepted = true;
                yield clinic.save();
                yield (0, utils_2.notifyAdmin)("Contract Accepted", `Clinic ${clinic.clinicName} has accepted the contract.`, "info");
                smtp_clinic_service_1.default.sendContractAcceptanceEmail(clinic)
                    .then(() => {
                    console.log("Contract acceptance email sent successfully to clinic:", clinic.clinicName);
                })
                    .catch((error) => {
                    console.error("Error sending Contract acceptance email:", error);
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Contract accepted successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static withdrawToMobileMoney(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                (0, utils_1.handleRequiredFields)(req, ["phoneNumber", "amount"]);
                const { phoneNumber, amount } = req.body;
                const clinicId = (0, utils_1.getClinicId)(req);
                if (typeof amount !== "number" || amount < 100) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid withdrawal amount.");
                }
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                const withdrawalFee = amount * 0.02;
                const totalDeduction = amount + withdrawalFee;
                if (clinic.balance < totalDeduction) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Insufficient balance.");
                }
                const { sanitizedPhone, provider } = yield (0, utils_1.validatePhoneWithPawaPay)(phoneNumber);
                const payoutId = (0, uuid_1.v4)();
                const payoutPayload = {
                    payoutId,
                    recipient: {
                        type: "MMO",
                        accountDetails: {
                            phoneNumber: sanitizedPhone,
                            provider
                        }
                    },
                    customerMessage: "Clinic withdrawal",
                    amount: amount.toString(),
                    currency: "RWF",
                    metadata: [
                        { withdrawalId: payoutId },
                        { clinicId: clinicId === null || clinicId === void 0 ? void 0 : clinicId.toString(), isPII: true },
                        { service: "clinic" },
                        { callbackUrl: `${process.env.BACKEND_URL}/api/v1/payment/p/p-w` }
                    ]
                };
                const payoutRes = yield axios_1.default.post(`${process.env.PAWAPAY_API_URL}/v2/payouts`, payoutPayload, {
                    headers: {
                        Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
                        "Content-Type": "application/json"
                    }
                });
                const status = (_a = payoutRes.data) === null || _a === void 0 ? void 0 : _a.status;
                if (status === "REJECTED") {
                    const reason = (_b = payoutRes.data) === null || _b === void 0 ? void 0 : _b.failureReason;
                    res.status(http_status_1.default.BAD_REQUEST).json({
                        success: false,
                        message: "PawaPay rejected the payout.",
                        failureCode: reason === null || reason === void 0 ? void 0 : reason.failureCode,
                        failureMessage: reason === null || reason === void 0 ? void 0 : reason.failureMessage
                    });
                }
                yield withdrawal_model_1.default.create({
                    clinic: clinic._id,
                    amount,
                    phoneNumber: sanitizedPhone,
                    accountNumber: sanitizedPhone,
                    status: "processing",
                    provider,
                    payoutId,
                    providerTransactionId: payoutId,
                    fee: withdrawalFee,
                    providerChannel: provider,
                    statusHistory: [{ status: "processing", changedAt: new Date() }]
                });
                clinic.balance -= totalDeduction;
                yield clinic.save();
                yield clinic_notification_model_1.default.create([
                    {
                        clinic: clinic._id,
                        title: "Withdrawal Requested",
                        message: `You’ve requested a withdrawal of ${amount.toLocaleString()} RWF to ${sanitizedPhone}.`,
                        type: "alert",
                        isRead: false
                    }
                ]);
                yield (0, utils_2.notifyAdmin)("Clinic Withdrawal Requested", `Clinic "${clinic.clinicName}" requested ${amount.toLocaleString()} RWF to ${sanitizedPhone}.`, "alert");
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Withdrawal initiated.",
                    data: {
                        payoutId,
                        payoutAmount: amount,
                        fee: withdrawalFee,
                        newBalance: clinic.balance
                    }
                });
            }
            catch (error) {
                const errData = (_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.data;
                if (errData) {
                    res.status(http_status_1.default.BAD_REQUEST).json({
                        success: false,
                        message: (_d = errData === null || errData === void 0 ? void 0 : errData.failureReason) === null || _d === void 0 ? void 0 : _d.failureMessage,
                        data: errData === null || errData === void 0 ? void 0 : errData.failureReason
                    });
                }
                next(error);
            }
        });
    }
    static getPayoutDetails(payoutId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const response = yield axios_1.default.get(`${process.env.PAWAPAY_API_URL}/v2/payouts/${payoutId}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`
                }
            });
            return (_a = response.data) === null || _a === void 0 ? void 0 : _a.data;
        });
    }
    static getClinicWithdrawals(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { page = "1", limit = "10", status, date, search } = req.query;
                const pageNumber = parseInt(page, 10) || 1;
                const limitNumber = parseInt(limit, 10) || 10;
                const skip = (pageNumber - 1) * limitNumber;
                const filter = { clinic: clinicId };
                if (status) {
                    filter.status = status.toLowerCase();
                }
                if (date) {
                    const startDate = new Date(date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(date);
                    endDate.setHours(23, 59, 59, 999);
                    filter.createdAt = { $gte: startDate, $lte: endDate };
                }
                if (search) {
                    filter.phoneNumber = { $regex: search, $options: "i" };
                }
                const withdrawals = yield withdrawal_model_1.default
                    .find(filter)
                    .select("createdAt amount status withdrawalId payoutId provider")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNumber)
                    .lean();
                const totalInDatabase = yield withdrawal_model_1.default.countDocuments({
                    clinic: clinicId
                });
                const total = yield withdrawal_model_1.default.countDocuments(filter);
                const formatted = yield Promise.all(withdrawals.map((w) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    let status = w.status;
                    const nonFinalStatuses = ["accepted", "processing", "failed", "found"];
                    if (w.payoutId &&
                        (!status || nonFinalStatuses.includes(status.toLowerCase()))) {
                        try {
                            const payout = yield ClinicController.getPayoutDetails(w.payoutId);
                            const providerStatus = (_a = payout === null || payout === void 0 ? void 0 : payout.status) === null || _a === void 0 ? void 0 : _a.toUpperCase();
                            if (providerStatus && providerStatus !== (status === null || status === void 0 ? void 0 : status.toUpperCase())) {
                                status = providerStatus.toLowerCase();
                                yield withdrawal_model_1.default.updateOne({ payoutId: w.payoutId }, { status, providerStatus });
                            }
                        }
                        catch (err) {
                            console.error(`❌ Failed to fetch payout ${w.payoutId}:`, ((_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.data) || err.message || err);
                        }
                    }
                    return {
                        id: w.withdrawalId,
                        payoutId: w.payoutId,
                        amount: w.amount,
                        status,
                        provider: w.provider,
                        date: w.createdAt
                            ? `${w.createdAt.getDate()}-${(w.createdAt.getMonth() + 1)
                                .toString()
                                .padStart(2, "0")}-${w.createdAt.getFullYear()}`
                            : "N/A"
                    };
                })));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Withdrawals fetched successfully.",
                    hasNoWithdrawals: totalInDatabase === 0,
                    data: formatted,
                    pagination: {
                        currentPage: pageNumber,
                        totalPages: Math.ceil(total / limitNumber),
                        totalWithdrawals: total
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getPawaPayPayoutStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { payoutId } = req.params;
                if (!payoutId) {
                    res.status(http_status_1.default.BAD_REQUEST).json({
                        success: false,
                        message: "Missing payoutId."
                    });
                    return;
                }
                const response = yield axios_1.default.get(`${process.env.PAWAPAY_API_URL}/v2/payouts/${payoutId}`, {
                    headers: {
                        Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
                        "Content-Type": "application/json"
                    }
                });
                const payout = response.data;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "PawaPay payout fetched successfully.",
                    data: payout
                });
            }
            catch (error) {
                const errData = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data;
                res.status(((_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.status) || 500).json({
                    success: false,
                    message: "Failed to fetch payout from PawaPay.",
                    data: errData !== null && errData !== void 0 ? errData : {}
                });
            }
        });
    }
    static withdrawToBankWithYellowCard(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                (0, utils_1.handleRequiredFields)(req, [
                    "accountNumber",
                    "amount",
                    "accountName",
                    "bankName"
                ]);
                const { accountNumber, amount, accountName, bankName } = req.body;
                const clinicId = (0, utils_1.getClinicId)(req);
                if (typeof amount !== "number" || amount < 1000) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid withdrawal amount.");
                }
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic)
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                if (clinic.balance < amount) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Insufficient balance.");
                }
                const exchangeRate = 1420;
                const usdAmount = +(amount / exchangeRate).toFixed(2);
                const ycService = new payment_service_1.YellowCardService();
                const sequenceId = `wd_${Date.now()}_${clinicId}`;
                const withdrawChannels = yield ycService.getPaymentChannels("RW", "withdraw");
                if (!withdrawChannels.length) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "No available withdrawal channels.");
                }
                const selectedChannelId = (_a = withdrawChannels === null || withdrawChannels === void 0 ? void 0 : withdrawChannels.find((ch) => ch.channelType === "bank")) === null || _a === void 0 ? void 0 : _a.id;
                const payout = yield ycService.submitPayoutRequest({
                    amount: usdAmount,
                    currency: "USD",
                    channelId: selectedChannelId,
                    sequenceId,
                    forceAccept: true,
                    customerUID: (_b = clinic === null || clinic === void 0 ? void 0 : clinic._id) === null || _b === void 0 ? void 0 : _b.toString(),
                    customerType: "retail",
                    recipient: {
                        accountName,
                        accountNumber,
                        bankId: selectedChannelId,
                        bankName,
                        country: "RW",
                        phoneNumber: (0, utils_1.formatPhone)(clinic === null || clinic === void 0 ? void 0 : clinic.phoneNo),
                        reason: "other"
                    }
                });
                const withdrawalFee = Math.round(amount * 0.01);
                const withdrawal = yield withdrawal_model_1.default.create({
                    clinic: clinicId,
                    amount,
                    usdAmount,
                    phoneNumber: clinic === null || clinic === void 0 ? void 0 : clinic.phoneNo,
                    accountNumber: accountNumber,
                    provider: "YellowCard",
                    providerChannel: "bank",
                    payoutId: payout.id,
                    status: "processing",
                    fee: withdrawalFee,
                    metadata: {
                        accountName,
                        bankId: selectedChannelId,
                        bankName,
                        reason: "Withdrawal from wallet",
                        sequenceId,
                        rate: exchangeRate,
                        providerResponse: payout
                    },
                    statusHistory: [
                        {
                            status: "processing",
                            changedAt: new Date()
                        }
                    ]
                });
                clinic.balance -= amount + withdrawalFee;
                yield clinic.save();
                yield clinic_notification_model_1.default.create([
                    {
                        clinic: clinicId,
                        title: "Withdrawal Initiated",
                        message: `Your withdrawal request of ${amount.toLocaleString()} RWF to bank account ${accountNumber} is being processed.`,
                        type: "wallet",
                        isRead: false
                    }
                ]);
                yield (0, utils_2.notifyAdmin)("Clinic Withdrawal Alert", `Clinic ${clinicId} initiated a ${amount.toLocaleString()} RWF withdrawal to ${accountNumber}.`, "wallet");
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Withdrawal request submitted. Awaiting confirmation.",
                    data: {
                        status: withdrawal.status,
                        usdAmount,
                        rwfAmount: amount
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static clearClinicNotifications(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                yield clinic_notification_model_1.default.deleteMany({ clinic: clinicId });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All notifications cleared successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get clinic withdrawal stats (Earning, Balance, Total Tests)
     */
    static getWithdrawalStats(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId).select("balance");
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const balance = clinic.balance || 0;
                // ==== Earnings (this month vs last month) ====
                const startOfThisMonth = (0, moment_1.default)().startOf("month").toDate();
                const startOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .startOf("month")
                    .toDate();
                const endOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .endOf("month")
                    .toDate();
                const thisMonthEarningsAgg = yield order_model_1.default.aggregate([
                    {
                        $match: {
                            clinic: new mongoose_1.default.Types.ObjectId(clinicId),
                            paymentStatus: "paid",
                            createdAt: { $gte: startOfThisMonth }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
                ]);
                const lastMonthEarningsAgg = yield order_model_1.default.aggregate([
                    {
                        $match: {
                            clinic: new mongoose_1.default.Types.ObjectId(clinicId),
                            paymentStatus: "paid",
                            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
                ]);
                const thisMonthEarnings = ((_a = thisMonthEarningsAgg === null || thisMonthEarningsAgg === void 0 ? void 0 : thisMonthEarningsAgg[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
                const lastMonthEarnings = ((_b = lastMonthEarningsAgg === null || lastMonthEarningsAgg === void 0 ? void 0 : lastMonthEarningsAgg[0]) === null || _b === void 0 ? void 0 : _b.total) || 0;
                const creditedThisMonth = thisMonthEarnings * 0.955;
                const creditedLastMonth = lastMonthEarnings * 0.955;
                const earningsPercentage = creditedLastMonth > 0
                    ? ((creditedThisMonth - creditedLastMonth) / creditedLastMonth) * 100
                    : creditedThisMonth > 0
                        ? 100
                        : 0;
                // ==== Balance (% change vs last credited balance) ====
                const balancePercentage = creditedLastMonth > 0
                    ? ((balance - creditedLastMonth) / creditedLastMonth) * 100
                    : balance > 0
                        ? 100
                        : 0;
                // ==== Total Tests (all-time vs last week) ====
                const totalTests = yield order_model_1.default.countDocuments({
                    clinic: new mongoose_1.default.Types.ObjectId(clinicId),
                    paymentStatus: "paid"
                });
                const startOfLastWeek = (0, moment_1.default)()
                    .subtract(1, "week")
                    .startOf("week")
                    .toDate();
                const endOfLastWeek = (0, moment_1.default)().subtract(1, "week").endOf("week").toDate();
                const lastWeekTests = yield order_model_1.default.countDocuments({
                    clinic: new mongoose_1.default.Types.ObjectId(clinicId),
                    paymentStatus: "paid",
                    createdAt: { $gte: startOfLastWeek, $lte: endOfLastWeek }
                });
                const testsPercentage = lastWeekTests > 0
                    ? ((totalTests - lastWeekTests) / lastWeekTests) * 100
                    : totalTests > 0
                        ? 100
                        : 0;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic withdrawal stats retrieved successfully.",
                    data: {
                        earning: {
                            value: +creditedThisMonth.toFixed(2),
                            percentage: +earningsPercentage.toFixed(1),
                            subtext: "this month"
                        },
                        balance: {
                            value: +balance.toFixed(2),
                            percentage: +balancePercentage.toFixed(1),
                            subtext: "live balance"
                        },
                        totalTests: {
                            value: totalTests,
                            percentage: +testsPercentage.toFixed(1),
                            subtext: "this week"
                        }
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getPublicClinicDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { username } = req.params;
                const clinic = yield clinic_model_1.default.findOne({
                    username: username.toLowerCase(),
                    status: "approved"
                })
                    .select("clinicName clinicId location bio avatar reviews supportInsurance isVerified onlineStatus country contractAccepted languages username deliveryMethods socialMedia")
                    .populate({
                    path: "reviews",
                    select: "reviewNo rating comment patient createdAt",
                    options: { sort: { createdAt: -1 }, limit: 10 },
                    populate: {
                        path: "patient",
                        select: "fullName"
                    }
                });
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const [tests, allTestItem] = yield Promise.all([
                    test_model_1.default
                        .find({ clinic: clinic._id })
                        .select("testNo testName price turnaroundTime preTestRequirements homeCollection currencySymbol insuranceCoverage coveredByLifeLine description socialMedia")
                        .lean(),
                    test_item_model_1.default.find().select("name image")
                ]);
                const testsWithImages = tests
                    .map((test) => {
                    var _a;
                    const testImage = ((_a = allTestItem.find((cat) => cat.name.toLowerCase() === test.testName.toLowerCase())) === null || _a === void 0 ? void 0 : _a.image) || "";
                    return {
                        testNo: test.testNo,
                        clinicId: test.clinic,
                        testName: test.testName,
                        price: test.price,
                        currencySymbol: test.currencySymbol,
                        turnaroundTime: test.turnaroundTime,
                        preTestRequirements: test.preTestRequirements,
                        homeCollection: test.homeCollection,
                        insuranceCoverage: test.insuranceCoverage,
                        description: test.description,
                        sampleType: test.sampleType,
                        testImage: testImage,
                        clinicImage: clinic.avatar || null,
                        clinicName: clinic.clinicName
                    };
                })
                    .sort((a, b) => { var _a; return (_a = a === null || a === void 0 ? void 0 : a.testName) === null || _a === void 0 ? void 0 : _a.localeCompare(b.testName); });
                const populatedReviews = clinic.reviews;
                const formattedReviews = populatedReviews.map((review) => ({
                    reviewNo: review.reviewNo,
                    rating: review.rating,
                    comment: review.comment,
                    patientName: typeof review.patient === "object" && "fullName" in review.patient
                        ? review.patient.fullName
                        : undefined
                }));
                const clinicDetails = {
                    clinicId: clinic.clinicId,
                    clinicName: clinic.clinicName,
                    username: clinic.username,
                    bio: clinic.bio,
                    avatar: clinic.avatar,
                    location: clinic.location,
                    languages: clinic.languages,
                    socialMedia: clinic.socialMedia,
                    deliveryMethods: clinic.deliveryMethods,
                    onlineStatus: clinic.onlineStatus,
                    country: clinic.country,
                    supportInsurance: clinic.supportInsurance,
                    isVerified: clinic.isVerified,
                    reviews: formattedReviews,
                    tests: testsWithImages
                };
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic details retrieved successfully.",
                    data: clinicDetails
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getAllCategoriesForClinic(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const categories = yield practitionercategory_model_1.default
                    .find()
                    .sort({ createdAt: -1 });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    data: categories
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
ClinicController.isProd = process.env.NODE_ENV === "production";
exports.default = ClinicController;
