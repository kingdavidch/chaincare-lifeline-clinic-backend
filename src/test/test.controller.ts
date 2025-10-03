/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express"
import TestModel from "./test.model"
import {
  escapeRegex,
  getClinicId,
  getPatientId,
  handleRequiredFields
} from "../utils"
import clinicModel from "../clinic/clinic.model"
import httpStatus from "http-status"
import AppError from "../utils/app.error"
import mongoose from "mongoose"
import patientModel from "../patient/patient.model"
import testItem from "./test.item.model"
import { io } from ".."
import { supportedTests } from "../constant/tests"
import axios from "axios"
import base64 from "base-64"
import "dotenv/config"
import testBookingModel from "../testBooking(Cart)/testBooking.model"

export default class TestController {
  /**
   * Create a new test under a clinic
   */
  public static async createTest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      handleRequiredFields(req, [
        "testName",
        "price",
        "turnaroundTime",
        "homeCollection",
        "insuranceCoverage",
        "sampleType"
      ])

      const clinic = await clinicModel
        .findById(clinicId)
        .select("currencySymbol")
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found")
      }

      const {
        testName,
        price,
        turnaroundTime,
        preTestRequirements,
        homeCollection,
        insuranceCoverage,
        description,
        sampleType
      } = req.body

      const testNameLower = testName?.toLowerCase()

      const existingTestItem = await testItem.findOne({
        clinic: clinicId,
        name: { $regex: new RegExp(`^${escapeRegex(testNameLower)}$`, "i") }
      })

      if (!existingTestItem) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Invalid test name. The test must exist in the test categories."
        )
      }

      const validSampleTypes = [
        "blood",
        "respiratory",
        "urine",
        "stool",
        "tissue biopsies",
        "swabs",
        "no sample required"
      ]

      if (!validSampleTypes.includes(sampleType?.toLowerCase())) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Invalid sample type. Please choose from the predefined list."
        )
      }

      const newTest = await TestModel.create({
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
      })

      await clinicModel.findByIdAndUpdate(clinicId, {
        $push: { tests: newTest._id }
      })

      const testImage = existingTestItem?.image || ""

      io.emit("test:create", {
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
      })

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Test created successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Create a new test TestItem (from clinic)
   */
  public static async addTestItemByClinic(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const clinicId = getClinicId(req)

      handleRequiredFields(req, ["name"])

      const { name, image, icon } = req.body

      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found")
      }

      const nameLower = name?.toLowerCase()

      const existing = await testItem.findOne({
        clinic: clinicId,
        name: { $regex: new RegExp(`^${escapeRegex(nameLower)}$`, "i") }
      })

      if (existing) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This TestItem already exists for your clinic."
        )
      }

      await testItem.create({
        clinic: clinicId,
        name,
        image,
        icon
      })

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "TestItem added successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get details of a specific test
   */
  public static async getTestDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      // Ensure clinic exists
      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      const { id } = req.params

      const test = await TestModel.findOne({
        _id: id,
        clinic: clinic._id
      }).select("-clinic")

      if (!test) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found.")
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test details retrieved successfully.",
        data: test
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Clinic Updates a Test
   */
  public static async updateTest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      const { id } = req.params
      const updates = req.body

      if (updates?.testName) {
        const testNameLower = updates.testName.toLowerCase()

        const existingTestItem = await testItem.findOne({
          clinic: clinicId,
          name: { $regex: new RegExp(`^${escapeRegex(testNameLower)}$`, "i") }
        })

        if (!existingTestItem) {
          throw new AppError(httpStatus.BAD_REQUEST, "Invalid test name.")
        }

        updates.testItem = existingTestItem._id
      }

      const updatedTest = await TestModel.findByIdAndUpdate(id, updates, {
        new: true
      })

      if (!updatedTest) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found.")
      }

      const clinicData = await clinicModel
        .findById(updatedTest.clinic)
        .select("avatar clinicName contractAccepted country")

      const testItemData = await testItem.findById(updatedTest.testItem)

      const testImage = testItemData?.image || ""

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
        clinicImage: clinicData?.avatar,
        clinicName: clinicData?.clinicName,
        contractAccepted: clinicData?.contractAccepted
          ? "Supports LifeLine Subscription"
          : null
      }

      io.emit("test:update", {
        clinicId,
        testId: updatedTest._id,
        details: fullTestDetails
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get details of a specific test (Patient)
   */
  public static async getTestDetailForPatient(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params
      const patientId = getPatientId(req)

      const patient = await patientModel.findById(patientId).select("country")
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const test = await TestModel.findById(id).select(
        "testName sampleType price currencySymbol turnaroundTime preTestRequirements clinic homeCollection insuranceCoverage coveredByLifeLine description"
      )

      if (!test) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found.")
      }

      const clinic = await clinicModel
        .findById(test.clinic)
        .select("avatar clinicName country contractAccepted")

      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      if (clinic.country.toLowerCase() !== patient.country.toLowerCase()) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "This test is not available in your country."
        )
      }

      // 🔍 Get test image from TestItem
      const TestItem = await testItem.findOne({
        name: { $regex: new RegExp(`^${test.testName}$`, "i") }
      })

      const testDetailsForPatient = {
        _id: test?._id,
        clinicId: test?.clinic,
        testName: test?.testName,
        price: test?.price,
        currencySymbol: test?.currencySymbol,
        turnaroundTime: test?.turnaroundTime,
        preTestRequirements: test?.preTestRequirements,
        homeCollection: test?.homeCollection,
        insuranceCoverage: test?.insuranceCoverage,
        coveredByLifeLine: test?.coveredByLifeLine
          ? "Supports LifeLine Subscription"
          : null,
        description: test?.description,
        sampleType: test?.sampleType,
        testImage: TestItem?.image || "",
        clinicImage: clinic?.avatar || null,
        clinicName: clinic?.clinicName,
        contractAccepted: clinic.contractAccepted
          ? "Supports LifeLine Subscription"
          : null
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test details retrieved successfully for the patient.",
        data: testDetailsForPatient
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all tests for a clinic with filtering and search functionality
   */
  public static async getClinicTests(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      const { search, filter, page = "1", limit = "10" } = req.query

      const pageNumber = Math.max(parseInt(page as string, 10), 1)
      const limitNumber = Math.max(parseInt(limit as string, 10), 1)

      // 🔑 Build query: clinic-owned, not deleted
      const query: Record<string, any> = {
        clinic: clinic._id,
        isDeleted: false
      }

      // Optional search filter
      if (typeof search === "string" && search.trim() !== "") {
        const regex = new RegExp(search, "i")
        query.testName = { $regex: regex }
      }

      // Optional "lifeline" filter
      if (filter === "lifeline") {
        query.coveredByLifeLine = true
      }

      // 🔢 Total clinic tests that match filter
      const totalTests = await TestModel.countDocuments(query)
      const totalPages = Math.max(Math.ceil(totalTests / limitNumber), 1)
      const safePage = Math.min(pageNumber, totalPages)
      const skip = (safePage - 1) * limitNumber

      // 🔄 Fetch paginated clinic tests
      const [tests, allCategories] = await Promise.all([
        TestModel.find(query)
          .select("-clinic")
          .limit(limitNumber)
          .skip(skip)
          .sort({ createdAt: -1 }),
        testItem.find().select("name image")
      ])

      // 🖼️ Map testImage from categories
      const data = tests.map((test) => {
        const testImage =
          allCategories.find(
            (cat) => cat.name.toLowerCase() === test?.testName?.toLowerCase()
          )?.image || ""

        return {
          ...test.toObject(),
          testImage
        }
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic tests retrieved successfully.",
        data,
        pagination: {
          totalTests,
          totalPages,
          currentPage: safePage,
          limit: limitNumber
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get All Tests from All Clinics
   */
  public static async getAllTests(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tests = await TestModel.find()
        .select("testName price")
        .sort({ testName: 1 })

      res.status(httpStatus.OK).json({
        success: true,
        message: "All tests retrieved successfully.",
        data: tests
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get All Test Names
   */
  public static async getTestNames(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const clinicId = getClinicId(req)

      const testItems = await testItem
        .find({ clinic: clinicId })
        .select("name")
        .collation({ locale: "en", strength: 2 })
        .sort({ name: 1 })

      const testNames = testItems.map((cat) => cat.name)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic test names retrieved successfully.",
        data: testNames
      })
    } catch (error) {
      next(error)
    }
  }

  public static async bulkUploadTests(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      // Validate Clinic and get currency symbol
      const clinic = await clinicModel
        .findById(clinicId)
        .select("currencySymbol")
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      // Get test categories from DB instead of static testData
      const categories = await testItem.find().select("name")

      if (!categories.length) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "No test categories available to upload."
        )
      }

      // Get the last testNo and increment it
      const lastTest = await TestModel.findOne().sort({ testNo: -1 })
      let lastTestNo = lastTest?.testNo || 999 // Start from 1000 if none

      // Map categories to dynamic test entries
      const tests = categories.map((cat) => {
        lastTestNo += 1

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
        }
      })

      const insertedTests = await TestModel.insertMany(tests)

      await clinicModel.findByIdAndUpdate(clinicId, {
        $push: { tests: { $each: insertedTests.map((test) => test._id) } }
      })

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Tests uploaded successfully!",
        data: insertedTests
      })
    } catch (error) {
      next(error)
    }
  }

  public static async clearAllTests(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      // Validate Clinic
      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      // Delete all tests associated with the clinic
      await TestModel.deleteMany({ clinic: clinicId })

      // Remove test references from the clinic model
      await clinicModel.findByIdAndUpdate(clinicId, { $set: { tests: [] } })

      res.status(httpStatus.OK).json({
        success: true,
        message: "All tests have been cleared successfully!"
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get Supported Tests With Clinic Status
   */
  public static async getSupportedTestsWithStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const clinicId = getClinicId(req)

      const clinicTests = await TestModel.find({
        clinic: clinicId,
        isDeleted: false
      })
        .select("testName _id")
        .lean()

      const clinicTestMap: Record<string, any> = {}
      for (const test of clinicTests) {
        const nameKey = test.testName.trim().toLowerCase()
        if (!clinicTestMap[nameKey]) {
          clinicTestMap[nameKey] = test
        }
      }

      const data = supportedTests
        .map((testName) => {
          const normalized = testName.trim().toLowerCase()
          const clinicTest = clinicTestMap[normalized]

          return {
            name: testName,
            id: clinicTest?._id ?? null,
            hasTest: !!clinicTest
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      res.status(httpStatus.OK).json({
        success: true,
        message:
          "Supported tests with clinic availability retrieved successfully.",
        data
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all available tests
   */
  public static async patientGetAllTests(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { location, insurance, coveredByLifeLine } = req.query
      const patientId = getPatientId(req)

      const patient = await patientModel
        .findById(patientId)
        .select("country email")
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const clinicQuery: any = {
        country: patient.country.toLowerCase(),
        status: "approved"
      }

      if (location) {
        const locationRegex = new RegExp(
          (location as string).toLowerCase(),
          "i"
        )
        clinicQuery.$or = [
          { "location.stateOrProvince": { $regex: locationRegex } },
          { "location.cityOrDistrict": { $regex: locationRegex } },
          { "location.street": { $regex: locationRegex } }
        ]
      }

      if (insurance) {
        clinicQuery.supportInsurance = { $in: [Number(insurance)] }
      }

      let clinics = await clinicModel
        .find(clinicQuery)
        .select("_id email")
        .sort({ createdAt: -1 })

      const allowedPatientEmail = "sannifortune11@gmail.com"
      const restrictedClinicEmail = "damilolasanni48@gmail.com"

      if (patient.email !== allowedPatientEmail) {
        clinics = clinics.filter(
          (clinic) => clinic.email !== restrictedClinicEmail
        )
      }

      if (!clinics.length) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "No clinics found matching the criteria."
        )
      }

      const clinicIds = clinics.map((clinic) => clinic._id)

      const testQuery: any = { clinic: { $in: clinicIds } }

      if (coveredByLifeLine !== undefined) {
        testQuery.coveredByLifeLine = coveredByLifeLine === "true"
      }

      const [tests, allCategories] = await Promise.all([
        TestModel.find(testQuery)
          .select("testName clinic price currencySymbol coveredByLifeLine")
          .sort({ testName: 1 }),
        testItem.find().select("name icon")
      ])

      const data = tests.map((test) => {
        const testIcon =
          allCategories.find(
            (cat) => cat?.name?.toLowerCase() === test?.testName?.toLowerCase()
          )?.icon || ""

        return {
          ...test.toObject(),
          testIcon,
          coveredByLifeLine: test.coveredByLifeLine
            ? "Supports LifeLine Subscription"
            : null
        }
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "All tests retrieved successfully.",
        data
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all clinics that offer the same test as the given test ID
   */
  public static async getClinicsWithSameTest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { testId } = req.params
      const patientId = getPatientId(req)

      if (!mongoose.Types.ObjectId.isValid(testId)) {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid test ID format.")
      }

      const patient = await patientModel
        .findById(patientId)
        .select("country email")
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const originalTest =
        await TestModel.findById(testId).select("testName clinic")
      if (!originalTest) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found.")
      }

      const originalClinic = await clinicModel
        .findById(originalTest.clinic)
        .select("country")
      if (!originalClinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      if (
        originalClinic.country.toLowerCase() !== patient.country.toLowerCase()
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "This test is not available in your country."
        )
      }

      const matchingTests = await TestModel.find({
        testName: {
          $regex: new RegExp(`^${originalTest.testName}$`, "i")
        },
        isDeleted: false,
        clinic: { $ne: originalTest.clinic }
      }).select("clinic price")

      const clinicPriceMap = new Map<string, number>()
      const clinicIds: mongoose.Types.ObjectId[] = []

      matchingTests.forEach((test) => {
        if (!clinicPriceMap.has(test.clinic.toString())) {
          clinicPriceMap.set(test.clinic.toString(), test.price)
          clinicIds.push(test.clinic)
        }
      })

      let clinics = await clinicModel
        .find({
          _id: { $in: clinicIds },
          isDeleted: false,
          status: "approved",
          country: patient.country.toLowerCase()
        })
        .select("clinicName location price country avatar currencySymbol email")

      const allowedPatientEmail = "sannifortune11@gmail.com"
      const restrictedClinicEmail = "damilolasanni48@gmail.com"

      if (patient?.email !== allowedPatientEmail) {
        clinics = clinics.filter(
          (clinic) => clinic.email !== restrictedClinicEmail
        )
      }

      const formattedClinics = clinics.map((clinic) => ({
        id: clinic._id,
        clinicName: clinic.clinicName,
        location: clinic.location?.street,
        country: clinic.country,
        avatar: clinic.avatar,
        currencySymbol: clinic.currencySymbol,
        price: clinicPriceMap.get(clinic._id.toString()) || 0
      }))

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinics offering the same test retrieved successfully.",
        data: formattedClinics
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getCloudinaryImages(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
      const API_KEY = process.env.CLOUDINARY_API_KEY
      const API_SECRET = process.env.CLOUDINARY_API_SECRET

      const auth = base64.encode(`${API_KEY}:${API_SECRET}`)

      const cloudinaryRes = await axios.get(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image`,
        {
          params: {
            type: "upload",
            max_results: 100
          },
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      )

      const icons = []
      const images = []

      for (const img of cloudinaryRes.data.resources) {
        const imageData = {
          public_id: img.public_id,
          secure_url: img.secure_url,
          format: img.format,
          width: img.width,
          height: img.height
        }

        if (img.asset_folder === "tests_icons") {
          icons.push(imageData)
        } else if (img.asset_folder === "tests_images") {
          images.push(imageData)
        }
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Cloudinary images retrieved successfully.",
        data: {
          icons,
          images
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Soft remove a test (mark as deleted, do not remove from DB)
   */
  public static async removeTest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const { id } = req.params

      const test = await TestModel.findOne({
        _id: id,
        clinic: clinicId
      })

      if (!test) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "Test not found for this clinic"
        )
      }

      if (test.isDeleted) {
        throw new AppError(httpStatus.BAD_REQUEST, "Test is already removed")
      }

      test.isDeleted = true
      await test.save()

      await clinicModel.findByIdAndUpdate(clinicId, {
        $pull: { tests: test._id }
      })

      await testBookingModel.deleteMany({
        test: test._id,
        status: "pending"
      })

      io.emit("test:remove", {
        clinicId,
        testId: test._id
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test removed successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Clinic update a test item
   */
  public static async clinicUpdateTestItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params
      const { name, image, icon } = req.body
      const clinicId = getClinicId(req)

      if (!name && !image && !icon) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "No fields provided to update."
        )
      }

      const test = await testItem.findOne({ _id: id, clinic: clinicId })
      if (!test) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "Test item not found for this clinic."
        )
      }

      const testInUse = await TestModel.exists({
        clinic: clinicId,
        testName: new RegExp(`^${test.name}$`, "i")
      })

      if (name && name.toLowerCase() !== test.name.toLowerCase()) {
        const existing = await testItem.findOne({
          name: new RegExp(`^${name}$`, "i"),
          _id: { $ne: id },
          clinic: clinicId
        })
        if (existing) {
          throw new AppError(
            httpStatus.CONFLICT,
            "A test item with this name already exists for this clinic."
          )
        }
        test.name = name
      }

      if (image) test.image = image
      if (icon) test.icon = icon

      await test.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: testInUse
          ? "Test item updated successfully (note: this item is already in use by your tests)."
          : "Test item updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Clinic delete a test item
   */
  public static async clinicDeleteTestItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params
      const clinicId = getClinicId(req)

      const test = await testItem.findOne({ _id: id, clinic: clinicId })
      if (!test) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "Test item not found for this clinic."
        )
      }

      const testInUse = await TestModel.exists({
        clinic: clinicId,
        testName: new RegExp(`^${test.name}$`, "i")
      })

      if (testInUse) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "This test item is already in use. Please update it instead of deleting."
        )
      }

      await test.deleteOne()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test item deleted successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getAllClinicTestItems(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const tests = await testItem
        .find({ clinic: clinicId })
        .collation({ locale: "en", strength: 2 })
        .sort({ name: 1 })

      res.status(200).json({
        success: true,
        message: "Clinic test items retrieved successfully.",
        data: tests
      })
    } catch (error) {
      next(error)
    }
  }
}
