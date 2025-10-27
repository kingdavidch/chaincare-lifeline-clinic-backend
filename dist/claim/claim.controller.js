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
const http_status_1 = __importDefault(require("http-status"));
const claim_model_1 = __importDefault(require("./claim.model"));
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const subscription_model_1 = __importDefault(require("../subscription/subscription.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
const app_error_1 = __importDefault(require("../utils/app.error"));
const utils_1 = require("../utils");
require("dotenv/config");
const smtp_claim_service_1 = __importDefault(require("../smtp/claim/smtp.claim.service"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const clinic_notification_model_1 = __importDefault(require("../clinic/clinic.notification.model"));
const moment_1 = __importDefault(require("moment"));
const patient_notification_model_1 = __importDefault(require("../patient/patient.notification.model"));
const sendPushNotification_1 = require("../utils/sendPushNotification");
const __1 = require("..");
const utils_2 = require("../admin/utils");
class ClaimController {
    /**
     * Clinic Adds a Claim (Only for Premium Subscription Patients)
     */
    static addClaim(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { testId, patientEmail } = req.body;
                const patient = yield patient_model_1.default.findOne({ email: patientEmail });
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const subscription = yield subscription_model_1.default.findOne({
                    patient: patient._id,
                    planName: "premium",
                    status: "active"
                });
                if (!subscription) {
                    throw new app_error_1.default(http_status_1.default.FORBIDDEN, "Only Premium Plan subscribers can make claims.");
                }
                const currentDate = (0, moment_1.default)();
                const cooldownDays = parseInt((_a = process.env.ORDER_COOLDOWN_DAYS) !== null && _a !== void 0 ? _a : "0");
                const cooldownEndDate = (0, moment_1.default)(subscription.startDate).add(cooldownDays, "days");
                const lastClaim = yield claim_model_1.default
                    .findOne({ patient: patient._id })
                    .sort({ date: -1 });
                if (lastClaim) {
                    const lastClaimDate = (0, moment_1.default)(lastClaim.date).add(cooldownDays, "days");
                    if (currentDate.isBefore(lastClaimDate)) {
                        throw new app_error_1.default(http_status_1.default.FORBIDDEN, `You can only make a claim every ${cooldownDays} days. Next claim available on ${lastClaimDate.format("dddd, MMMM D, YYYY")}.`);
                    }
                }
                const test = yield test_model_1.default.findOne({ _id: testId, clinic: clinicId });
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found in this clinic.");
                }
                if (subscription.privilege < test.price) {
                    throw new app_error_1.default(http_status_1.default.PAYMENT_REQUIRED, "Insufficient privilege balance to make this claim.");
                }
                const currentMonthStart = (0, moment_1.default)().startOf("month").toDate();
                let currentMonthSpending = subscription.monthlySpending.find((ms) => (0, moment_1.default)(ms.month).isSame(currentMonthStart, "month"));
                if (!currentMonthSpending) {
                    currentMonthSpending = {
                        month: currentMonthStart,
                        totalSpent: test.price
                    };
                    subscription.monthlySpending.push(currentMonthSpending);
                }
                else {
                    currentMonthSpending.totalSpent += test.price;
                }
                subscription.privilege -= test.price;
                yield subscription.save();
                // Track money owed to the clinic
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                clinic.totalMoneyOwed = (clinic.totalMoneyOwed || 0) + test.price;
                yield clinic.save(); // Save the updated owed amount
                const currentTime = currentDate.format("hh:mm A");
                const newClaim = yield claim_model_1.default.create({
                    clinic: clinicId,
                    patient: patient._id,
                    testName: test.testName,
                    cost: test.price,
                    date: currentDate.toDate(),
                    time: currentTime
                });
                const totalSpentThisPeriod = subscription.monthlySpending.reduce((acc, month) => acc + month.totalSpent, 0);
                const claimDetails = {
                    claimNo: newClaim === null || newClaim === void 0 ? void 0 : newClaim.claimNo,
                    testName: test === null || test === void 0 ? void 0 : test.testName,
                    clinicName: clinic === null || clinic === void 0 ? void 0 : clinic.clinicName,
                    clinicAddress: (_b = clinic === null || clinic === void 0 ? void 0 : clinic.location) === null || _b === void 0 ? void 0 : _b.street,
                    clinicPhone: clinic === null || clinic === void 0 ? void 0 : clinic.phoneNo,
                    claimDate: currentDate.format("dddd, MMMM D, YYYY"),
                    price: test === null || test === void 0 ? void 0 : test.price,
                    turnaroundTime: test === null || test === void 0 ? void 0 : test.turnaroundTime,
                    homeCollection: (test === null || test === void 0 ? void 0 : test.homeCollection) || "N/A",
                    preTestRequirements: (test === null || test === void 0 ? void 0 : test.preTestRequirements) || "N/A",
                    totalSpent: totalSpentThisPeriod,
                    remainingBalance: subscription === null || subscription === void 0 ? void 0 : subscription.privilege,
                    nextClaimDate: cooldownEndDate === null || cooldownEndDate === void 0 ? void 0 : cooldownEndDate.format("dddd, MMMM D, YYYY")
                };
                // Send email to patient
                yield smtp_claim_service_1.default.sendClaimNotificationEmail(patient, claimDetails)
                    .then(() => console.log("Claim email sent successfully."))
                    .catch((error) => console.log("Error sending Claim email:", error));
                // Patient notification
                const newNotification = yield patient_notification_model_1.default.create({
                    patient: patient._id,
                    title: "New Claim Submitted",
                    message: `Your claim for ${test.testName} at ${clinic.clinicName} has been submitted successfully (Claim No: ${newClaim.claimNo}).`,
                    type: "claim",
                    isRead: false
                });
                if (patient === null || patient === void 0 ? void 0 : patient.expoPushToken) {
                    yield (0, sendPushNotification_1.sendPushNotification)({
                        expoPushToken: patient.expoPushToken,
                        title: newNotification.title,
                        message: newNotification.message,
                        type: newNotification.type
                    });
                }
                // Clinic notification
                yield clinic_notification_model_1.default.create({
                    clinic: clinicId,
                    title: "New Claim Added",
                    message: `A new claim (Claim No: ${newClaim.claimNo}) has been added for ${patient.fullName}.`,
                    type: "claim",
                    isRead: false
                });
                // ✅ Admin notification
                yield (0, utils_2.notifyAdmin)("New Claim Submitted", `A new claim (Claim No: ${newClaim.claimNo}) was submitted by clinic "${clinic.clinicName}" for test "${test.testName}".`, "claim");
                __1.io.emit("claim:add", {
                    clinicId,
                    claimId: newClaim._id,
                    patientId: patient._id,
                    testName: test.testName,
                    cost: test.price,
                    claimDate: currentDate.toDate(),
                    remainingBalance: subscription.privilege,
                    totalSpentThisMonth: currentMonthSpending.totalSpent,
                    clinicName: clinic.clinicName
                });
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Claim added successfully. Notification email sent to patient.",
                    remainingBalance: subscription.privilege,
                    totalSpentThisMonth: currentMonthSpending.totalSpent
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Clinic Gets All Claims (With Pagination, Search, and Date Filtering)
     */
    static getAllClaims(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const { page = "1", limit = "10", status = "", search = "", date } = req.query;
                const pageNumber = parseInt(page, 10);
                const limitNumber = parseInt(limit, 10);
                const skip = (pageNumber - 1) * limitNumber;
                const query = { clinic: clinicId };
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
                    specificDate.setHours(0, 0, 0, 0); // Set to start of the day
                    const nextDay = new Date(specificDate);
                    nextDay.setDate(nextDay.getDate() + 1); // Move to next day start
                    query.date = { $gte: specificDate, $lt: nextDay };
                }
                // Check if there are any claims at all in the database (unfiltered)
                const totalClaimsInDatabase = yield claim_model_1.default.countDocuments({
                    clinic: clinicId
                });
                // Fetch claims with filters
                const [claims, totalClaims] = yield Promise.all([
                    claim_model_1.default
                        .find(query)
                        .populate("patient", "fullName")
                        .select("claimNo patient testName cost date")
                        .sort({ createdAt: -1 })
                        .limit(limitNumber)
                        .skip(skip)
                        .lean(),
                    claim_model_1.default.countDocuments(query)
                ]);
                const claimsWithCurrency = claims === null || claims === void 0 ? void 0 : claims.map((claim) => (Object.assign(Object.assign({}, claim), { currencySymbol: clinic.currencySymbol })));
                // If no claims found, return a "No claims found" message
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
     * Clinic Views Patient Claim History
     */
    static getPatientClaimHistory(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const { patientId } = req.params;
                const patient = yield patient_model_1.default.findOne({ patientId });
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const subscription = yield subscription_model_1.default.findOne({
                    patient: patient._id,
                    status: "active",
                    planName: "premium"
                });
                if (!subscription) {
                    throw new app_error_1.default(http_status_1.default.FORBIDDEN, "Only Premium subscribers have claim history.");
                }
                const claims = yield claim_model_1.default
                    .find({ patient: patient._id, clinic: clinicId })
                    .select("claimNo testName testNo cost date time")
                    .sort({ date: -1 })
                    .lean();
                const claimsWithCurrency = claims.map((claim) => (Object.assign(Object.assign({}, claim), { currencySymbol: clinic.currencySymbol })));
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
    static clearPatientClaims(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const email = (_a = req.params.email) === null || _a === void 0 ? void 0 : _a.toLowerCase().trim();
                if (!email) {
                    res.status(http_status_1.default.BAD_REQUEST).json({
                        success: false,
                        message: "Email is required in the URL."
                    });
                    return;
                }
                const patient = yield patient_model_1.default.findOne({ email });
                if (!patient) {
                    res.status(http_status_1.default.NOT_FOUND).json({
                        success: false,
                        message: "Patient not found."
                    });
                    return;
                }
                // Delete claims
                const result = yield claim_model_1.default.deleteMany({ patient: patient._id });
                // Reset subscription spending safely
                const subscription = yield subscription_model_1.default.findOne({
                    patient: patient._id
                });
                if (subscription) {
                    subscription.monthlySpending = [];
                    subscription.markModified("monthlySpending");
                    yield subscription.save();
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: `All claims cleared for patient ${email}.`,
                    deletedCount: result.deletedCount
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = ClaimController;
