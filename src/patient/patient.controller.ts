/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"
import { addMinutes, isAfter } from "date-fns"
import { NextFunction, Request, Response } from "express"
import httpStatus from "http-status"
import jwt from "jsonwebtoken"
import ClinicModel from "../clinic/clinic.model"
import { SUPPORTED_INSURANCE_PROVIDERS } from "../constant/supported.insurance"
import discountModel from "../discount/discount.model"
import orderModel from "../order/order.model"
import reviewModel from "../review/review.model"
import PatientEmailService from "../smtp/patient/smtp.patient.service"
import testItem from "../test/test.item.model"
import testModel from "../test/test.model"
import {
  generateEmailOTP,
  getPatientId,
  handleRequiredFields,
  uploadToCloudinary
} from "../utils"
import AppError from "../utils/app.error"
import { comparePasswords, hashPassword } from "../utils/password.utils"
import patientModel from "./patient.model"
import patientNotificationModel from "./patient.notification.model"
import { IAddress } from "./patient.types"

const JWT_SECRET = process.env.JWT_SECRET as string
interface FormattedClinic {
  id: string
  clinicName: string
  location: IAddress
  avatar?: string
  rating: number
}

export default class PatientController {
  /**
   * Patient Signup
   */
  public static async signUp(req: Request, res: Response, next: NextFunction) {
    try {
      handleRequiredFields(req, [
        "fullName",
        "phoneNumber",
        "email",
        "password",
        "country",
        "termsAccepted"
      ])

      const { fullName, phoneNumber, email, password, country, termsAccepted } =
        req.body

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Please provide a valid email address."
        )
      }

      const [
        existingPatientByEmail,
        existingClinicByEmail,
        existingPhone,
        existingClinicPhone
      ] = await Promise.all([
        patientModel.findOne({ email }).lean(),
        ClinicModel.findOne({ email }).lean(),
        patientModel.findOne({ phoneNumber }).lean(),
        ClinicModel.findOne({ phoneNumber }).lean()
      ])

      if (existingPatientByEmail || existingClinicByEmail) {
        throw new AppError(
          httpStatus.CONFLICT,
          "An account with this email already exists."
        )
      }

      if (existingPhone || existingClinicPhone) {
        throw new AppError(
          httpStatus.CONFLICT,
          "Phone number is already in use."
        )
      }

