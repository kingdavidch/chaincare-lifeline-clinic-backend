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
const base_64_1 = __importDefault(require("base-64"));
const crypto_1 = __importDefault(require("crypto"));
require("dotenv/config");
const http_status_1 = __importDefault(require("http-status"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const moment_1 = __importDefault(require("moment"));
const __1 = require("..");
const claim_model_1 = __importDefault(require("../claim/claim.model"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const clinic_notification_model_1 = __importDefault(require("../clinic/clinic.notification.model"));
const constant_1 = require("../constant");
const order_model_1 = __importDefault(require("../order/order.model"));
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const smtp_admin_service_1 = __importDefault(require("../smtp/admin/smtp.admin.service"));
const smtp_clinic_service_1 = __importDefault(require("../smtp/clinic/smtp.clinic.service"));
const subscription_model_1 = __importDefault(require("../subscription/subscription.model"));
const test_item_model_1 = __importDefault(require("../test/test.item.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
const testBooking_model_1 = __importDefault(require("../testBooking(Cart)/testBooking.model"));
const test_result_model_1 = __importDefault(require("../testResult/test.result.model"));
const utils_1 = require("../utils");
const app_error_1 = __importDefault(require("../utils/app.error"));
const password_utils_1 = require("../utils/password.utils");
const admin_model_1 = __importDefault(require("./admin.model"));
const admin_notification_model_1 = __importDefault(require("./admin.notification.model"));
const utils_2 = require("../order/utils");
const patient_notification_model_1 = __importDefault(require("../patient/patient.notification.model"));
const review_model_1 = __importDefault(require("../review/review.model"));
const utils_3 = require("./utils");
const practitionercategory_model_1 = __importDefault(require("../clinic/practitionercategory.model"));
class AdminController {
    // auth
    static signup(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["userName", "email", "password"]);
                const { userName, email, password } = req.body;
                const existingAdminByUserName = yield admin_model_1.default.findOne({ userName });
                // Check if the email already exists in patients, clinics, or admins
                const existingPatientByEmail = yield patient_model_1.default.findOne({ email });
                const existingClinicByEmail = yield clinic_model_1.default.findOne({ email });
                const existingAdminByEmail = yield admin_model_1.default.findOne({ email });
                if (existingPatientByEmail ||
                    existingClinicByEmail ||
                    existingAdminByEmail) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "An account with this email already exists.");
                }
                if (existingAdminByUserName) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "An account with this userName already exists.");
                }
                const hashedPassword = yield (0, password_utils_1.hashPassword)(password);
                const newAdmin = new admin_model_1.default({
                    userName,
                    email,
                    password: hashedPassword
                });
                yield newAdmin.save();
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Admin registration successful.",
                    data: { email: newAdmin.email, userName: newAdmin.userName }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static login(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email", "password"]);
                const email = req.body.email.trim().toLowerCase();
                const password = req.body.password;
                const admin = yield admin_model_1.default.findOne({ email });
                if (!admin) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Invalid email or password.");
                }
                const isPasswordValid = yield (0, password_utils_1.comparePasswords)(password, admin.password);
                if (!isPasswordValid) {
                    throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Invalid email or password.");
                }
                const payload = {
                    id: admin._id.toString(),
                    email: admin.email,
                    userName: admin.userName
                };
                const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET);
                admin.lastLogin = new Date();
                yield admin.save();
                yield (0, utils_3.notifyAdmin)("Successful Login Attempt", `Your account was successfully accessed on ${(0, moment_1.default)().format("MMMM Do YYYY, h:mm:ss a")}. If this was not you, please contact support immediately.`, "info");
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Login successful. Welcome back!",
                    token
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static forgotPassword(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email"]);
                const { email } = req.body;
                const admin = yield admin_model_1.default.findOne({ email });
                if (!admin) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Account not found.");
                }
                // Generate reset token
                const resetToken = crypto_1.default.randomBytes(32).toString("hex");
                const hashedToken = crypto_1.default
                    .createHash("sha256")
                    .update(resetToken)
                    .digest("hex");
                admin.resetPasswordToken = hashedToken;
                admin.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
                yield admin.save();
                yield smtp_admin_service_1.default.sendAdminResetPasswordEmail(admin, resetToken)
                    .then(() => {
                    console.log("email sent successfully.");
                })
                    .catch((error) => {
                    console.error("Error sending email:", error);
                });
                yield (0, utils_3.notifyAdmin)("Password Reset Requested", "A password reset request was initiated for your account. If this wasn't you, please contact support immediately.", "warning");
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
                const admin = yield admin_model_1.default.findOne({
                    resetPasswordToken: hashedToken,
                    resetPasswordExpires: { $gt: Date.now() }
                });
                if (!admin) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Token is invalid or has expired.");
                }
                // Update password
                admin.password = yield (0, password_utils_1.hashPassword)(newPassword);
                admin.resetPasswordToken = undefined;
                admin.resetPasswordExpires = undefined;
                yield admin.save();
                yield (0, utils_3.notifyAdmin)("Password Reset Successful", "Your password has been successfully updated. If this wasn't you, please contact support immediately.", "info");
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Your password has been successfully reset."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getAdmin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const adminId = (0, utils_1.getAdminId)(req);
                const admin = yield admin_model_1.default.findById(adminId).select("userName email lastLogin");
                if (!admin) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Admin not found.");
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    data: {
                        username: admin.userName,
                        email: admin.email,
                        lastLogin: admin.lastLogin
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateAdminProfile(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const adminId = (0, utils_1.getAdminId)(req);
                const { email, userName, password } = req.body;
                if (!email && !userName && !password) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "No update fields provided.");
                }
                const admin = yield admin_model_1.default.findById(adminId);
                if (!admin) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Admin not found.");
                }
                // Check email conflict (only if updating)
                if (email && email !== admin.email) {
                    const [existingAdmin, existingPatient, existingClinic] = yield Promise.all([
                        admin_model_1.default.findOne({ email }),
                        patient_model_1.default.findOne({ email }),
                        clinic_model_1.default.findOne({ email })
                    ]);
                    if (existingAdmin || existingPatient || existingClinic) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "An account with this email already exists.");
                    }
                    admin.email = email.toLowerCase().trim();
                }
                if (userName) {
                    admin.userName = userName.toLowerCase().trim();
                }
                if (password) {
                    const hashed = yield (0, password_utils_1.hashPassword)(password);
                    admin.password = hashed;
                }
                yield admin.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Admin profile updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getAdminNotifications(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const adminId = (0, utils_1.getAdminId)(req);
                const { type, page = 1, limit = 20 } = req.query;
                const filter = {
                    admin: adminId,
                    isDeleted: { $ne: true }
                };
                const allowedTypes = [
                    "order",
                    "test result",
                    "claim",
                    "wallet",
                    "info",
                    "warning",
                    "alert",
                    "subscription"
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
                    admin_notification_model_1.default.find(filter)
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(Number(limit)),
                    admin_notification_model_1.default.countDocuments(filter)
                ]);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Admin notifications fetched successfully.",
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
                const adminId = (0, utils_1.getAdminId)(req);
                const recentNotifications = yield admin_notification_model_1.default.find({
                    admin: adminId,
                    isRead: false
                })
                    .sort({ createdAt: -1 })
                    .limit(2);
                if (recentNotifications.length === 0) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No unread notifications found.");
                }
                const notificationIds = recentNotifications.map((notification) => notification._id);
                yield admin_notification_model_1.default.updateMany({ _id: { $in: notificationIds } }, { isRead: true });
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
                const adminId = (0, utils_1.getAdminId)(req);
                const result = yield admin_notification_model_1.default.updateMany({
                    admin: adminId,
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
    static verifyClinicStatus(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { clinicId } = req.params;
                const { status, reason } = req.body;
                if (!["approved", "rejected", "suspended"].includes(status)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid status. Use 'approved', 'rejected', or 'suspended'.");
                }
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                clinic.status = status;
                yield clinic.save();
                const message = status === "approved"
                    ? "Your clinic registration has been approved."
                    : `Your clinic registration has been ${status}. Reason: ${reason}`;
                yield clinic_notification_model_1.default.create({
                    clinic: clinic._id,
                    title: "Clinic Status Update",
                    message,
                    type: "alert",
                    isRead: false
                });
                yield (0, utils_3.notifyAdmin)(`Clinic ${status.charAt(0).toUpperCase() + status.slice(1)}`, `Clinic "${clinic.clinicName}" has been marked as ${status}${reason ? `. Reason: ${reason}` : ""}`, "info");
                // Optionally send email
                yield smtp_clinic_service_1.default.sendStatusUpdateEmail(clinic, status, reason)
                    .then(() => {
                    console.log("email sent successfully.");
                })
                    .catch((error) => {
                    console.error("Error sending email:", error);
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: `Clinic has been ${status} successfully.`
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static verifyClinicCertificate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { clinicId } = req.params;
                const { status, rejectionReason } = req.body;
                if (!["approved", "rejected"].includes(status)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid status. Use 'approved' or 'rejected'.");
                }
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                // if (!clinic.certificate || !clinic.certificate.file) {
                //   throw new AppError(
                //     httpStatus.BAD_REQUEST,
                //     "Clinic has not uploaded a certificate."
                //   )
                // }
                clinic.certificate.status = status;
                clinic.certificate.status = status;
                if (status === "rejected") {
                    clinic.certificate.rejectionReasons.push(rejectionReason);
                }
                yield clinic.save();
                const notificationMessage = status === "approved"
                    ? "Your clinic certificate has been approved."
                    : `Your clinic certificate has been rejected. Reason: ${rejectionReason}`;
                yield clinic_notification_model_1.default.create({
                    clinic: clinic === null || clinic === void 0 ? void 0 : clinic._id,
                    title: "Certificate Verification Update",
                    message: notificationMessage,
                    type: "info",
                    isRead: false
                });
                // Send email notification
                yield smtp_clinic_service_1.default.sendCertificateStatusEmail(clinic, status, status === "rejected" ? rejectionReason : undefined)
                    .then(() => {
                    console.log("email sent successfully.");
                })
                    .catch((error) => {
                    console.error("Error sending email:", error);
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: `Clinic certificate has been ${status} successfully.`
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getClinicByAdmin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const clinic = yield clinic_model_1.default
                    .findById(id)
                    .select("-password -resetPasswordToken -resetPasswordExpires -tests -termsAccepted")
                    .populate({
                    path: "reviews",
                    select: "rating comment patient",
                    populate: {
                        path: "patient",
                        select: "fullName"
                    }
                });
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                // 👇 Get total number of tests
                const testCount = yield clinic_model_1.default.findById(id).select("tests").lean();
                const totalTests = ((_a = testCount === null || testCount === void 0 ? void 0 : testCount.tests) === null || _a === void 0 ? void 0 : _a.length) || 0;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic information retrieved successfully.",
                    data: Object.assign(Object.assign({}, clinic.toObject()), { totalTests })
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updateClinicProfile(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { clinicId } = req.params;
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const { clinicName, email, phoneNo, stateOrProvince, cityOrDistrict, street, postalCode, coordinates, country, supportInsurance, onlineStatus, contractAccepted } = req.body;
                // 🔍 Check email uniqueness
                if (email && email !== clinic.email) {
                    const [existingPatient, existingClinic] = yield Promise.all([
                        patient_model_1.default.findOne({ email }),
                        clinic_model_1.default.findOne({ email, _id: { $ne: clinicId } })
                    ]);
                    if (existingPatient || existingClinic) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "An account with this email already exists.");
                    }
                    clinic.email = email;
                }
                // 📞 Check phone number uniqueness
                if (phoneNo && phoneNo !== clinic.phoneNo) {
                    const [existingPatientPhone, existingClinicPhone] = yield Promise.all([
                        patient_model_1.default.findOne({ phoneNumber: phoneNo }),
                        clinic_model_1.default.findOne({ phoneNo, _id: { $ne: clinicId } })
                    ]);
                    if (existingPatientPhone || existingClinicPhone) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "Phone number is already in use.");
                    }
                    clinic.phoneNo = phoneNo;
                }
                if (clinicName)
                    clinic.clinicName = clinicName;
                if (onlineStatus)
                    clinic.onlineStatus = onlineStatus;
                if (country)
                    clinic.country = country;
                // 📍 Location updates
                (_a = clinic.location) !== null && _a !== void 0 ? _a : (clinic.location = {
                    stateOrProvince: "",
                    cityOrDistrict: "",
                    street: "",
                    postalCode: "",
                    coordinates: { latitude: 0, longitude: 0 }
                });
                if (stateOrProvince)
                    clinic.location.stateOrProvince = stateOrProvince;
                if (cityOrDistrict)
                    clinic.location.cityOrDistrict = cityOrDistrict;
                if (street)
                    clinic.location.street = street;
                if (postalCode)
                    clinic.location.postalCode = postalCode;
                if (coordinates)
                    clinic.location.coordinates = coordinates;
                if (typeof contractAccepted === "boolean") {
                    clinic.contractAccepted = contractAccepted;
                }
                if (supportInsurance)
                    clinic.supportInsurance = supportInsurance;
                yield clinic.save();
                __1.io.emit("clinic:update", {
                    clinicId: clinic._id,
                    profile: {
                        clinicName: clinic.clinicName,
                        email: clinic.email,
                        phoneNo: clinic.phoneNo,
                        location: clinic.location,
                        country: clinic.country,
                        supportInsurance: clinic.supportInsurance,
                        onlineStatus: clinic.onlineStatus,
                        avatar: clinic.avatar || null
                    }
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic profile updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getSubscriptionStats(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subscriptionStats = yield subscription_model_1.default.aggregate([
                    {
                        $group: {
                            _id: "$planName",
                            totalSubscribers: { $sum: 1 }
                        }
                    }
                ]);
                const lastMonthStats = yield subscription_model_1.default.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
                                $lt: new Date(new Date().setDate(1))
                            }
                        }
                    },
                    {
                        $group: {
                            _id: "$planName",
                            totalSubscribers: { $sum: 1 }
                        }
                    }
                ]);
                const lastMonthMap = new Map(lastMonthStats.map((stat) => [
                    stat._id.toLowerCase(),
                    stat.totalSubscribers
                ]));
                const allowedPlans = ["standard", "premium"];
                const statsWithPercentage = allowedPlans.map((plan) => {
                    const currentPlanStat = subscriptionStats.find((stat) => stat._id.toLowerCase() === plan);
                    const currentCount = currentPlanStat
                        ? currentPlanStat.totalSubscribers
                        : 0;
                    const lastMonthCount = lastMonthMap.get(plan) || 0;
                    const percentageIncrease = lastMonthCount > 0
                        ? ((currentCount - lastMonthCount) / lastMonthCount) * 100
                        : currentCount > 0
                            ? 100
                            : 0;
                    return {
                        planName: plan,
                        totalSubscribers: currentCount,
                        percentageIncrease: parseFloat(percentageIncrease.toFixed(2))
                    };
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    data: statsWithPercentage
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getStats(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const totalPatients = yield patient_model_1.default.countDocuments({
                    isDeleted: { $ne: true }
                });
                const customersWithOrders = yield order_model_1.default.distinct("patient");
                const customersWithoutOrders = totalPatients - customersWithOrders.length;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Customer stats retrieved successfully.",
                    data: {
                        customersWithOrders: customersWithOrders.length,
                        customersWithoutOrders
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getEarningsOverview(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
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
                    message: "Global earnings overview retrieved successfully.",
                    data: formattedData
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getSalesData(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
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
                const salesData = yield order_model_1.default.aggregate([
                    {
                        $match: {
                            paymentStatus: "paid",
                            createdAt: { $gte: startDate }
                        }
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
                            totalSales: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);
                const formattedData = salesData.map((entry) => ({
                    period: entry._id,
                    sales: entry.totalSales
                }));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Global sales data retrieved successfully.",
                    data: formattedData
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getPopularTests(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const popularTests = yield testBooking_model_1.default.aggregate([
                    {
                        $match: { status: { $in: ["booked", "completed"] } }
                    },
                    { $group: { _id: "$test", totalBookings: { $sum: 1 } } },
                    { $sort: { totalBookings: -1 } },
                    { $limit: 2 }
                ]);
                const testIds = popularTests.map((test) => test._id);
                const testDetails = yield test_model_1.default
                    .find({ _id: { $in: testIds } })
                    .sort({ createdAt: -1 })
                    .select("testName price");
                const formattedTests = popularTests.map((test) => {
                    const testInfo = testDetails.find((t) => { var _a; return ((_a = t._id) === null || _a === void 0 ? void 0 : _a.toString()) === test._id.toString(); });
                    return {
                        testName: (testInfo === null || testInfo === void 0 ? void 0 : testInfo.testName) || "Unknown Test",
                        price: (testInfo === null || testInfo === void 0 ? void 0 : testInfo.price) || 0,
                        totalBookings: test === null || test === void 0 ? void 0 : test.totalBookings
                    };
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    data: formattedTests
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    // tests
    static getAllTests(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { search, filter, page = "1", limit = "10" } = req.query;
                const pageNumber = Math.max(parseInt(page, 10), 1);
                const limitNumber = Math.max(parseInt(limit, 10), 1);
                // 🔑 Build query: all tests, not deleted
                const query = {
                    isDeleted: false
                };
                // Optional search filter
                if (typeof search === "string" && search.trim() !== "") {
                    const regex = new RegExp(search, "i");
                    query.testName = { $regex: regex };
                }
                // Optional lifeline filter
                if (filter === "lifeline") {
                    query.coveredByLifeLine = true;
                }
                // 🔢 Total tests that match
                const totalTests = yield test_model_1.default.countDocuments(query);
                const totalPages = Math.max(Math.ceil(totalTests / limitNumber), 1);
                const safePage = Math.min(pageNumber, totalPages);
                const skip = (safePage - 1) * limitNumber;
                // 🔄 Fetch paginated tests including clinic field
                const [tests, testItemData] = yield Promise.all([
                    test_model_1.default
                        .find(query)
                        .limit(limitNumber)
                        .skip(skip)
                        .sort({ createdAt: -1 }),
                    test_item_model_1.default.find().select("name image")
                ]);
                // 🖼️ Map testImage and clinic info from testItem and clinicModel
                const data = yield Promise.all(tests.map((test) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const testImage = ((_a = testItemData.find((cat) => { var _a; return cat.name.toLowerCase() === ((_a = test === null || test === void 0 ? void 0 : test.testName) === null || _a === void 0 ? void 0 : _a.toLowerCase()); })) === null || _a === void 0 ? void 0 : _a.image) || "";
                    const clinicData = yield clinic_model_1.default
                        .findById(test.clinic)
                        .select("avatar clinicName")
                        .lean();
                    return Object.assign(Object.assign({}, test.toObject()), { testImage, clinicImage: (clinicData === null || clinicData === void 0 ? void 0 : clinicData.avatar) || null, clinicName: (clinicData === null || clinicData === void 0 ? void 0 : clinicData.clinicName) || null });
                })));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All tests retrieved successfully.",
                    data,
                    pagination: {
                        totalTests,
                        totalPages,
                        currentPage: safePage,
                        limit: limitNumber
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getTestDetail(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const test = yield test_model_1.default.findById(id);
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                }
                const clinic = yield clinic_model_1.default
                    .findById(test.clinic)
                    .select("clinicName avatar");
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                // 🔍 Match TestItem to get image + icon
                const testItemData = yield test_item_model_1.default.findOne({
                    name: { $regex: new RegExp(`^${test.testName}$`, "i") }
                });
                const testData = test.toObject();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test details retrieved successfully.",
                    data: Object.assign(Object.assign({}, testData), { clinicName: clinic.clinicName, clinicAvatar: clinic.avatar, testImage: testItemData === null || testItemData === void 0 ? void 0 : testItemData.image, testIcon: testItemData === null || testItemData === void 0 ? void 0 : testItemData.icon })
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getAllTestItem(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const tests = yield test_item_model_1.default
                    .find()
                    .select("clinic name")
                    .populate("clinic", "clinicNo")
                    .collation({ locale: "en", strength: 2 })
                    .sort({ name: 1 });
                res.status(200).json({
                    success: true,
                    message: "Test Item retrieved successfully.",
                    data: tests
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static addTestItem(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["name"]);
                const { name, image, icon } = req.body;
                const existing = yield test_item_model_1.default.findOne({
                    name: new RegExp(`^${name}$`, "i")
                });
                if (existing) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "A test test item with this name already exists.");
                }
                yield test_item_model_1.default.create({ name, image, icon });
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Test test item added successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Admin Updates a Test
     */
    static updateTest(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const updates = req.body;
                // 🔍 Validate testName against existing test item names
                if (updates === null || updates === void 0 ? void 0 : updates.testName) {
                    const testNameLower = (_a = updates === null || updates === void 0 ? void 0 : updates.testName) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                    const existingTestItem = yield test_item_model_1.default.findOne({
                        name: { $regex: new RegExp(`^${testNameLower}$`, "i") }
                    });
                    if (!existingTestItem) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid test name. The test must exist in the test Item.");
                    }
                }
                // 🛠 Update test
                const updatedTest = yield test_model_1.default.findByIdAndUpdate(id, updates, {
                    new: true
                });
                if (!updatedTest) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                }
                __1.io.emit("test:update", {
                    testId: updatedTest._id,
                    details: updatedTest
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Update a test item (name, image, or icon)
     */
    static updateTestItem(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { name, image, icon } = req.body;
                if (!name && !image && !icon) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "No fields provided to update.");
                }
                const test = yield test_item_model_1.default.findById(id);
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test Item not found.");
                }
                // Check for duplicate name
                if (name && name.toLowerCase() !== test.name.toLowerCase()) {
                    const existing = yield test_item_model_1.default.findOne({
                        name: new RegExp(`^${name}$`, "i"),
                        _id: { $ne: id }
                    });
                    if (existing) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "A test Item with this name already exists.");
                    }
                    test.name = name;
                }
                if (image)
                    test.image = image;
                if (icon)
                    test.icon = icon;
                yield test.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test Item updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deleteTestItem(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const item = yield test_item_model_1.default.findById(id);
                if (!item) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test item not found.");
                }
                const testInUse = yield test_model_1.default.exists({
                    testName: new RegExp(`^${item.name}$`, "i")
                });
                if (testInUse) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "This test item is already in use. Please update it instead of deleting.");
                }
                yield item.deleteOne();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test item deleted successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deleteTest(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { testId } = req.params;
                const test = yield test_model_1.default.findById(testId);
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                }
                if (test.isDeleted) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Test is already deleted.");
                }
                test.isDeleted = true;
                yield test.save();
                yield testBooking_model_1.default.deleteMany({
                    test: test._id,
                    status: "pending"
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test deleted (soft delete) successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    // Get all soft-deleted tests
    static getDeletedTests(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const deletedTests = yield test_model_1.default
                    .find({ isDeleted: true })
                    .sort({ createdAt: -1 });
                // 🔄 Preload all test item to avoid multiple DB queries
                const testItemData = yield test_item_model_1.default.find().select("name image");
                const data = deletedTests.map((test) => {
                    var _a;
                    const testImage = (_a = testItemData.find((cat) => { var _a; return cat.name.toLowerCase() === ((_a = test === null || test === void 0 ? void 0 : test.testName) === null || _a === void 0 ? void 0 : _a.toLowerCase()); })) === null || _a === void 0 ? void 0 : _a.image;
                    return Object.assign(Object.assign({}, test.toObject()), { testImage });
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Deleted tests retrieved successfully.",
                    data
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    // Restore a soft-deleted test
    static restoreDeletedTest(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { testId } = req.params;
                const test = yield test_model_1.default.findOne({ _id: testId, isDeleted: true });
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                }
                if (!test.isDeleted) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Test is not deleted.");
                }
                test.isDeleted = false;
                yield test.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test restored successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    // clinics
    static getAllClinics(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const sortOrder = req.query.sort === "oldest" ? 1 : -1; // Default to newest
                const skip = (page - 1) * limit;
                const filter = { isDeleted: false };
                // Filter by contract acceptance if the query param exists
                if (req.query.filterBy === "supported") {
                    filter.contractAccepted = true; // Only show clinics that have accepted the contract
                }
                // Optional: Filter by clinic status (e.g., approved, pending, etc.)
                if (req.query.status) {
                    filter.status = req.query.status;
                }
                const total = yield clinic_model_1.default.countDocuments(filter);
                const clinics = yield clinic_model_1.default
                    .find(filter)
                    .sort({ createdAt: sortOrder })
                    .skip(skip)
                    .limit(limit)
                    .select("clinicId _id clinicName phoneNo email location status contractAccepted");
                const formatted = clinics.map((clinic) => ({
                    id: clinic === null || clinic === void 0 ? void 0 : clinic._id,
                    clinicId: clinic === null || clinic === void 0 ? void 0 : clinic.clinicId,
                    clinicName: clinic === null || clinic === void 0 ? void 0 : clinic.clinicName,
                    phoneNo: clinic === null || clinic === void 0 ? void 0 : clinic.phoneNo,
                    email: clinic === null || clinic === void 0 ? void 0 : clinic.email,
                    country: clinic === null || clinic === void 0 ? void 0 : clinic.country,
                    location: clinic === null || clinic === void 0 ? void 0 : clinic.location,
                    status: clinic === null || clinic === void 0 ? void 0 : clinic.status,
                    contractAccepted: clinic === null || clinic === void 0 ? void 0 : clinic.contractAccepted
                }));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinics retrieved successfully.",
                    data: {
                        clinics: formatted,
                        pagination: {
                            currentPage: page,
                            totalPages: Math.ceil(total / limit),
                            totalRecords: total
                        }
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //  Get patient statistics including all patients, members, and active patients
    static getPatientMetrics(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const startOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .startOf("month")
                    .toDate();
                const endOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .endOf("month")
                    .toDate();
                const allPatients = yield patient_model_1.default
                    .find({ isDeleted: false })
                    .select("avatar")
                    .lean();
                const members = yield subscription_model_1.default
                    .distinct("patient")
                    .then((list) => list === null || list === void 0 ? void 0 : list.length);
                const lastMonthMembers = yield subscription_model_1.default
                    .distinct("patient", {
                    startDate: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                })
                    .then((list) => list === null || list === void 0 ? void 0 : list.length);
                const activeSubscriptions = yield subscription_model_1.default
                    .find({ status: "active" })
                    .select("patient")
                    .lean();
                const lastMonthActivePatients = yield subscription_model_1.default
                    .distinct("patient", {
                    status: "active",
                    startDate: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                })
                    .then((list) => list === null || list === void 0 ? void 0 : list.length);
                const activePatientIds = activeSubscriptions.map((sub) => sub.patient);
                const activePatients = yield patient_model_1.default
                    .find({
                    _id: { $in: activePatientIds },
                    isDeleted: false
                })
                    .select("avatar")
                    .lean();
                const activeData = activePatients.map((p) => p.avatar).filter(Boolean);
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
                    message: "Admin patient metrics retrieved successfully.",
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
                            amount: activePatients.length,
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
    static getAllPatients(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const skip = (page - 1) * limit;
                const { status } = req.query;
                // 1️⃣ Fetch all patients
                const allPatients = yield patient_model_1.default
                    .find()
                    .sort({ createdAt: -1 })
                    .select("patientId fullName email phoneNumber isVerified")
                    .lean();
                const totalPatients = allPatients.length;
                // 2️⃣ Fetch subscriptions for all patients
                const subscriptions = yield subscription_model_1.default
                    .find({ patient: { $in: allPatients.map((p) => p._id) } })
                    .select("patient status")
                    .lean();
                const patientStatusMap = subscriptions.reduce((acc, sub) => {
                    acc[sub.patient.toString()] = sub.status.toLowerCase();
                    return acc;
                }, {});
                // 3️⃣ Format and filter patients before pagination
                let formattedPatients = allPatients.map((p) => ({
                    patientId: p.patientId,
                    patientName: p.fullName,
                    email: p.email,
                    phoneNumber: p.phoneNumber,
                    isVerified: p.isVerified,
                    status: patientStatusMap[p._id.toString()] || "not member"
                }));
                // Apply filter by status BEFORE pagination
                if (status &&
                    ["active", "locked", "expired"].includes(status.toString().toLowerCase())) {
                    formattedPatients = formattedPatients.filter((p) => p.status === status.toString().toLowerCase());
                }
                // 4️⃣ Pagination after filtering
                const totalFiltered = formattedPatients.length;
                const paginatedPatients = formattedPatients.slice(skip, skip + limit);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All patients retrieved successfully.",
                    hasNoPatients: totalPatients === 0,
                    data: {
                        patients: paginatedPatients,
                        pagination: {
                            totalPages: Math.ceil(totalFiltered / limit),
                            currentPage: page,
                            totalRecords: totalFiltered
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
     * Admin Views Patient Claim History
     */
    static getPatientClaimHistory(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { patientId } = req.params;
                const patient = yield patient_model_1.default.findOne({ patientId });
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const subscription = yield subscription_model_1.default.findOne({
                    patient: patient._id,
                    planName: "premium",
                    status: "active"
                });
                if (!subscription) {
                    throw new app_error_1.default(http_status_1.default.FORBIDDEN, "Only Premium subscribers have access to claim history.");
                }
                const claims = yield claim_model_1.default
                    .find({ patient: patient._id })
                    .select("claimNo testName testNo cost date time clinic")
                    .sort({ date: -1 })
                    .lean();
                const claimsWithCurrency = yield Promise.all(claims.map((claim) => __awaiter(this, void 0, void 0, function* () {
                    const clinic = yield clinic_model_1.default
                        .findById(claim.clinic)
                        .select("currencySymbol")
                        .lean();
                    return Object.assign(Object.assign({}, claim), { currencySymbol: (clinic === null || clinic === void 0 ? void 0 : clinic.currencySymbol) || "" });
                })));
                const balance = subscription.privilege;
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Patient claim history retrieved successfully.",
                    data: {
                        patientName: patient.fullName,
                        subscription: subscription.planName,
                        privilege: subscription.initialPrivilege,
                        balance,
                        claims: claimsWithCurrency
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Admin Gets All Claims (With Pagination, Search, and Date Filtering)
     */
    static getAllClaims(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { page = "1", limit = "10", status = "", search = "", date } = req.query;
                const pageNumber = parseInt(page, 10);
                const limitNumber = parseInt(limit, 10);
                const skip = (pageNumber - 1) * limitNumber;
                const query = {};
                // 🔹 Filter by status (optional)
                if (typeof status === "string" && status.trim() !== "") {
                    query.status = status.toLowerCase();
                }
                // 🔍 Search by testName or patient fullName
                if (typeof search === "string" && search.trim() !== "") {
                    query.$or = [
                        { testName: { $regex: search, $options: "i" } },
                        {
                            patient: {
                                $in: yield patient_model_1.default
                                    .find({ fullName: { $regex: search, $options: "i" } })
                                    .distinct("_id")
                            }
                        }
                    ];
                }
                // 📅 Exact Date Filtering (matches only a specific date)
                if (typeof date === "string" && date.trim() !== "") {
                    const specificDate = new Date(date);
                    specificDate.setHours(0, 0, 0, 0);
                    const nextDay = new Date(specificDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    query.date = { $gte: specificDate, $lt: nextDay };
                }
                // 🔍 Total claims in DB (unfiltered)
                const totalClaimsInDatabase = yield claim_model_1.default.countDocuments();
                // 🔄 Fetch claims + total (filtered)
                const [claims, totalClaims] = yield Promise.all([
                    claim_model_1.default
                        .find(query)
                        .populate("patient", "fullName")
                        .select("claimNo patient testName cost date clinic")
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limitNumber)
                        .lean(),
                    claim_model_1.default.countDocuments(query)
                ]);
                // 💸 Attach currencySymbol from clinic
                const claimsWithCurrency = yield Promise.all(claims.map((claim) => __awaiter(this, void 0, void 0, function* () {
                    const clinic = yield clinic_model_1.default
                        .findById(claim.clinic)
                        .select("currencySymbol clinicName email")
                        .lean();
                    return Object.assign(Object.assign({}, claim), { clinicName: clinic === null || clinic === void 0 ? void 0 : clinic.clinicName, clinicEmail: clinic === null || clinic === void 0 ? void 0 : clinic.email, currencySymbol: clinic === null || clinic === void 0 ? void 0 : clinic.currencySymbol });
                })));
                // 📦 If no claims, respond accordingly
                if (!claims.length) {
                    return res.status(http_status_1.default.OK).json({
                        success: true,
                        message: "No claims found for the selected date.",
                        data: [],
                        hasNoClaims: totalClaimsInDatabase === 0,
                        pagination: {
                            totalClaims: 0,
                            totalPages: 0,
                            currentPage: pageNumber,
                            limit: limitNumber
                        }
                    });
                }
                // ✅ Success Response
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All claims retrieved successfully.",
                    data: claimsWithCurrency,
                    hasNoClaims: totalClaimsInDatabase === 0,
                    pagination: {
                        totalClaims,
                        totalPages: Math.ceil(totalClaims / limitNumber),
                        currentPage: pageNumber,
                        limit: limitNumber
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Admin Views All Clinic Orders
     */
    static getAllOrders(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { page = "1", limit = "10", paymentMethod, date } = req.query;
                const pageNumber = parseInt(page, 10) || 1;
                const limitNumber = parseInt(limit, 10) || 10;
                const skip = (pageNumber - 1) * limitNumber;
                const filter = {};
                if (paymentMethod) {
                    const pm = paymentMethod.toLowerCase();
                    if (pm === "momo") {
                        filter.paymentMethod = "pawa_pay";
                    }
                    else if (pm === "bank transfer") {
                        filter.paymentMethod = "yellow_card";
                    }
                    else {
                        filter.paymentMethod = pm;
                    }
                }
                if (date) {
                    const startDate = new Date(date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(date);
                    endDate.setHours(23, 59, 59, 999);
                    filter.createdAt = { $gte: startDate, $lte: endDate };
                }
                const orders = yield order_model_1.default
                    .find(filter)
                    .select("orderId patient tests totalAmount createdAt paymentMethod clinic")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNumber)
                    .lean();
                const totalOrdersInDatabase = yield order_model_1.default.countDocuments();
                const formattedOrders = yield Promise.all(orders.map((order) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c, _d;
                    const patient = yield patient_model_1.default
                        .findById(order.patient)
                        .select("fullName")
                        .lean();
                    const clinic = yield clinic_model_1.default
                        .findById(order.clinic)
                        .select("clinicName")
                        .lean();
                    let currencySymbol = "RWF";
                    if (((_a = order.tests) === null || _a === void 0 ? void 0 : _a.length) > 0 && ((_b = order.tests[0]) === null || _b === void 0 ? void 0 : _b.test)) {
                        const testRef = order.tests[0].test;
                        const testDoc = yield test_model_1.default
                            .findById(testRef)
                            .select("currencySymbol")
                            .lean();
                        if (testDoc === null || testDoc === void 0 ? void 0 : testDoc.currencySymbol) {
                            currencySymbol = testDoc.currencySymbol;
                        }
                    }
                    const testNames = (() => {
                        var _a;
                        const names = ((_a = order.tests) === null || _a === void 0 ? void 0 : _a.map((t) => t.testName)) || [];
                        if (names.length === 0)
                            return "N/A";
                        if (names.length <= 2)
                            return names.join(", ");
                        return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
                    })();
                    const testStatuses = ((_c = order.tests) === null || _c === void 0 ? void 0 : _c.map((t) => t.status)) || [];
                    const uniqueStatuses = [...new Set(testStatuses)];
                    let overallStatus = "pending";
                    if (uniqueStatuses.length === 1) {
                        overallStatus = uniqueStatuses[0];
                    }
                    else {
                        overallStatus = "mixed";
                    }
                    const testResults = yield test_result_model_1.default
                        .find({
                        patient: order.patient,
                        order: order._id,
                        test: { $in: ((_d = order.tests) === null || _d === void 0 ? void 0 : _d.map((t) => t.test)) || [] }
                    })
                        .select("resultSent")
                        .lean();
                    const resultSent = testResults.some((tr) => tr.resultSent === true);
                    return {
                        id: order._id,
                        orderId: order.orderId,
                        CustomerName: (patient === null || patient === void 0 ? void 0 : patient.fullName) || "N/A",
                        Clinic: (clinic === null || clinic === void 0 ? void 0 : clinic.clinicName) || "N/A",
                        Test: testNames,
                        Date: order.createdAt
                            ? `${new Date(order.createdAt).getDate()}-${String(new Date(order.createdAt).getMonth() + 1).padStart(2, "0")}-${new Date(order.createdAt).getFullYear()}`
                            : "N/A",
                        Time: order.createdAt
                            ? new Date(order.createdAt).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true
                            })
                            : "N/A",
                        PaymentMethod: (order === null || order === void 0 ? void 0 : order.paymentMethod) === "pawa_pay"
                            ? "momo"
                            : (order === null || order === void 0 ? void 0 : order.paymentMethod) === "yellow_card"
                                ? "bank transfer"
                                : order === null || order === void 0 ? void 0 : order.paymentMethod,
                        price: order.totalAmount,
                        currencySymbol,
                        Status: overallStatus,
                        resultSent
                    };
                })));
                const totalOrders = yield order_model_1.default.countDocuments(filter);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All orders retrieved successfully.",
                    hasNoOrders: totalOrdersInDatabase === 0,
                    data: formattedOrders,
                    pagination: {
                        currentPage: pageNumber,
                        totalPages: Math.ceil(totalOrders / limitNumber),
                        totalOrders
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Admin Views a Specific Order Details
     */
    static getOrderDetailsByAdmin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { orderId } = req.params;
                const order = yield order_model_1.default
                    .findById(orderId)
                    .populate("patient", "fullName email phoneNumber")
                    .select("-__v")
                    .lean();
                if (!order) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Order not found.");
                }
                const clinic = yield clinic_model_1.default
                    .findById(order.clinic)
                    .select("currencySymbol clinicName email clinicId")
                    .lean();
                const currencySymbol = (clinic === null || clinic === void 0 ? void 0 : clinic.currencySymbol) || "₦";
                const allTestItems = yield test_item_model_1.default.find().select("name image").lean();
                const testResults = yield test_result_model_1.default
                    .find({
                    clinic: order.clinic,
                    patient: order.patient,
                    order: order._id,
                    test: { $in: order.tests.map((t) => t.test) }
                })
                    .select("test resultSent")
                    .lean();
                const testResultMap = new Map();
                testResults.forEach((tr) => {
                    var _a;
                    testResultMap.set(tr.test.toString(), (_a = tr.resultSent) !== null && _a !== void 0 ? _a : false);
                });
                const testsWithDetails = yield Promise.all(order.tests.map((test) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const testDoc = yield test_model_1.default
                        .findById(test.test)
                        .select("currencySymbol image")
                        .lean();
                    const fallbackImage = ((_a = allTestItems.find((item) => item.name.toLowerCase() === test.testName.toLowerCase())) === null || _a === void 0 ? void 0 : _a.image) || "";
                    const resultSent = testResultMap.get(test.test.toString()) || false;
                    return {
                        _id: test._id,
                        testName: test.testName,
                        price: test.price,
                        currencySymbol: testDoc === null || testDoc === void 0 ? void 0 : testDoc.currencySymbol,
                        image: fallbackImage,
                        resultSent,
                        status: test.status,
                        rejectionReason: test.rejectionReason || null,
                        statusHistory: test.statusHistory || []
                    };
                })));
                const paymentMethodLabel = order.paymentMethod === "pawa_pay"
                    ? "momo with pawapay"
                    : order.paymentMethod === "yellow_card"
                        ? "bank transfer with yellow card"
                        : order.paymentMethod;
                const orderWithDetails = Object.assign(Object.assign({}, order), { tests: testsWithDetails, insuranceDetails: order.paymentMethod === "insurance"
                        ? order.insuranceDetails
                        : undefined, currencySymbol, clinicInfo: clinic
                        ? {
                            clinicId: clinic.clinicId,
                            clinicName: clinic.clinicName,
                            clinicEmail: clinic.email
                        }
                        : undefined, paymentMethodLabel, deliveryMethod: (0, utils_2.mapDeliveryMethod)(order.deliveryMethod) });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Order details retrieved successfully.",
                    data: orderWithDetails
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Admin Views Clinic Claim History
     */
    static getClinicClaimsHistory(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { clinicId } = req.params;
                const { month, year } = req.query;
                const currentYear = (0, moment_1.default)().year();
                const selectedYear = year ? parseInt(year) : currentYear;
                const selectedMonth = month
                    ? parseInt(month)
                    : (0, moment_1.default)().month() + 1;
                // 🔍 Check if clinic exists
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                // 🧾 Check if the clinic has any claims at all
                const totalClaimsForClinic = yield claim_model_1.default.countDocuments({
                    clinic: clinicId
                });
                if (totalClaimsForClinic === 0) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "This clinic has no claims yet.");
                }
                // 📅 Set date filter range
                const startDate = (0, moment_1.default)(`${selectedYear}-${selectedMonth}-01`, "YYYY-MM-DD").startOf("month");
                const endDate = (0, moment_1.default)(startDate).endOf("month");
                // 🔎 Fetch claims for month
                const claims = yield claim_model_1.default
                    .find({
                    clinic: clinicId,
                    date: { $gte: startDate.toDate(), $lte: endDate.toDate() }
                })
                    .sort({ date: -1 });
                // 🧮 Calculate money owed
                const moneyOwed = claims.reduce((total, claim) => total + claim.cost, 0);
                // 📋 Format claims
                const claimsWithDetails = yield Promise.all(claims.map((claim) => __awaiter(this, void 0, void 0, function* () {
                    const patient = yield patient_model_1.default
                        .findById(claim.patient)
                        .select("fullName");
                    return {
                        claimId: claim.claimNo,
                        patientName: patient === null || patient === void 0 ? void 0 : patient.fullName,
                        testName: claim.testName,
                        date: (0, moment_1.default)(claim.date).format("DD-MM-YYYY"),
                        cost: `${clinic.currencySymbol} ${claim.cost.toFixed(2)}`
                    };
                })));
                if (claims.length === 0) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No claims found for the selected period.");
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Claims retrieved successfully.",
                    hasNoClaims: false,
                    clinicName: clinic.clinicName,
                    moneyOwed: `${clinic.currencySymbol} ${moneyOwed.toFixed(2)}`,
                    claims: claimsWithDetails
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get overall clinic metrics including all clinics and supported clinics
     */
    static getClinicMetrics(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const startOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .startOf("month")
                    .toDate();
                const endOfLastMonth = (0, moment_1.default)()
                    .subtract(1, "month")
                    .endOf("month")
                    .toDate();
                // 🔹 All clinics
                const allClinics = yield clinic_model_1.default
                    .find()
                    .select("_id contractAccepted createdAt")
                    .lean();
                const supportedClinics = allClinics.filter((c) => c.contractAccepted);
                // 🔹 Clinics created last month
                const lastMonthClinics = allClinics === null || allClinics === void 0 ? void 0 : allClinics.filter((c) => (0, moment_1.default)(c.createdAt).isSameOrAfter(startOfLastMonth) &&
                    (0, moment_1.default)(c.createdAt).isSameOrBefore(endOfLastMonth));
                const lastMonthSupported = lastMonthClinics.filter((c) => c.contractAccepted);
                const percentChange = (current, prev) => prev > 0 ? ((current - prev) / prev) * 100 : 0;
                const percentageChangeAll = percentChange(allClinics.length, lastMonthClinics.length);
                const percentageChangeSupported = percentChange(supportedClinics.length, lastMonthSupported.length);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic metrics retrieved successfully.",
                    data: {
                        allClinics: {
                            label: "All Clinics",
                            amount: allClinics.length,
                            percentageChange: percentageChangeAll.toFixed(1),
                            period: "this month"
                        },
                        supportedClinics: {
                            label: "Supported Clinics",
                            amount: supportedClinics.length,
                            percentageChange: percentageChangeSupported.toFixed(1),
                            period: "this month"
                        }
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getCloudinaryImages(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
                const API_KEY = process.env.CLOUDINARY_API_KEY;
                const API_SECRET = process.env.CLOUDINARY_API_SECRET;
                const auth = base_64_1.default.encode(`${API_KEY}:${API_SECRET}`);
                const cloudinaryRes = yield axios_1.default.get(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image`, {
                    params: {
                        type: "upload",
                        max_results: 100
                    },
                    headers: {
                        Authorization: `Basic ${auth}`
                    }
                });
                const icons = [];
                const images = [];
                for (const img of cloudinaryRes.data.resources) {
                    const imageData = {
                        public_id: img.public_id,
                        secure_url: img.secure_url,
                        format: img.format,
                        width: img.width,
                        height: img.height
                    };
                    if (img.asset_folder === "tests_icons") {
                        icons.push(imageData);
                    }
                    else if (img.asset_folder === "tests_images") {
                        images.push(imageData);
                    }
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Cloudinary images retrieved successfully.",
                    data: {
                        icons,
                        images
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static purgeClinicOrPatient(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { patientEmail, password } = req.body;
                // Get the main clinic
                const mainClinic = yield clinic_model_1.default.findOne({
                    email: "damilolasanni48@gmail.com"
                });
                if (!mainClinic) {
                    return res
                        .status(404)
                        .json({ success: false, message: "Main clinic not found." });
                }
                // DELETE PATIENT if patientEmail is provided
                if (patientEmail) {
                    if (!password ||
                        !(yield (0, password_utils_1.comparePasswords)(password, mainClinic.password))) {
                        return res.status(403).json({
                            success: false,
                            message: "Unauthorized: Incorrect password."
                        });
                    }
                    const patient = yield patient_model_1.default.findOne({ email: patientEmail });
                    if (!patient) {
                        return res.status(404).json({
                            success: false,
                            message: `Patient ${patientEmail} not found.`
                        });
                    }
                    const patientId = patient._id;
                    yield order_model_1.default.deleteMany({ patient: patientId });
                    yield testBooking_model_1.default.deleteMany({ patient: patientId });
                    yield test_result_model_1.default.deleteMany({ patient: patientId });
                    yield patient_notification_model_1.default.deleteMany({ patient: patientId });
                    yield review_model_1.default.deleteMany({ patient: patientId });
                    yield patient_model_1.default.deleteOne({ _id: patientId });
                    return res.status(200).json({
                        success: true,
                        message: `Patient ${patientEmail} deleted successfully.`
                    });
                }
                // DELETE main clinic data (not the clinic itself)
                const clinicId = mainClinic._id;
                yield claim_model_1.default.deleteMany({ clinic: clinicId });
                yield clinic_notification_model_1.default.deleteMany({ clinic: clinicId });
                yield order_model_1.default.deleteMany({ clinic: clinicId });
                yield test_result_model_1.default.deleteMany({ clinic: clinicId });
                yield testBooking_model_1.default.deleteMany({ clinic: clinicId });
                yield test_model_1.default.deleteMany({ clinic: clinicId });
                yield review_model_1.default.deleteMany({ clinic: clinicId });
                yield clinic_model_1.default.updateOne({ _id: clinicId }, { $set: { balance: 0 } });
                return res.status(200).json({
                    success: true,
                    message: "All data for the main clinic has been purged. Clinic account preserved."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static createSingleClinic(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const data = req.body;
                if (!data || typeof data !== "object") {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid clinic payload.");
                }
                const { email } = data;
                // Check if the email already exists in patients, clinics, or admins
                const existingPatientByEmail = yield patient_model_1.default.findOne({ email });
                const existingClinicByEmail = yield clinic_model_1.default.findOne({ email });
                const existingAdminByEmail = yield admin_model_1.default.findOne({ email });
                if (existingPatientByEmail ||
                    existingClinicByEmail ||
                    existingAdminByEmail) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "An account with this email already exists.");
                }
                const currencySymbol = ((_a = constant_1.COUNTRIES.find((c) => c.value.toLowerCase() === "rwanda")) === null || _a === void 0 ? void 0 : _a.currencySymbol) || "RWF";
                const defaultPassword = yield (0, password_utils_1.hashPassword)("Clinic@123");
                const clinic = new clinic_model_1.default(Object.assign(Object.assign({}, data), { password: defaultPassword, termsAccepted: true, currencySymbol, isVerified: true, status: "pending" }));
                yield clinic.save();
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Clinic created successfully"
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static clearAllSubscriptions(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield subscription_model_1.default.deleteMany({});
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All subscriptions have been cleared.",
                    deletedCount: result.deletedCount
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static clearAdminNotifications(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const adminId = (0, utils_1.getAdminId)(req);
                yield admin_notification_model_1.default.deleteMany({ admin: adminId });
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
    static createPractitionerCategory(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["name", "type"]);
                const { name, type, description } = req.body;
                const exists = yield practitionercategory_model_1.default.exists({
                    name: new RegExp(`^${name}$`, "i"),
                    type
                });
                if (exists) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Category already exists for this type.");
                }
                yield practitionercategory_model_1.default.create({
                    name,
                    type,
                    description
                });
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Category created successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static updatePractitionerCategory(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { name, type, description } = req.body;
                const category = yield practitionercategory_model_1.default.findById(id);
                if (!category) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Category not found.");
                }
                category.name = name || category.name;
                category.type = type || category.type;
                category.description = description || category.description;
                yield category.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Category updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deletePractitionerCategory(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const category = yield practitionercategory_model_1.default.findById(id);
                if (!category) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Category not found.");
                }
                const categoryInUse = yield clinic_model_1.default.exists({ categories: id });
                if (categoryInUse) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Category is in use by one or more clinics. Cannot delete.");
                }
                yield category.deleteOne();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Category deleted successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getAllCategoriesForAdmin(req, res, next) {
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
exports.default = AdminController;
