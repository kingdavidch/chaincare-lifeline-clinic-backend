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
const date_fns_1 = require("date-fns");
const http_status_1 = __importDefault(require("http-status"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const supported_insurance_1 = require("../constant/supported.insurance");
const discount_model_1 = __importDefault(require("../discount/discount.model"));
const order_model_1 = __importDefault(require("../order/order.model"));
const review_model_1 = __importDefault(require("../review/review.model"));
const smtp_patient_service_1 = __importDefault(require("../smtp/patient/smtp.patient.service"));
const test_item_model_1 = __importDefault(require("../test/test.item.model"));
const test_model_1 = __importDefault(require("../test/test.model"));
const utils_1 = require("../utils");
const app_error_1 = __importDefault(require("../utils/app.error"));
const password_utils_1 = require("../utils/password.utils");
const patient_model_1 = __importDefault(require("./patient.model"));
const patient_notification_model_1 = __importDefault(require("./patient.notification.model"));
const JWT_SECRET = process.env.JWT_SECRET;
class PatientController {
    /**
     * Patient Signup
     */
    static signUp(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, [
                    "fullName",
                    "phoneNumber",
                    "email",
                    "password",
                    "country",
                    "termsAccepted"
                ]);
                const { fullName, phoneNumber, email, password, country, termsAccepted } = req.body;
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Please provide a valid email address.");
                }
                const [existingPatientByEmail, existingClinicByEmail, existingPhone, existingClinicPhone] = yield Promise.all([
                    patient_model_1.default.findOne({ email }).lean(),
                    clinic_model_1.default.findOne({ email }).lean(),
                    patient_model_1.default.findOne({ phoneNumber }).lean(),
                    clinic_model_1.default.findOne({ phoneNumber }).lean()
                ]);
                if (existingPatientByEmail || existingClinicByEmail) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "An account with this email already exists.");
                }
                if (existingPhone || existingClinicPhone) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "Phone number is already in use.");
                }
                if (!termsAccepted) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "You must accept the terms and policies.");
                }
                const hashedPassword = yield (0, password_utils_1.hashPassword)(password);
                const otp = (0, utils_1.generateEmailOTP)();
                const otpExpiresAt = (0, date_fns_1.addMinutes)(new Date(), 5);
                const newPatient = new patient_model_1.default({
                    fullName,
                    phoneNumber,
                    email,
                    password: hashedPassword,
                    country,
                    emailOtp: otp,
                    emailOtpExpiresAt: otpExpiresAt,
                    termsAccepted
                });
                yield Promise.all([
                    newPatient.save(),
                    smtp_patient_service_1.default.sendVerificationEmail(newPatient)
                        .then(() => console.log("Verification email sent to:", email))
                        .catch((err) => console.error("Verification email failed:", email, err)),
                    smtp_patient_service_1.default.sendWelcomeEmail(newPatient)
                        .then(() => console.log("Welcome email sent to:", email))
                        .catch((err) => console.error("Welcome email failed:", email, err))
                ]);
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Signup successful. Please verify your email.",
                    data: {
                        email: newPatient.email,
                        fullName: newPatient.fullName
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Patient Login
     */
    static login(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email", "password"]);
                const email = req.body.email.trim().toLowerCase();
                const password = req.body.password;
                const patient = yield patient_model_1.default.findOne({ email });
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Invalid email or password.");
                }
                if (!patient.isVerified) {
                    throw new app_error_1.default(http_status_1.default.FORBIDDEN, "Your account is not verified. Please verify your email before logging in.");
                }
                const isPasswordValid = yield (0, password_utils_1.comparePasswords)(password, patient.password);
                if (!isPasswordValid) {
                    throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Invalid email or password.");
                }
                const token = jsonwebtoken_1.default.sign({ id: patient.id }, JWT_SECRET);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Login successful.",
                    data: {
                        token,
                        fullName: patient.fullName,
                        email: patient.email
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Google Login
     */
    static googleLogin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { idToken, phoneNumber, country } = req.body;
                if (!idToken) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Missing Google ID token.");
                }
                const googleRes = yield axios_1.default.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
                const { sub: googleId, email, name: fullName, picture: avatar } = googleRes.data;
                if (!email || !googleId) {
                    throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Invalid or expired Google token.");
                }
                let patient = yield patient_model_1.default.findOne({ googleId });
                if (!patient) {
                    patient = yield patient_model_1.default.findOne({ email });
                    if (patient && !patient.googleId) {
                        patient.googleId = googleId;
                        patient.loginProvider = "google";
                        patient.avatar || (patient.avatar = avatar);
                        yield patient.save();
                    }
                }
                if (!patient) {
                    if (!phoneNumber || !country) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Missing phone number or country for new Google user.");
                    }
                    const existingPatientByEmail = yield patient_model_1.default.findOne({ email });
                    const existingClinicByEmail = yield clinic_model_1.default.findOne({ email });
                    if (existingPatientByEmail || existingClinicByEmail) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "An account with this email already exists.");
                    }
                    const existingPhone = yield patient_model_1.default.findOne({ phoneNumber });
                    const existingClinicPhone = yield clinic_model_1.default.findOne({ phoneNumber });
                    if (existingPhone || existingClinicPhone) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "Phone number is already in use.");
                    }
                    patient = yield patient_model_1.default.create({
                        fullName,
                        email,
                        googleId,
                        loginProvider: "google",
                        avatar,
                        termsAccepted: true,
                        country: country.toLowerCase(),
                        phoneNumber: phoneNumber.trim(),
                        password: "GOOGLE_LOGIN_NO_PASSWORD",
                        isVerified: true
                    });
                }
                const token = jsonwebtoken_1.default.sign({ id: patient.id }, JWT_SECRET);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Login successful via Google.",
                    data: {
                        token,
                        fullName: patient.fullName,
                        email: patient.email
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Verify Email OTP
     */
    static verifyEmailOtp(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email", "otp"]);
                const { email, otp } = req.body;
                const patient = yield patient_model_1.default.findOne({ email, emailOtp: otp });
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Invalid email or OTP.");
                }
                if ((0, date_fns_1.isAfter)(new Date(), patient.emailOtpExpiresAt)) {
                    throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "OTP has expired.");
                }
                patient.emailOtp = undefined;
                patient.emailOtpExpiresAt = undefined;
                patient.isVerified = true;
                yield patient.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Email OTP verified successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Resend OTP
     */
    static resendOtp(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email"]);
                const { email } = req.body;
                const patient = yield patient_model_1.default.findOne({ email });
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Account not found.");
                }
                const otp = (0, utils_1.generateEmailOTP)();
                const otpExpiresAt = (0, date_fns_1.addMinutes)(new Date(), 5);
                patient.emailOtp = otp;
                patient.emailOtpExpiresAt = otpExpiresAt;
                yield patient.save();
                yield smtp_patient_service_1.default.sendVerificationEmail(patient)
                    .then(() => {
                    console.log("Verification email sent successfully.");
                })
                    .catch((error) => {
                    console.error("Error sending verification email:", error);
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "OTP has been resent successfully. Please check your email."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Request Password Reset
     */
    static requestPasswordReset(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email"]);
                const { email } = req.body;
                const patient = yield patient_model_1.default.findOne({ email });
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Account not found.");
                }
                const otp = (0, utils_1.generateEmailOTP)();
                const otpExpiresAt = (0, date_fns_1.addMinutes)(new Date(), 5);
                patient.emailOtp = otp;
                patient.emailOtpExpiresAt = otpExpiresAt;
                yield patient.save();
                yield smtp_patient_service_1.default.sendPasswordResetOtp(patient)
                    .then(() => {
                    console.log("email sent successfully.");
                })
                    .catch((error) => {
                    console.error("Error sending email:", error);
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Password reset OTP sent to your email."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Reset Password
     */
    static resetPassword(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                (0, utils_1.handleRequiredFields)(req, ["email", "newPassword", "confirmPassword"]);
                const { email, newPassword, confirmPassword } = req.body;
                if (newPassword !== confirmPassword) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Passwords do not match.");
                }
                const patient = yield patient_model_1.default.findOne({ email });
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Account not found.");
                }
                const hashedPassword = yield (0, password_utils_1.hashPassword)(newPassword);
                patient.password = hashedPassword;
                yield patient.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Password reset successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get Patient Profile
     */
    static getPatientProfile(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                // Fetch the patient details, excluding sensitive fields
                const patient = yield patient_model_1.default
                    .findById(patientId)
                    .select("-password -resetPasswordToken -resetPasswordExpires -emailOtp -emailOtpExpiresAt");
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Patient profile retrieved successfully.",
                    data: patient
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deletePatient(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email } = req.body;
                if (!email || typeof email !== "string") {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid email address.");
                }
                const patient = yield patient_model_1.default.findOne({ email });
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, `No patient found with email: ${email}`);
                }
                yield patient_model_1.default.deleteOne({ email });
                return res
                    .status(http_status_1.default.OK)
                    .json({ message: `Patient with email: ${email} has been deleted.` });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Update Patient Profile
     */
    static updatePatientProfile(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { fullName, phoneNumber, email, stateOrProvince, cityOrDistrict, street, postalCode, coordinates, password, country, dob, idNumber, idType } = req.body;
                const patient = yield patient_model_1.default.findById(patientId);
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                // Check if the email already exists in either patients or clinics
                if (email) {
                    const existingPatientByEmail = yield patient_model_1.default.findOne({ email });
                    const existingClinicByEmail = yield clinic_model_1.default.findOne({ email });
                    if (existingPatientByEmail || existingClinicByEmail) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "Email is already in use.");
                    }
                }
                if (password) {
                    if (password.length < 8) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Password must be at least 8 characters long.");
                    }
                    const hashedPassword = yield (0, password_utils_1.hashPassword)(password);
                    patient.password = hashedPassword;
                }
                if (phoneNumber) {
                    const existingPhone = yield patient_model_1.default.findOne({ phoneNumber });
                    const existingClinicPhone = yield clinic_model_1.default.findOne({ phoneNumber });
                    if (existingPhone || existingClinicPhone) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "Phone number is already in use.");
                    }
                }
                // Upload avatar if provided
                let avatarUrl = patient.avatar;
                if (req.file) {
                    const uploadResult = yield (0, utils_1.uploadToCloudinary)(req.file.buffer, "image", `patient_avatars/${req.file.originalname}`);
                    avatarUrl = uploadResult.secure_url;
                }
                if (!patient.location) {
                    patient.location = {
                        stateOrProvince: "",
                        cityOrDistrict: "",
                        street: "",
                        postalCode: "",
                        coordinates: { latitude: 0, longitude: 0 }
                    };
                }
                if (stateOrProvince) {
                    patient.location.stateOrProvince = stateOrProvince;
                }
                if (cityOrDistrict) {
                    patient.location.cityOrDistrict = cityOrDistrict;
                }
                if (street) {
                    patient.location.street = street;
                }
                if (postalCode) {
                    patient.location.postalCode = postalCode;
                }
                if (coordinates) {
                    patient.location.coordinates = {
                        latitude: (_a = coordinates.latitude) !== null && _a !== void 0 ? _a : null,
                        longitude: (_b = coordinates.longitude) !== null && _b !== void 0 ? _b : null
                    };
                }
                patient.fullName = fullName || patient.fullName;
                patient.phoneNumber = phoneNumber || patient.phoneNumber;
                patient.email = email || patient.email;
                patient.avatar = avatarUrl;
                patient.country = country || patient.country;
                patient.dob = dob || patient.dob;
                patient.idNumber = idNumber || patient.idNumber;
                patient.idType = idType || patient.idType;
                yield patient.save();
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
    /**
     * Add Insurance to Patient Profile
     */
    static addInsurance(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { insuranceId, affiliationNumber, policyNumber, relationship, fullName, dateOfBirth, gender, phoneNumber, workplaceAddress, workplaceDepartment } = req.body;
                const patient = yield patient_model_1.default.findById(patientId);
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const existingInsurance = patient.insurance.find((ins) => ins.insuranceId === insuranceId);
                if (existingInsurance) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "This insurance is already added to your profile.");
                }
                patient.insurance.push({
                    insuranceId,
                    affiliationNumber,
                    policyNumber,
                    relationship,
                    fullName,
                    dateOfBirth,
                    gender,
                    phoneNumber,
                    workplaceAddress,
                    workplaceDepartment
                });
                yield patient.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Insurance added successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Update an existing insurance entry
     */
    static updateInsurance(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { insuranceId } = req.params;
                const updates = req.body;
                const patient = yield patient_model_1.default.findById(patientId);
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                // Check if insurance exists before updating
                const insuranceIndex = patient.insurance.findIndex((ins) => ins.insuranceId === parseInt(insuranceId));
                if (insuranceIndex === -1) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Insurance entry not found.");
                }
                // Ensure no duplicate insurance entry
                if (updates.insuranceId &&
                    updates.insuranceId !== parseInt(insuranceId)) {
                    if (patient.insurance.some((ins) => ins.insuranceId === updates.insuranceId)) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "This updated insurance already exists.");
                    }
                }
                Object.assign(patient.insurance[insuranceIndex], updates);
                yield patient.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Insurance updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Delete an insurance entry
     */
    static deleteInsurance(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { insuranceId } = req.params;
                const patient = yield patient_model_1.default.findById(patientId);
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                // Filter out the insurance entry
                const initialLength = patient.insurance.length;
                patient.insurance = patient.insurance.filter((ins) => ins.insuranceId !== parseInt(insuranceId));
                if (initialLength === patient.insurance.length) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Insurance entry not found.");
                }
                yield patient.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Insurance deleted successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get all clinics that offer a specific test in the same country as the patient
     */
    static getClinicsForTest(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { testId } = req.params;
                const patientId = (0, utils_1.getPatientId)(req);
                const patient = yield patient_model_1.default.findById(patientId).select("country");
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const tests = yield test_model_1.default
                    .find({ _id: testId })
                    .select("clinic price testName");
                if (!tests.length) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No clinics found for this test.");
                }
                const clinicIds = tests.map((test) => test.clinic);
                const [reviews, clinics, allTestItem] = yield Promise.all([
                    review_model_1.default
                        .find({ clinic: { $in: clinicIds } })
                        .select("clinic rating"),
                    clinic_model_1.default.find({
                        _id: { $in: clinicIds },
                        country: patient.country.toLowerCase(),
                        status: "approved"
                    })
                        .select("clinicName address avatar phoneNo location")
                        .lean(),
                    test_item_model_1.default.find().select("name image")
                ]);
                const formattedClinics = clinics.map((clinic) => {
                    var _a, _b, _c, _d, _e, _f;
                    const clinicTests = tests.filter((test) => test.clinic.toString() === clinic._id.toString());
                    const clinicReviews = reviews.filter((review) => review.clinic.toString() === clinic._id.toString());
                    const totalRatings = clinicReviews.reduce((acc, review) => acc + review.rating, 0);
                    const averageRating = clinicReviews.length > 0 ? totalRatings / clinicReviews.length : null;
                    const testName = (_b = (_a = clinicTests === null || clinicTests === void 0 ? void 0 : clinicTests[0]) === null || _a === void 0 ? void 0 : _a.testName) !== null && _b !== void 0 ? _b : "";
                    const testImage = ((_c = allTestItem.find((cat) => cat.name.toLowerCase() === testName.toLowerCase())) === null || _c === void 0 ? void 0 : _c.image) || "";
                    return {
                        id: clinic._id,
                        clinicName: clinic.clinicName,
                        location: ((_d = clinic.location) === null || _d === void 0 ? void 0 : _d.street) || null,
                        phoneNo: clinic.phoneNo || null,
                        avatar: clinic.avatar || null,
                        rating: averageRating,
                        price: (_f = (_e = clinicTests[0]) === null || _e === void 0 ? void 0 : _e.price) !== null && _f !== void 0 ? _f : null,
                        testImage
                    };
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinics providing the selected test retrieved successfully.",
                    data: formattedClinics
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get all clinics
     */
    static getAllClinics(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { location, insurance, test, supportedByLifeLine } = req.query;
                const patientId = (0, utils_1.getPatientId)(req);
                const query = {};
                const patient = yield patient_model_1.default
                    .findById(patientId)
                    .select("country email");
                if (patient) {
                    query.country = patient.country.toLowerCase();
                }
                if (location) {
                    const locationRegex = new RegExp(location.toLowerCase(), "i");
                    query.$or = [
                        { "location.stateOrProvince": { $regex: locationRegex } },
                        { "location.cityOrDistrict": { $regex: locationRegex } },
                        { "location.street": { $regex: locationRegex } }
                    ];
                }
                if (insurance) {
                    query.supportInsurance = { $in: [Number(insurance)] };
                }
                if (test) {
                    const matchingTests = yield test_model_1.default
                        .find({
                        testName: {
                            $regex: new RegExp(test.toLowerCase(), "i")
                        },
                        isDeleted: false
                    })
                        .select("clinic -_id");
                    if (!matchingTests.length) {
                        throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No clinics offer the specified test.");
                    }
                    const clinicIds = [...new Set(matchingTests.map((test) => test.clinic))];
                    query._id = { $in: clinicIds };
                }
                if (supportedByLifeLine !== undefined) {
                    query.contractAccepted = supportedByLifeLine === "true";
                }
                const totalClinicsInDatabase = yield clinic_model_1.default.countDocuments();
                query.status = "approved";
                let clinics = yield clinic_model_1.default.find(query).select("clinicName location country avatar supportInsurance contractAccepted email");
                const allowedPatientEmail = "sannifortune11@gmail.com";
                const restrictedClinicEmail = "damilolasanni48@gmail.com";
                if ((patient === null || patient === void 0 ? void 0 : patient.email) !== allowedPatientEmail) {
                    clinics = clinics.filter((clinic) => clinic.email !== restrictedClinicEmail);
                }
                const clinicIds = clinics.map((clinic) => clinic._id);
                const reviews = yield review_model_1.default
                    .find({ clinic: { $in: clinicIds } })
                    .select("clinic rating");
                const formattedClinics = clinics.map((clinic) => {
                    const clinicReviews = reviews.filter((review) => review.clinic.toString() === clinic._id.toString());
                    const averageRating = clinicReviews.length > 0
                        ? clinicReviews.reduce((acc, review) => acc + review.rating, 0) /
                            clinicReviews.length
                        : null;
                    return {
                        id: clinic._id,
                        clinicName: clinic.clinicName,
                        location: clinic.location,
                        country: clinic.country,
                        avatar: clinic.avatar,
                        contractAccepted: clinic.contractAccepted
                            ? "Supports LifeLine Subscription"
                            : null,
                        rating: averageRating
                    };
                });
                formattedClinics.sort((a, b) => { var _a, _b; return (_a = a.clinicName) === null || _a === void 0 ? void 0 : _a.toLowerCase().localeCompare((_b = b.clinicName) === null || _b === void 0 ? void 0 : _b.toLowerCase()); });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinics retrieved successfully.",
                    hasNoClinics: totalClinicsInDatabase === 0,
                    data: formattedClinics
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get all supported insurance providers
     */
    static getSupportedInsurance(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Supported insurance providers retrieved successfully.",
                    data: supported_insurance_1.SUPPORTED_INSURANCE_PROVIDERS
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get a specific clinic's details
     */
    static getClinicDetails(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { clinicId } = req.params;
                const patientId = (0, utils_1.getPatientId)(req);
                const clinic = yield clinic_model_1.default.findOne({
                    _id: clinicId,
                    status: "approved"
                })
                    .select("clinicName location bio clinicId avatar reviews supportInsurance isVerified onlineStatus country contractAccepted")
                    .populate({
                    path: "reviews",
                    select: "rating comment patient clinic",
                    populate: {
                        path: "patient",
                        select: "fullName email"
                    }
                });
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const patient = yield patient_model_1.default.findById(patientId).select("country");
                if (patient && clinic.country !== patient.country) {
                    throw new app_error_1.default(http_status_1.default.FORBIDDEN, "This clinic is not available in your country.");
                }
                const hasOrderedBefore = yield order_model_1.default.exists({
                    patient: patientId,
                    clinic: clinicId,
                    status: "success"
                });
                const [tests, allTestItem, discounts] = yield Promise.all([
                    test_model_1.default
                        .find({ clinic: clinicId })
                        .select("testName price turnaroundTime preTestRequirements homeCollection currencySymbol insuranceCoverage coveredByLifeLine description")
                        .lean(),
                    test_item_model_1.default.find().select("name image"),
                    discount_model_1.default
                        .find({
                        clinic: clinicId,
                        validUntil: { $gte: new Date() },
                        status: 0,
                        isDeleted: false
                    })
                        .lean()
                ]);
                const testsWithImages = tests
                    .map((test) => {
                    var _a;
                    const testImage = ((_a = allTestItem.find((cat) => cat.name.toLowerCase() === test.testName.toLowerCase())) === null || _a === void 0 ? void 0 : _a.image) || "";
                    return {
                        _id: test._id,
                        testName: test.testName,
                        price: test.price,
                        currencySymbol: test.currencySymbol,
                        image: testImage,
                        coveredByLifeLine: test.coveredByLifeLine
                            ? "Supports LifeLine Subscription"
                            : null
                    };
                })
                    .sort((a, b) => { var _a; return (_a = a === null || a === void 0 ? void 0 : a.testName) === null || _a === void 0 ? void 0 : _a.localeCompare(b.testName); });
                const clinicWithTests = Object.assign(Object.assign({}, clinic.toObject()), { tests: testsWithImages, hasOrderedBefore: !!hasOrderedBefore, contractAccepted: clinic.contractAccepted
                        ? "Supports LifeLine Subscription"
                        : null, discounts: discounts || [] });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic details retrieved successfully.",
                    data: clinicWithTests
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deletePatientByEmail(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email } = req.body;
                if (!email) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Email is required.");
                }
                const deletedPatient = yield patient_model_1.default.findOneAndDelete({ email });
                if (!deletedPatient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Patient deleted successfully."
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
                const patients = yield patient_model_1.default.find().select("-password");
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Patients retrieved successfully.",
                    data: patients
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get top 3 clinics based on overall rating
     */
    static getTopClinics(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const patient = yield patient_model_1.default
                    .findById(patientId)
                    .select("country email");
                const query = {
                    status: "approved"
                };
                if (patient === null || patient === void 0 ? void 0 : patient.country) {
                    query.country = patient.country.toLowerCase();
                }
                let clinics = yield clinic_model_1.default.find(query).select("clinicName location avatar country email");
                const allowedPatientEmail = "sannifortune11@gmail.com";
                const restrictedClinicEmail = "damilolasanni48@gmail.com";
                if ((patient === null || patient === void 0 ? void 0 : patient.email) !== allowedPatientEmail) {
                    clinics = clinics.filter((clinic) => clinic.email !== restrictedClinicEmail);
                }
                if (!clinics.length) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No clinics found.");
                }
                const clinicIds = clinics.map((clinic) => clinic._id);
                const reviews = yield review_model_1.default
                    .find({ clinic: { $in: clinicIds } })
                    .select("clinic rating");
                const formattedClinics = clinics
                    .map((clinic) => {
                    const clinicReviews = reviews.filter((review) => review.clinic.toString() === clinic._id.toString());
                    if (clinicReviews.length === 0)
                        return null;
                    const totalRatings = clinicReviews.reduce((acc, review) => acc + review.rating, 0);
                    const averageRating = totalRatings / clinicReviews.length;
                    return {
                        id: clinic._id,
                        clinicName: clinic.clinicName,
                        location: clinic.location,
                        avatar: clinic.avatar,
                        rating: averageRating
                    };
                })
                    .filter((clinic) => clinic !== null);
                const sortedClinics = formattedClinics.sort((a, b) => b.rating - a.rating);
                const topClinics = sortedClinics.slice(0, 3);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Top 3 clinics retrieved successfully.",
                    data: topClinics
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get Patient Notifications with Progressive Pagination
     */
    static getPatientNotifications(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const page = parseInt(req.query.page) || 1;
                const baseLimit = 10;
                const limit = baseLimit * page;
                const skip = 0;
                const type = req.query.type;
                const filter = {
                    patient: patientId
                };
                if (type) {
                    filter.type = type;
                }
                const totalNotificationsInDatabase = yield patient_notification_model_1.default.countDocuments(filter);
                const notifications = yield patient_notification_model_1.default
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit);
                const total = yield patient_notification_model_1.default.countDocuments(filter);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Patient notifications fetched successfully.",
                    hasNoNotifications: totalNotificationsInDatabase === 0,
                    data: {
                        notifications,
                        currentPage: page,
                        totalPages: Math.ceil(total / baseLimit),
                        total
                    }
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Mark All Notifications as Read
     */
    static markAllAsRead(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                yield patient_notification_model_1.default.updateMany({ patient: patientId, isRead: false }, { $set: { isRead: true } });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All notifications marked as read."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Mark a Single Notification as Read
     */
    static markOneAsRead(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { id } = req.params;
                const notification = yield patient_notification_model_1.default.findOne({
                    _id: id,
                    patient: patientId
                });
                if (!notification) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Notification not found.");
                }
                if (!notification.isRead) {
                    notification.isRead = true;
                    yield notification.save();
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Notification marked as read."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Save Expo Push Token for a patient
     */
    static savePushToken(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const { token } = req.body;
                if (!token) {
                    return res.status(http_status_1.default.BAD_REQUEST).json({
                        success: false,
                        message: "Expo Push Token is required."
                    });
                }
                yield patient_model_1.default.findByIdAndUpdate(patientId, {
                    expoPushToken: token
                });
                return res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Push token saved successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Soft Delete Authenticated Patient
     */
    static deletePatientAccount(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                const patient = yield patient_model_1.default.findById(patientId);
                if (!patient || patient.isDeleted) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                patient.isDeleted = true;
                yield patient.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Patient soft-deleted successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Reactivate Soft-Deleted Patient by Email
     */
    static reactivatePatientByEmail(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email } = req.body;
                if (!email) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "email is required.");
                }
                const patient = yield patient_model_1.default.findOne({
                    email: email.toLowerCase().trim(),
                    isDeleted: true
                });
                if (!patient || !patient.isDeleted) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Patient is not deleted or does not exist.");
                }
                patient.isDeleted = false;
                yield patient.save();
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Patient account reactivated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static clearPatientNotifications(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patientId = (0, utils_1.getPatientId)(req);
                yield patient_notification_model_1.default.deleteMany({ patient: patientId });
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
}
exports.default = PatientController;