      if (!termsAccepted) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "You must accept the terms and policies."
        )
      }

      const hashedPassword = await hashPassword(password)
      const otp = generateEmailOTP()
      const otpExpiresAt = addMinutes(new Date(), 5)

      const newPatient = new patientModel({
        fullName,
        phoneNumber,
        email,
        password: hashedPassword,
        country,
        emailOtp: otp,
        emailOtpExpiresAt: otpExpiresAt,
        termsAccepted
      })

      await Promise.all([
        newPatient.save(),
        PatientEmailService.sendVerificationEmail(newPatient)
          .then(() => console.log("Verification email sent to:", email))
          .catch((err) =>
            console.error("Verification email failed:", email, err)
          ),
        PatientEmailService.sendWelcomeEmail(newPatient)
          .then(() => console.log("Welcome email sent to:", email))
          .catch((err) => console.error("Welcome email failed:", email, err))
      ])

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Signup successful. Please verify your email.",
        data: {
          email: newPatient.email,
          fullName: newPatient.fullName
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Patient Login
   */
  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      handleRequiredFields(req, ["email", "password"])

      const email = req.body.email.trim().toLowerCase()
      const password = req.body.password

      const patient = await patientModel.findOne({ email })

      if (!patient) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Invalid email or password."
        )
      }

      if (!patient.isVerified) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Your account is not verified. Please verify your email before logging in."
        )
      }

      const isPasswordValid = await comparePasswords(password, patient.password)
      if (!isPasswordValid) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Invalid email or password."
        )
      }

      const token = jwt.sign({ id: patient.id }, JWT_SECRET)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Login successful.",
        data: {
          token,
          fullName: patient.fullName,
          email: patient.email
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Google Login
   */
  public static async googleLogin(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { idToken, phoneNumber, country } = req.body

      if (!idToken) {
        throw new AppError(httpStatus.BAD_REQUEST, "Missing Google ID token.")
      }

      const googleRes = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
      )

      const {
        sub: googleId,
        email,
        name: fullName,
        picture: avatar
      } = googleRes.data

      if (!email || !googleId) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Invalid or expired Google token."
        )
      }

      let patient = await patientModel.findOne({ googleId })

      if (!patient) {
        patient = await patientModel.findOne({ email })

        if (patient && !patient.googleId) {
          patient.googleId = googleId
          patient.loginProvider = "google"
          patient.avatar ||= avatar
          await patient.save()
        }
      }

      if (!patient) {
        if (!phoneNumber || !country) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            "Missing phone number or country for new Google user."
          )
        }

        const existingPatientByEmail = await patientModel.findOne({ email })
        const existingClinicByEmail = await ClinicModel.findOne({ email })
        if (existingPatientByEmail || existingClinicByEmail) {
          throw new AppError(
            httpStatus.CONFLICT,
            "An account with this email already exists."
          )
        }

        const existingPhone = await patientModel.findOne({ phoneNumber })
        const existingClinicPhone = await ClinicModel.findOne({ phoneNumber })
        if (existingPhone || existingClinicPhone) {
          throw new AppError(
            httpStatus.CONFLICT,
            "Phone number is already in use."
          )
        }

        patient = await patientModel.create({
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
        })
      }

      const token = jwt.sign({ id: patient.id }, JWT_SECRET)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Login successful via Google.",
        data: {
          token,
          fullName: patient.fullName,
          email: patient.email
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Verify Email OTP
   */
  public static async verifyEmailOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      handleRequiredFields(req, ["email", "otp"])

      const { email, otp } = req.body
      const patient = await patientModel.findOne({ email, emailOtp: otp })

      if (!patient) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or OTP.")
      }

      if (isAfter(new Date(), patient.emailOtpExpiresAt!)) {
        throw new AppError(httpStatus.UNAUTHORIZED, "OTP has expired.")
      }

      patient.emailOtp = undefined
      patient.emailOtpExpiresAt = undefined
      patient.isVerified = true
      await patient.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Email OTP verified successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Resend OTP
   */
  public static async resendOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      handleRequiredFields(req, ["email"])

      const { email } = req.body
      const patient = await patientModel.findOne({ email })

      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Account not found.")
      }

      const otp = generateEmailOTP()
      const otpExpiresAt = addMinutes(new Date(), 5)

      patient.emailOtp = otp
      patient.emailOtpExpiresAt = otpExpiresAt
      await patient.save()

      await PatientEmailService.sendVerificationEmail(patient)
        .then(() => {
          console.log("Verification email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending verification email:", error)
        })

      res.status(httpStatus.OK).json({
        success: true,
        message: "OTP has been resent successfully. Please check your email."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Request Password Reset
   */
  public static async requestPasswordReset(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      handleRequiredFields(req, ["email"])

      const { email } = req.body
      const patient = await patientModel.findOne({ email })

      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Account not found.")
      }

      const otp = generateEmailOTP()
      const otpExpiresAt = addMinutes(new Date(), 5)

      patient.emailOtp = otp
      patient.emailOtpExpiresAt = otpExpiresAt
      await patient.save()

      await PatientEmailService.sendPasswordResetOtp(patient)
        .then(() => {
          console.log("email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending email:", error)
        })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Password reset OTP sent to your email."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Reset Password
   */
  public static async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      handleRequiredFields(req, ["email", "newPassword", "confirmPassword"])

      const { email, newPassword, confirmPassword } = req.body

      if (newPassword !== confirmPassword) {
        throw new AppError(httpStatus.BAD_REQUEST, "Passwords do not match.")
      }

      const patient = await patientModel.findOne({ email })

      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Account not found.")
      }

      const hashedPassword = await hashPassword(newPassword)

      patient.password = hashedPassword
      await patient.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Password reset successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get Patient Profile
   */
  public static async getPatientProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      // Fetch the patient details, excluding sensitive fields
      const patient = await patientModel
        .findById(patientId)
        .select(
          "-password -resetPasswordToken -resetPasswordExpires -emailOtp -emailOtpExpiresAt"
        )

      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Patient profile retrieved successfully.",
        data: patient
      })
    } catch (error) {
      next(error)
    }
  }

  public static async deletePatient(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { email } = req.body

      if (!email || typeof email !== "string") {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid email address.")
      }

      const patient = await patientModel.findOne({ email })
      if (!patient) {
        throw new AppError(
          httpStatus.CONFLICT,
          `No patient found with email: ${email}`
        )
      }

      await patientModel.deleteOne({ email })

      return res
        .status(httpStatus.OK)
        .json({ message: `Patient with email: ${email} has been deleted.` })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update Patient Profile
   */
  public static async updatePatientProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      const {
        fullName,
        phoneNumber,
        email,
        stateOrProvince,
        cityOrDistrict,
        street,
        postalCode,
        coordinates,
        password,
        country,
        dob,
        idNumber,
        idType
      } = req.body

      const patient = await patientModel.findById(patientId)
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      // Check if the email already exists in either patients or clinics
      if (email) {
        const existingPatientByEmail = await patientModel.findOne({ email })
        const existingClinicByEmail = await ClinicModel.findOne({ email })

        if (existingPatientByEmail || existingClinicByEmail) {
          throw new AppError(httpStatus.CONFLICT, "Email is already in use.")
        }
      }

      if (password) {
        if (password.length < 8) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            "Password must be at least 8 characters long."
          )
        }
        const hashedPassword = await hashPassword(password)
        patient.password = hashedPassword
      }

      if (phoneNumber) {
        const existingPhone = await patientModel.findOne({ phoneNumber })
        const existingClinicPhone = await ClinicModel.findOne({ phoneNumber })

        if (existingPhone || existingClinicPhone) {
          throw new AppError(
            httpStatus.CONFLICT,
            "Phone number is already in use."
          )
        }
      }

      // Upload avatar if provided
      let avatarUrl = patient.avatar
      if (req.file) {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          "image",
          `patient_avatars/${req.file.originalname}`
        )
        avatarUrl = uploadResult.secure_url
      }

      if (!patient.location) {
        patient.location = {
          stateOrProvince: "",
          cityOrDistrict: "",
          street: "",
          postalCode: "",
          coordinates: { latitude: 0, longitude: 0 }
        }
      }

      if (stateOrProvince) {
        patient.location.stateOrProvince = stateOrProvince
      }
      if (cityOrDistrict) {
        patient.location.cityOrDistrict = cityOrDistrict
      }
      if (street) {
        patient.location.street = street
      }
      if (postalCode) {
        patient.location.postalCode = postalCode
      }
      if (coordinates) {
        patient.location.coordinates = {
          latitude: coordinates.latitude ?? null,
          longitude: coordinates.longitude ?? null
        }
      }

      patient.fullName = fullName || patient.fullName
      patient.phoneNumber = phoneNumber || patient.phoneNumber
      patient.email = email || patient.email
      patient.avatar = avatarUrl
      patient.country = country || patient.country
      patient.dob = dob || patient.dob
      patient.idNumber = idNumber || patient.idNumber
      patient.idType = idType || patient.idType

      await patient.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Profile updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Add Insurance to Patient Profile
   */
  public static async addInsurance(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const {
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
      } = req.body

      const patient = await patientModel.findById(patientId)
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const existingInsurance = patient.insurance.find(
        (ins) => ins.insuranceId === insuranceId
      )
      if (existingInsurance) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This insurance is already added to your profile."
        )
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
      })

      await patient.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Insurance added successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update an existing insurance entry
   */
  public static async updateInsurance(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { insuranceId } = req.params
      const updates = req.body

      const patient = await patientModel.findById(patientId)
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      // Check if insurance exists before updating
      const insuranceIndex = patient.insurance.findIndex(
        (ins) => ins.insuranceId === parseInt(insuranceId)
      )
      if (insuranceIndex === -1) {
        throw new AppError(httpStatus.NOT_FOUND, "Insurance entry not found.")
      }

      // Ensure no duplicate insurance entry
      if (
        updates.insuranceId &&
        updates.insuranceId !== parseInt(insuranceId)
      ) {
        if (
          patient.insurance.some(
            (ins) => ins.insuranceId === updates.insuranceId
          )
        ) {
          throw new AppError(
            httpStatus.CONFLICT,
            "This updated insurance already exists."
          )
        }
      }

      Object.assign(patient.insurance[insuranceIndex], updates)
      await patient.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Insurance updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete an insurance entry
   */
  public static async deleteInsurance(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { insuranceId } = req.params

      const patient = await patientModel.findById(patientId)
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      // Filter out the insurance entry
      const initialLength = patient.insurance.length
      patient.insurance = patient.insurance.filter(
        (ins) => ins.insuranceId !== parseInt(insuranceId)
      )

      if (initialLength === patient.insurance.length) {
        throw new AppError(httpStatus.NOT_FOUND, "Insurance entry not found.")
      }

      await patient.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Insurance deleted successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all clinics that offer a specific test in the same country as the patient
   */
  public static async getClinicsForTest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { testId } = req.params
      const patientId = getPatientId(req)

      const patient = await patientModel.findById(patientId).select("country")
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const tests = await testModel
        .find({ _id: testId })
        .select("clinic price testName")

      if (!tests.length) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "No clinics found for this test."
        )
      }

      const clinicIds = tests.map((test) => test.clinic)

      const [reviews, clinics, allTestItem] = await Promise.all([
        reviewModel
          .find({ clinic: { $in: clinicIds } })
          .select("clinic rating"),
        ClinicModel.find({
          _id: { $in: clinicIds },
          country: patient.country.toLowerCase(),
          status: "approved"
        })
          .select("clinicName address avatar phoneNo location")
          .lean(),
        testItem.find().select("name image")
      ])

      const formattedClinics = clinics.map((clinic) => {
        const clinicTests = tests.filter(
          (test) => test.clinic.toString() === clinic._id.toString()
        )

        const clinicReviews = reviews.filter(
          (review) => review.clinic.toString() === clinic._id.toString()
        )

        const totalRatings = clinicReviews.reduce(
          (acc, review) => acc + review.rating,
          0
        )
        const averageRating =
          clinicReviews.length > 0 ? totalRatings / clinicReviews.length : null

        const testName = clinicTests?.[0]?.testName ?? ""
        const testImage =
          allTestItem.find(
            (cat) => cat.name.toLowerCase() === testName.toLowerCase()
          )?.image || ""

        return {
          id: clinic._id,
          clinicName: clinic.clinicName,
          location: clinic.location?.street || null,
          phoneNo: clinic.phoneNo || null,
          avatar: clinic.avatar || null,
          rating: averageRating,
          price: clinicTests[0]?.price ?? null,
          testImage
        }
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinics providing the selected test retrieved successfully.",
        data: formattedClinics
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all clinics
   */
  public static async getAllClinics(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { location, insurance, test, supportedByLifeLine } = req.query

      const patientId = getPatientId(req)

      const query: any = {}

      const patient = await patientModel
        .findById(patientId)
        .select("country email")
      if (patient) {
        query.country = patient.country.toLowerCase()
      }

      if (location) {
        const locationRegex = new RegExp(
          (location as string).toLowerCase(),
          "i"
        )
        query.$or = [
          { "location.stateOrProvince": { $regex: locationRegex } },
          { "location.cityOrDistrict": { $regex: locationRegex } },
          { "location.street": { $regex: locationRegex } }
        ]
      }

      if (insurance) {
        query.supportInsurance = { $in: [Number(insurance)] }
      }

      if (test) {
        const matchingTests = await testModel
          .find({
            testName: {
              $regex: new RegExp((test as string).toLowerCase(), "i")
            },
            isDeleted: false
          })
          .select("clinic -_id")

        if (!matchingTests.length) {
          throw new AppError(
            httpStatus.NOT_FOUND,
            "No clinics offer the specified test."
          )
        }

        const clinicIds = [...new Set(matchingTests.map((test) => test.clinic))]
        query._id = { $in: clinicIds }
      }

      if (supportedByLifeLine !== undefined) {
        query.contractAccepted = supportedByLifeLine === "true"
      }

      const totalClinicsInDatabase = await ClinicModel.countDocuments()

      query.status = "approved"
      let clinics = await ClinicModel.find(query).select(
        "clinicName location country avatar supportInsurance contractAccepted email"
      )

      const allowedPatientEmail = "sannifortune11@gmail.com"
      const restrictedClinicEmail = "damilolasanni48@gmail.com"

      if (patient?.email !== allowedPatientEmail) {
        clinics = clinics.filter(
          (clinic) => clinic.email !== restrictedClinicEmail
        )
      }

      const clinicIds = clinics.map((clinic) => clinic._id)
      const reviews = await reviewModel
        .find({ clinic: { $in: clinicIds } })
        .select("clinic rating")

      const formattedClinics = clinics.map((clinic) => {
        const clinicReviews = reviews.filter(
          (review) => review.clinic.toString() === clinic._id.toString()
        )

        const averageRating =
          clinicReviews.length > 0
            ? clinicReviews.reduce((acc, review) => acc + review.rating, 0) /
              clinicReviews.length
            : null

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
        }
      })

      formattedClinics.sort((a, b) =>
        a.clinicName?.toLowerCase().localeCompare(b.clinicName?.toLowerCase())
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinics retrieved successfully.",
        hasNoClinics: totalClinicsInDatabase === 0,
        data: formattedClinics
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all supported insurance providers
   */
  public static async getSupportedInsurance(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      res.status(httpStatus.OK).json({
        success: true,
        message: "Supported insurance providers retrieved successfully.",
        data: SUPPORTED_INSURANCE_PROVIDERS
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get a specific clinic's details
   */
  public static async getClinicDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { clinicId } = req.params
      const patientId = getPatientId(req)

      const clinic = await ClinicModel.findOne({
        _id: clinicId,
        status: "approved"
      })
        .select(
          "clinicName location bio clinicId avatar reviews supportInsurance isVerified onlineStatus country contractAccepted"
        )
        .populate({
          path: "reviews",
          select: "rating comment patient clinic",
          populate: {
            path: "patient",
            select: "fullName email"
          }
        })

      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      const patient = await patientModel.findById(patientId).select("country")
      if (patient && clinic.country !== patient.country) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "This clinic is not available in your country."
        )
      }

      const hasOrderedBefore = await orderModel.exists({
        patient: patientId,
        clinic: clinicId,
        status: "success"
      })

      const [tests, allTestItem, discounts] = await Promise.all([
        testModel
          .find({ clinic: clinicId })
          .select(
            "testName price turnaroundTime preTestRequirements homeCollection currencySymbol insuranceCoverage coveredByLifeLine description"
          )
          .lean(),
        testItem.find().select("name image"),
        discountModel
          .find({
            clinic: clinicId,
            validUntil: { $gte: new Date() },
            status: 0,
            isDeleted: false
          })
          .lean()
      ])

      const testsWithImages = tests
        .map((test) => {
          const testImage =
            allTestItem.find(
              (cat) => cat.name.toLowerCase() === test.testName.toLowerCase()
            )?.image || ""

          return {
            _id: test._id,
            testName: test.testName,
            price: test.price,
            currencySymbol: test.currencySymbol,
            image: testImage,
            coveredByLifeLine: test.coveredByLifeLine
              ? "Supports LifeLine Subscription"
              : null
          }
        })
        .sort((a, b) => a?.testName?.localeCompare(b.testName))

      const clinicWithTests = {
        ...clinic.toObject(),
        tests: testsWithImages,
        hasOrderedBefore: !!hasOrderedBefore,
        contractAccepted: clinic.contractAccepted
          ? "Supports LifeLine Subscription"
          : null,
        discounts: discounts || []
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic details retrieved successfully.",
        data: clinicWithTests
      })
    } catch (error) {
      next(error)
    }
  }

  public static async deletePatientByEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { email } = req.body

      if (!email) {
        throw new AppError(httpStatus.BAD_REQUEST, "Email is required.")
      }

      const deletedPatient = await patientModel.findOneAndDelete({ email })

      if (!deletedPatient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Patient deleted successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getAllPatients(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patients = await patientModel.find().select("-password")

      res.status(httpStatus.OK).json({
        success: true,
        message: "Patients retrieved successfully.",
        data: patients
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get top 3 clinics based on overall rating
   */
  public static async getTopClinics(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const patient = await patientModel
        .findById(patientId)
        .select("country email")

      const query: Partial<Record<"country" | "status", string>> = {
        status: "approved"
      }

      if (patient?.country) {
        query.country = patient.country.toLowerCase()
      }

      let clinics = await ClinicModel.find(query).select(
        "clinicName location avatar country email"
      )

      const allowedPatientEmail = "sannifortune11@gmail.com"
      const restrictedClinicEmail = "damilolasanni48@gmail.com"

      if (patient?.email !== allowedPatientEmail) {
        clinics = clinics.filter(
          (clinic) => clinic.email !== restrictedClinicEmail
        )
      }

      if (!clinics.length) {
        throw new AppError(httpStatus.NOT_FOUND, "No clinics found.")
      }

      const clinicIds = clinics.map((clinic) => clinic._id)

      const reviews = await reviewModel
        .find({ clinic: { $in: clinicIds } })
        .select("clinic rating")

      const formattedClinics = clinics
        .map((clinic): FormattedClinic | null => {
          const clinicReviews = reviews.filter(
            (review) => review.clinic.toString() === clinic._id.toString()
          )

          if (clinicReviews.length === 0) return null

          const totalRatings = clinicReviews.reduce(
            (acc, review) => acc + review.rating,
            0
          )

          const averageRating = totalRatings / clinicReviews.length

          return {
            id: clinic._id,
            clinicName: clinic.clinicName,
            location: clinic.location,
            avatar: clinic.avatar,
            rating: averageRating
          }
        })
        .filter((clinic): clinic is FormattedClinic => clinic !== null)

      const sortedClinics = formattedClinics.sort((a, b) => b.rating - a.rating)

      const topClinics = sortedClinics.slice(0, 3)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Top 3 clinics retrieved successfully.",
        data: topClinics
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get Patient Notifications with Progressive Pagination
   */
  public static async getPatientNotifications(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      const page = parseInt(req.query.page as string) || 1
      const baseLimit = 10
      const limit = baseLimit * page
      const skip = 0

      const type = req.query.type as string | undefined

      const filter: Record<string, any> = {
        patient: patientId
      }

      if (type) {
        filter.type = type
      }

      const totalNotificationsInDatabase =
        await patientNotificationModel.countDocuments(filter)

      const notifications = await patientNotificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)

      const total = await patientNotificationModel.countDocuments(filter)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Patient notifications fetched successfully.",
        hasNoNotifications: totalNotificationsInDatabase === 0,
        data: {
          notifications,
          currentPage: page,
          totalPages: Math.ceil(total / baseLimit),
          total
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Mark All Notifications as Read
   */
  public static async markAllAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      await patientNotificationModel.updateMany(
        { patient: patientId, isRead: false },
        { $set: { isRead: true } }
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "All notifications marked as read."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Mark a Single Notification as Read
   */
  public static async markOneAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { id } = req.params

      const notification = await patientNotificationModel.findOne({
        _id: id,
        patient: patientId
      })

      if (!notification) {
        throw new AppError(httpStatus.NOT_FOUND, "Notification not found.")
      }

      if (!notification.isRead) {
        notification.isRead = true
        await notification.save()
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Notification marked as read."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Save Expo Push Token for a patient
   */
  public static async savePushToken(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { token } = req.body

      if (!token) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "Expo Push Token is required."
        })
      }

      await patientModel.findByIdAndUpdate(patientId, {
        expoPushToken: token
      })

      return res.status(httpStatus.OK).json({
        success: true,
        message: "Push token saved successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Soft Delete Authenticated Patient
   */
  public static async deletePatientAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      const patient = await patientModel.findById(patientId)

      if (!patient || patient.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      patient.isDeleted = true
      await patient.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Patient soft-deleted successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Reactivate Soft-Deleted Patient by Email
   */
  public static async reactivatePatientByEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { email } = req.body

      if (!email) {
        throw new AppError(httpStatus.BAD_REQUEST, "email is required.")
      }

      const patient = await patientModel.findOne({
        email: email.toLowerCase().trim(),
        isDeleted: true
      })

      if (!patient || !patient.isDeleted) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Patient is not deleted or does not exist."
        )
      }

      patient.isDeleted = false
      await patient.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Patient account reactivated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async clearPatientNotifications(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      await patientNotificationModel.deleteMany({ patient: patientId })

      res.status(httpStatus.OK).json({
        success: true,
        message: "All notifications cleared successfully."
      })
    } catch (error) {
      next(error)
    }
  }
}
