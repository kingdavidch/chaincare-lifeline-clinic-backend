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
const test_model_1 = __importDefault(require("./test.model"));
const utils_1 = require("../utils");
const clinic_model_1 = __importDefault(require("../clinic/clinic.model"));
const http_status_1 = __importDefault(require("http-status"));
const app_error_1 = __importDefault(require("../utils/app.error"));
const mongoose_1 = __importDefault(require("mongoose"));
const patient_model_1 = __importDefault(require("../patient/patient.model"));
const test_item_model_1 = __importDefault(require("./test.item.model"));
const __1 = require("..");
const tests_1 = require("../constant/tests");
const axios_1 = __importDefault(require("axios"));
const base_64_1 = __importDefault(require("base-64"));
require("dotenv/config");
const testBooking_model_1 = __importDefault(require("../testBooking(Cart)/testBooking.model"));
class TestController {
    /**
     * Create a new test under a clinic
     */
    static createTest(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                (0, utils_1.handleRequiredFields)(req, [
                    "testName",
                    "price",
                    "turnaroundTime",
                    "homeCollection",
                    "insuranceCoverage",
                    "sampleType"
                ]);
                const clinic = yield clinic_model_1.default
                    .findById(clinicId)
                    .select("currencySymbol");
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found");
                }
                const { testName, price, turnaroundTime, preTestRequirements, homeCollection, insuranceCoverage, description, sampleType } = req.body;
                const testNameLower = testName === null || testName === void 0 ? void 0 : testName.toLowerCase();
                const existingTestItem = yield test_item_model_1.default.findOne({
                    clinic: clinicId,
                    name: { $regex: new RegExp(`^${(0, utils_1.escapeRegex)(testNameLower)}$`, "i") }
                });
                if (!existingTestItem) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid test name. The test must exist in the test categories.");
                }
                const validSampleTypes = [
                    "blood",
                    "respiratory",
                    "urine",
                    "stool",
                    "tissue biopsies",
                    "swabs",
                    "no sample required"
                ];
                if (!validSampleTypes.includes(sampleType === null || sampleType === void 0 ? void 0 : sampleType.toLowerCase())) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid sample type. Please choose from the predefined list.");
                }
                const newTest = yield test_model_1.default.create({
                    clinic: clinicId,
                    testName,
                    testItem: existingTestItem._id,
                    price,
                    currencySymbol: clinic.currencySymbol,
                    turnaroundTime,
                    preTestRequirements,
                    homeCollection,
                    insuranceCoverage,
                    description,
                    sampleType
                });
                yield clinic_model_1.default.findByIdAndUpdate(clinicId, {
                    $push: { tests: newTest._id }
                });
                const testImage = (existingTestItem === null || existingTestItem === void 0 ? void 0 : existingTestItem.image) || "";
                __1.io.emit("test:create", {
                    clinicId,
                    test: {
                        _id: newTest._id,
                        testName: newTest.testName,
                        price: newTest.price,
                        currencySymbol: newTest.currencySymbol,
                        image: testImage,
                        coveredByLifeLine: newTest.coveredByLifeLine
                            ? "Supports LifeLine Subscription"
                            : null
                    }
                });
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Test created successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Create a new test TestItem (from clinic)
     */
    static addTestItemByClinic(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                (0, utils_1.handleRequiredFields)(req, ["name"]);
                const { name, image, icon } = req.body;
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found");
                }
                const nameLower = name === null || name === void 0 ? void 0 : name.toLowerCase();
                const existing = yield test_item_model_1.default.findOne({
                    clinic: clinicId,
                    name: { $regex: new RegExp(`^${(0, utils_1.escapeRegex)(nameLower)}$`, "i") }
                });
                if (existing) {
                    throw new app_error_1.default(http_status_1.default.CONFLICT, "This TestItem already exists for your clinic.");
                }
                yield test_item_model_1.default.create({
                    clinic: clinicId,
                    name,
                    image,
                    icon
                });
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "TestItem added successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get details of a specific test
     */
    static getTestDetail(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                // Ensure clinic exists
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const { id } = req.params;
                const test = yield test_model_1.default.findOne({
                    _id: id,
                    clinic: clinic._id
                }).select("-clinic");
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                }
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test details retrieved successfully.",
                    data: test
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Clinic Updates a Test
     */
    static updateTest(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const { id } = req.params;
                const updates = req.body;
                if (updates === null || updates === void 0 ? void 0 : updates.testName) {
                    const testNameLower = updates.testName.toLowerCase();
                    const existingTestItem = yield test_item_model_1.default.findOne({
                        clinic: clinicId,
                        name: { $regex: new RegExp(`^${(0, utils_1.escapeRegex)(testNameLower)}$`, "i") }
                    });
                    if (!existingTestItem) {
                        throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid test name.");
                    }
                    updates.testItem = existingTestItem._id;
                }
                const updatedTest = yield test_model_1.default.findByIdAndUpdate(id, updates, {
                    new: true
                });
                if (!updatedTest) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                }
                const clinicData = yield clinic_model_1.default
                    .findById(updatedTest.clinic)
                    .select("avatar clinicName contractAccepted country");
                const testItemData = yield test_item_model_1.default.findById(updatedTest.testItem);
                const testImage = (testItemData === null || testItemData === void 0 ? void 0 : testItemData.image) || "";
                const fullTestDetails = {
                    _id: updatedTest._id,
                    clinicId: updatedTest.clinic,
                    testName: updatedTest.testName,
                    price: updatedTest.price,
                    currencySymbol: updatedTest.currencySymbol,
                    turnaroundTime: updatedTest.turnaroundTime,
                    preTestRequirements: updatedTest.preTestRequirements,
                    homeCollection: updatedTest.homeCollection,
                    insuranceCoverage: updatedTest.insuranceCoverage,
                    coveredByLifeLine: updatedTest.coveredByLifeLine
                        ? "Supports LifeLine Subscription"
                        : null,
                    description: updatedTest.description,
                    sampleType: updatedTest.sampleType,
                    testImage: testImage,
                    clinicImage: clinicData === null || clinicData === void 0 ? void 0 : clinicData.avatar,
                    clinicName: clinicData === null || clinicData === void 0 ? void 0 : clinicData.clinicName,
                    contractAccepted: (clinicData === null || clinicData === void 0 ? void 0 : clinicData.contractAccepted)
                        ? "Supports LifeLine Subscription"
                        : null
                };
                __1.io.emit("test:update", {
                    clinicId,
                    testId: updatedTest._id,
                    details: fullTestDetails
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
     * Get details of a specific test (Patient)
     */
    static getTestDetailForPatient(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const patientId = (0, utils_1.getPatientId)(req);
                const patient = yield patient_model_1.default.findById(patientId).select("country");
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const test = yield test_model_1.default.findById(id).select("testName sampleType price currencySymbol turnaroundTime preTestRequirements clinic homeCollection insuranceCoverage coveredByLifeLine description");
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                }
                const clinic = yield clinic_model_1.default
                    .findById(test.clinic)
                    .select("avatar clinicName country contractAccepted clinicId _id");
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                // 🔍 Get test image from TestItem
                const TestItem = yield test_item_model_1.default.findOne({
                    name: { $regex: new RegExp(`^${test.testName}$`, "i") }
                });
                const testDetailsForPatient = {
                    _id: test === null || test === void 0 ? void 0 : test._id,
                    clinicId: clinic.clinicId,
                    clinic_id: clinic._id,
                    testName: test === null || test === void 0 ? void 0 : test.testName,
                    price: test === null || test === void 0 ? void 0 : test.price,
                    currencySymbol: test === null || test === void 0 ? void 0 : test.currencySymbol,
                    turnaroundTime: test === null || test === void 0 ? void 0 : test.turnaroundTime,
                    preTestRequirements: test === null || test === void 0 ? void 0 : test.preTestRequirements,
                    homeCollection: test === null || test === void 0 ? void 0 : test.homeCollection,
                    insuranceCoverage: test === null || test === void 0 ? void 0 : test.insuranceCoverage,
                    coveredByLifeLine: (test === null || test === void 0 ? void 0 : test.coveredByLifeLine)
                        ? "Supports LifeLine Subscription"
                        : null,
                    description: test === null || test === void 0 ? void 0 : test.description,
                    sampleType: test === null || test === void 0 ? void 0 : test.sampleType,
                    testImage: (TestItem === null || TestItem === void 0 ? void 0 : TestItem.image) || "",
                    clinicImage: (clinic === null || clinic === void 0 ? void 0 : clinic.avatar) || null,
                    clinicName: clinic === null || clinic === void 0 ? void 0 : clinic.clinicName,
                    contractAccepted: clinic.contractAccepted
                        ? "Supports LifeLine Subscription"
                        : null
                };
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test details retrieved successfully for the patient.",
                    data: testDetailsForPatient
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get all tests for a clinic with filtering and search functionality
     */
    static getClinicTests(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinic = yield clinic_model_1.default.findById(clinicId);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const { search, filter, page = "1", limit = "10" } = req.query;
                const pageNumber = Math.max(parseInt(page, 10), 1);
                const limitNumber = Math.max(parseInt(limit, 10), 1);
                // 🔑 Build query: clinic-owned, not deleted
                const query = {
                    clinic: clinic._id,
                    isDeleted: false
                };
                // Optional search filter
                if (typeof search === "string" && search.trim() !== "") {
                    const regex = new RegExp(search, "i");
                    query.testName = { $regex: regex };
                }
                // Optional "lifeline" filter
                if (filter === "lifeline") {
                    query.coveredByLifeLine = true;
                }
                // 🔢 Total clinic tests that match filter
                const totalTests = yield test_model_1.default.countDocuments(query);
                const totalPages = Math.max(Math.ceil(totalTests / limitNumber), 1);
                const safePage = Math.min(pageNumber, totalPages);
                const skip = (safePage - 1) * limitNumber;
                // 🔄 Fetch paginated clinic tests
                const [tests, allCategories] = yield Promise.all([
                    test_model_1.default.find(query)
                        .select("-clinic")
                        .limit(limitNumber)
                        .skip(skip)
                        .sort({ createdAt: -1 }),
                    test_item_model_1.default.find().select("name image")
                ]);
                // 🖼️ Map testImage from categories
                const data = tests.map((test) => {
                    var _a;
                    const testImage = ((_a = allCategories.find((cat) => { var _a; return cat.name.toLowerCase() === ((_a = test === null || test === void 0 ? void 0 : test.testName) === null || _a === void 0 ? void 0 : _a.toLowerCase()); })) === null || _a === void 0 ? void 0 : _a.image) || "";
                    return Object.assign(Object.assign({}, test.toObject()), { testImage });
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic tests retrieved successfully.",
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
    /**
     * Get All Tests from All Clinics
     */
    static getAllTests(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const tests = yield test_model_1.default.find()
                    .select("testName price")
                    .sort({ testName: 1 });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All tests retrieved successfully.",
                    data: tests
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get All Test Names
     */
    static getTestNames(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const testItems = yield test_item_model_1.default
                    .find({ clinic: clinicId })
                    .select("name")
                    .collation({ locale: "en", strength: 2 })
                    .sort({ name: 1 });
                const testNames = testItems.map((cat) => cat.name);
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinic test names retrieved successfully.",
                    data: testNames
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static bulkUploadTests(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                // Validate Clinic and get currency symbol
                const clinic = yield clinic_model_1.default
                    .findById(clinicId)
                    .select("currencySymbol");
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                // Get test categories from DB instead of static testData
                const categories = yield test_item_model_1.default.find().select("name");
                if (!categories.length) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "No test categories available to upload.");
                }
                // Get the last testNo and increment it
                const lastTest = yield test_model_1.default.findOne().sort({ testNo: -1 });
                let lastTestNo = (lastTest === null || lastTest === void 0 ? void 0 : lastTest.testNo) || 999; // Start from 1000 if none
                // Map categories to dynamic test entries
                const tests = categories.map((cat) => {
                    lastTestNo += 1;
                    return {
                        clinic: clinicId,
                        testName: cat.name.toLowerCase(),
                        testNo: lastTestNo,
                        price: Math.floor(Math.random() * 5000) + 1000,
                        currencySymbol: clinic.currencySymbol,
                        sampleType: [
                            "blood",
                            "respiratory",
                            "urine",
                            "stool",
                            "tissue biopsies",
                            "swabs"
                        ][Math.floor(Math.random() * 6)],
                        turnaroundTime: `${Math.floor(Math.random() * 48) + 1} hours`,
                        preTestRequirements: "None specified",
                        homeCollection: "Available",
                        insuranceCoverage: "Covered under LifeLine subscription plans",
                        coveredByLifeLine: Math.random() < 0.5,
                        description: `This is a test description for ${cat.name}.`
                    };
                });
                const insertedTests = yield test_model_1.default.insertMany(tests);
                yield clinic_model_1.default.findByIdAndUpdate(clinicId, {
                    $push: { tests: { $each: insertedTests.map((test) => test._id) } }
                });
                res.status(http_status_1.default.CREATED).json({
                    success: true,
                    message: "Tests uploaded successfully!",
                    data: insertedTests
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get Supported Tests With Clinic Status
     */
    static getSupportedTestsWithStatus(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const clinicTests = yield test_model_1.default.find({
                    clinic: clinicId,
                    isDeleted: false
                })
                    .select("testName _id")
                    .lean();
                const clinicTestMap = {};
                for (const test of clinicTests) {
                    const nameKey = test.testName.trim().toLowerCase();
                    if (!clinicTestMap[nameKey]) {
                        clinicTestMap[nameKey] = test;
                    }
                }
                const data = tests_1.supportedTests
                    .map((testName) => {
                    var _a;
                    const normalized = testName.trim().toLowerCase();
                    const clinicTest = clinicTestMap[normalized];
                    return {
                        name: testName,
                        id: (_a = clinicTest === null || clinicTest === void 0 ? void 0 : clinicTest._id) !== null && _a !== void 0 ? _a : null,
                        hasTest: !!clinicTest
                    };
                })
                    .sort((a, b) => a.name.localeCompare(b.name));
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Supported tests with clinic availability retrieved successfully.",
                    data
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get all available tests
     */
    static patientGetAllTests(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { location, insurance, coveredByLifeLine, deliveryMethod, languages } = req.query;
                const patientId = (0, utils_1.getPatientId)(req);
                const patient = yield patient_model_1.default.findById(patientId).select("email");
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const clinicQuery = {
                    status: "approved"
                };
                if (location) {
                    const locationRegex = new RegExp(location.toLowerCase(), "i");
                    clinicQuery.$or = [
                        { "location.stateOrProvince": { $regex: locationRegex } },
                        { "location.cityOrDistrict": { $regex: locationRegex } },
                        { "location.street": { $regex: locationRegex } }
                    ];
                }
                if (insurance) {
                    clinicQuery.supportInsurance = { $in: [Number(insurance)] };
                }
                if (deliveryMethod !== undefined) {
                    clinicQuery.deliveryMethods = { $in: [Number(deliveryMethod)] };
                }
                if (languages) {
                    const lang = languages.toLowerCase().trim();
                    clinicQuery.languages = { $in: [lang] };
                }
                let clinics = yield clinic_model_1.default
                    .find(clinicQuery)
                    .select("_id email")
                    .sort({ createdAt: -1 });
                const allowedPatientEmail = "sannifortune11@gmail.com";
                const restrictedClinicEmail = "damilolasanni48@gmail.com";
                if (patient.email !== allowedPatientEmail) {
                    clinics = clinics.filter((clinic) => clinic.email !== restrictedClinicEmail);
                }
                if (!clinics.length) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "No clinics found matching the criteria.");
                }
                const clinicIds = clinics.map((clinic) => clinic._id);
                const testQuery = { clinic: { $in: clinicIds } };
                if (coveredByLifeLine !== undefined) {
                    testQuery.coveredByLifeLine = coveredByLifeLine === "true";
                }
                const [tests, allCategories] = yield Promise.all([
                    test_model_1.default.find(testQuery)
                        .select("testName clinic price currencySymbol coveredByLifeLine")
                        .sort({ testName: 1 }),
                    test_item_model_1.default.find().select("name icon")
                ]);
                const data = tests.map((test) => {
                    var _a;
                    const testIcon = ((_a = allCategories.find((cat) => { var _a, _b; return ((_a = cat === null || cat === void 0 ? void 0 : cat.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === ((_b = test === null || test === void 0 ? void 0 : test.testName) === null || _b === void 0 ? void 0 : _b.toLowerCase()); })) === null || _a === void 0 ? void 0 : _a.icon) || "";
                    return Object.assign(Object.assign({}, test.toObject()), { testIcon, coveredByLifeLine: test.coveredByLifeLine
                            ? "Supports LifeLine Subscription"
                            : null });
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "All tests retrieved successfully.",
                    data
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Get all clinics that offer the same test as the given test ID
     */
    static getClinicsWithSameTest(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { testId } = req.params;
                const patientId = (0, utils_1.getPatientId)(req);
                if (!mongoose_1.default.Types.ObjectId.isValid(testId)) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Invalid test ID format.");
                }
                const patient = yield patient_model_1.default
                    .findById(patientId)
                    .select("country email");
                if (!patient) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Patient not found.");
                }
                const originalTest = yield test_model_1.default.findById(testId).select("testName clinic");
                if (!originalTest) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found.");
                }
                const originalClinic = yield clinic_model_1.default.findById(originalTest.clinic);
                if (!originalClinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
                }
                const matchingTests = yield test_model_1.default.find({
                    testName: {
                        $regex: new RegExp(`^${originalTest.testName}$`, "i")
                    },
                    isDeleted: false,
                    clinic: { $ne: originalTest.clinic }
                }).select("clinic price");
                const clinicPriceMap = new Map();
                const clinicIds = [];
                matchingTests.forEach((test) => {
                    if (!clinicPriceMap.has(test.clinic.toString())) {
                        clinicPriceMap.set(test.clinic.toString(), test.price);
                        clinicIds.push(test.clinic);
                    }
                });
                let clinics = yield clinic_model_1.default
                    .find({
                    _id: { $in: clinicIds },
                    isDeleted: false,
                    status: "approved",
                    country: patient.country.toLowerCase()
                })
                    .select("clinicName location price country avatar currencySymbol email");
                const allowedPatientEmail = "sannifortune11@gmail.com";
                const restrictedClinicEmail = "damilolasanni48@gmail.com";
                if ((patient === null || patient === void 0 ? void 0 : patient.email) !== allowedPatientEmail) {
                    clinics = clinics.filter((clinic) => clinic.email !== restrictedClinicEmail);
                }
                const formattedClinics = clinics.map((clinic) => {
                    var _a;
                    return ({
                        id: clinic._id,
                        clinicName: clinic.clinicName,
                        location: (_a = clinic.location) === null || _a === void 0 ? void 0 : _a.street,
                        country: clinic.country,
                        avatar: clinic.avatar,
                        currencySymbol: clinic.currencySymbol,
                        price: clinicPriceMap.get(clinic._id.toString()) || 0
                    });
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Clinics offering the same test retrieved successfully.",
                    data: formattedClinics
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
    /**
     * Soft remove a test (mark as deleted, do not remove from DB)
     */
    static removeTest(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const { id } = req.params;
                const test = yield test_model_1.default.findOne({
                    _id: id,
                    clinic: clinicId
                });
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test not found for this clinic");
                }
                if (test.isDeleted) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "Test is already removed");
                }
                test.isDeleted = true;
                yield test.save();
                yield clinic_model_1.default.findByIdAndUpdate(clinicId, {
                    $pull: { tests: test._id }
                });
                yield testBooking_model_1.default.deleteMany({
                    test: test._id,
                    status: "pending"
                });
                __1.io.emit("test:remove", {
                    clinicId,
                    testId: test._id
                });
                res.status(http_status_1.default.OK).json({
                    success: true,
                    message: "Test removed successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Clinic update a test item
     */
    static clinicUpdateTestItem(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { name, image, icon } = req.body;
                const clinicId = (0, utils_1.getClinicId)(req);
                if (!name && !image && !icon) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "No fields provided to update.");
                }
                const test = yield test_item_model_1.default.findOne({ _id: id, clinic: clinicId });
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test item not found for this clinic.");
                }
                const testInUse = yield test_model_1.default.exists({
                    clinic: clinicId,
                    testName: new RegExp(`^${test.name}$`, "i")
                });
                if (name && name.toLowerCase() !== test.name.toLowerCase()) {
                    const existing = yield test_item_model_1.default.findOne({
                        name: new RegExp(`^${name}$`, "i"),
                        _id: { $ne: id },
                        clinic: clinicId
                    });
                    if (existing) {
                        throw new app_error_1.default(http_status_1.default.CONFLICT, "A test item with this name already exists for this clinic.");
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
                    message: testInUse
                        ? "Test item updated successfully (note: this item is already in use by your tests)."
                        : "Test item updated successfully."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * Clinic delete a test item
     */
    static clinicDeleteTestItem(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const clinicId = (0, utils_1.getClinicId)(req);
                const test = yield test_item_model_1.default.findOne({ _id: id, clinic: clinicId });
                if (!test) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Test item not found for this clinic.");
                }
                const testInUse = yield test_model_1.default.exists({
                    clinic: clinicId,
                    testName: new RegExp(`^${test.name}$`, "i")
                });
                if (testInUse) {
                    throw new app_error_1.default(http_status_1.default.BAD_REQUEST, "This test item is already in use. Please update it instead of deleting.");
                }
                yield test.deleteOne();
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
    static getAllClinicTestItems(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clinicId = (0, utils_1.getClinicId)(req);
                const tests = yield test_item_model_1.default
                    .find({ clinic: clinicId })
                    .collation({ locale: "en", strength: 2 })
                    .sort({ name: 1 });
                res.status(200).json({
                    success: true,
                    message: "Clinic test items retrieved successfully.",
                    data: tests
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = TestController;
