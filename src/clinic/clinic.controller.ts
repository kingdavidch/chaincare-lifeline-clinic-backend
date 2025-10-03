/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"
import crypto from "crypto"
import "dotenv/config"
import { CookieOptions, NextFunction, Request, Response } from "express"
import httpStatus from "http-status"
import jwt from "jsonwebtoken"
import moment from "moment"
import mongoose from "mongoose"
import { v4 as uuidv4 } from "uuid"
import { io } from ".."
import adminModel from "../admin/admin.model"
import adminNotificationModel from "../admin/admin.notification.model"
import { COUNTRIES } from "../constant"
import orderModel from "../order/order.model"
import PatientModel from "../patient/patient.model"
import { YellowCardService } from "../payment/payment.service"
import withdrawalModel from "../payment/withdrawal.model"
import SmtpService from "../smtp/clinic/smtp.clinic.service"
import subscriptionModel from "../subscription/subscription.model"
import testModel from "../test/test.model"
import testBookingModel from "../testBooking(Cart)/testBooking.model"
import {
  formatPhone,
  getClinicId,
  handleRequiredFields,
  uploadToCloudinary,
  validatePhoneWithPawaPay
} from "../utils"
import AppError from "../utils/app.error"
import { comparePasswords, hashPassword } from "../utils/password.utils"
import ClinicModel from "./clinic.model"
import clinicNotificationModel from "./clinic.notification.model"

export default class ClinicController {
  public static async signup(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, [
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
      ])

      const {
        clinicName,
        email,
        phoneNo,
        stateOrProvince,
        cityOrDistrict,
        street,
        postalCode,
        coordinates,
        password,
        termsAccepted,
        country
      } = req.body

      // Get currency symbol based on country
      const countryData = COUNTRIES?.find(
        (c) => c.value.toLowerCase() === country.toLowerCase()
      )
      const currencySymbol = countryData ? countryData.currencySymbol : ""

      // Check if the email already exists in either patients or clinics
      const existingPatientByEmail = await PatientModel.findOne({ email })
      const existingClinicByEmail = await ClinicModel.findOne({ email })

      if (existingPatientByEmail || existingClinicByEmail) {
        throw new AppError(
          httpStatus.CONFLICT,
          "An account with this email already exists."
        )
      }

      // Check if the phone number already exists in clinics
      const existingPhone = await PatientModel.findOne({ phoneNo })
      const existingClinicPhone = await ClinicModel.findOne({ phoneNo })

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

      const location = {
        stateOrProvince: stateOrProvince || null,
        cityOrDistrict: cityOrDistrict || null,
        street: street || null,
        postalCode: postalCode || null,
        coordinates: coordinates
          ? {
              latitude: coordinates.latitude ?? null,
              longitude: coordinates.longitude ?? null
            }
          : { latitude: null, longitude: null }
      }

      const newClinic = new ClinicModel({
        clinicName,
        email,
        phoneNo,
        location,
        password: hashedPassword,
        termsAccepted,
        country,
        currencySymbol
      })

      await newClinic.save()

      const admin = await adminModel.findOne()

      if (admin) {
        await adminNotificationModel.create({
          admin: admin._id,
          title: "New Clinic Registration",
          message: `Clinic "${clinicName}" has just signed up and is awaiting approval.`,
          type: "info",
          isRead: false
        })
      }

      await SmtpService.sendClinicVerificationEmail(newClinic)
        .then(() => {
          console.log("Verification email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending verification email:", error)
        })

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Registration successful. Please verify your email.",
        data: { email: newClinic.email, id: newClinic.clinicId }
      })
    } catch (error) {
      next(error)
    }
  }

  private static isProd = process.env.NODE_ENV === "production"

  private static getCookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      secure: ClinicController.isProd,
      sameSite: "none",
      domain: ClinicController.isProd ? ".mylifeline.world" : undefined,
      maxAge
    }
  }

  public static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["email", "password"])

      const email = req.body.email.trim().toLowerCase()
      const password = req.body.password

      const clinic = await ClinicModel.findOne({ email })
      if (!clinic)
        throw new AppError(httpStatus.NOT_FOUND, "Invalid email or password.")

      if (!clinic.isVerified) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Your account is not verified. Please verify your email."
        )
      }

      const isPasswordValid = await comparePasswords(password, clinic.password)
      if (!isPasswordValid) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Invalid email or password."
        )
      }

      const payload = {
        id: clinic._id.toString(),
        email: clinic.email,
        clinicName: clinic.clinicName
      }

      const accessToken = jwt.sign(payload, process.env.JWT_SECRET as string, {
        expiresIn: "15m"
      })
      const refreshToken = jwt.sign(
        payload,
        process.env.JWT_REFRESH_SECRET as string,
        { expiresIn: "30d" }
      )

      res
        .cookie(
          "token",
          accessToken,
          ClinicController.getCookieOptions(1000 * 60 * 15)
        )
        .cookie(
          "refreshToken",
          refreshToken,
          ClinicController.getCookieOptions(1000 * 60 * 60 * 24 * 30)
        )
        .status(httpStatus.OK)
        .json({
          success: true,
          message: "Login successful",
          id: clinic?.clinicId,
          accessToken,
          expiresIn: "15min"
        })
    } catch (error) {
      next(error)
    }
  }

  public static async refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const token = req.cookies.refreshToken
      if (!token) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Missing refresh token.")
      }

      const payload = jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET as string
      ) as { id: string; email: string; clinicName: string }

      const newAccessToken = jwt.sign(
        {
          id: payload.id,
          email: payload.email,
          clinicName: payload.clinicName
        },
        process.env.JWT_SECRET as string,
        { expiresIn: "15m" }
      )

      res
        .cookie(
          "token",
          newAccessToken,
          ClinicController.getCookieOptions(1000 * 60 * 15)
        )
        .status(httpStatus.OK)
        .json({
          success: true,
          accessToken: newAccessToken,
          message: "Token refreshed successfully"
        })
    } catch (error) {
      next(error)
    }
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie("token", ClinicController.getCookieOptions(0))
    res.clearCookie("refreshToken", ClinicController.getCookieOptions(0))
    res
      .status(httpStatus.OK)
      .json({ success: true, message: "Logged out successfully" })
  }

  public static async verifyClinic(req: Request, res: Response) {
    try {
      const { key } = req.query

      if (!key || typeof key !== "string") {
        return res.redirect(
          `${SmtpService.FRONTEND_URL}/login?status=invalid-link`
        )
      }

      const clinic = await ClinicModel.findOne({ clinicId: key })
      if (!clinic) {
        return res.redirect(
          `${SmtpService.FRONTEND_URL}/login?status=invalid-link`
        )
      }

      clinic.isVerified = true
      await clinic.save()

      return res.redirect(`${SmtpService.FRONTEND_URL}/login?status=verified`)
    } catch (error) {
      return res.redirect(`${SmtpService.FRONTEND_URL}/login?status=failure`)
    }
  }

  public static async forgotPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["email"])
      const { email } = req.body

      const clinic = await ClinicModel.findOne({ email })
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Account not found.")
      }

      const resetToken = crypto.randomBytes(32).toString("hex")
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex")

      clinic.resetPasswordToken = hashedToken
      clinic.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

      await clinic.save()

      await SmtpService.sendClinicResetPasswordEmail(clinic, resetToken)
        .then(() => {
          console.log("email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending email:", error)
        })

      await clinicNotificationModel.create({
        clinic: clinic._id,
        title: "Password Reset Requested",
        message: "A password reset has been requested for your account.",
        type: "info"
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Password reset link has been sent to your email."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["token", "newPassword", "confirmPassword"])

      const { token, newPassword, confirmPassword } = req.body

      if (newPassword !== confirmPassword) {
        throw new AppError(httpStatus.BAD_REQUEST, "Passwords do not match.")
      }

      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")

      const clinic = await ClinicModel.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      })

      if (!clinic) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Token is invalid or has expired."
        )
      }

      clinic.password = await hashPassword(newPassword)
      clinic.resetPasswordToken = undefined
      clinic.resetPasswordExpires = undefined

      await clinic.save()

      await clinicNotificationModel.create({
        clinic: clinic._id,
        title: "Password Reset Successful",
        message: "Your password has been successfully reset.",
        type: "info"
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Password has been reset successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async resendVerificationLink(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["email"])
      const { email } = req.body

      const clinic = await ClinicModel.findOne({ email })
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Account not found.")
      }

      if (clinic.isVerified) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Account is already verified."
        )
      }

      await SmtpService.sendClinicVerificationEmail(clinic)
        .then(() => {
          console.log("Verification email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending verification email:", error)
        })

      res.status(httpStatus.OK).json({
        success: true,
        message: "A new verification link has been sent to your email."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getClinic(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const clinic = await ClinicModel.findById(clinicId)
        .select(
          "-password -resetPasswordToken -resetPasswordExpires -tests -certificate -termsAccepted"
        )
        .populate({
          path: "reviews",
          select: "rating comment patient",
          populate: {
            path: "patient",
            select: "fullName"
          }
        })

      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic information retrieved successfully.",
        data: clinic
      })
    } catch (error) {
      next(error)
    }
  }

  public static async updateClinicProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const clinic = await ClinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      const {
        clinicName,
        bio,
        email,
        phoneNo,
        stateOrProvince,
        cityOrDistrict,
        street,
        postalCode,
        coordinates,
        password,
        country,
        supportInsurance,
        onlineStatus,
        currencySymbol
      } = req.body
      let profilePhotoUrl = clinic.avatar

      // Check if the email already exists in either patients or clinics
      if (email) {
        const existingPatientByEmail = await PatientModel.findOne({ email })
        const existingClinicByEmail = await ClinicModel.findOne({
          email,
          _id: { $ne: clinicId }
        })

        if (existingPatientByEmail || existingClinicByEmail) {
          throw new AppError(
            httpStatus.CONFLICT,
            "An account with this email already exists."
          )
        }
      }

      if (phoneNo) {
        const existingPatientPhone = await PatientModel.findOne({
          phoneNumber: phoneNo
        })
        const existingClinicPhone = await ClinicModel.findOne({
          phoneNo,
          _id: { $ne: clinicId }
        })

        if (existingPatientPhone || existingClinicPhone) {
          throw new AppError(
            httpStatus.CONFLICT,
            "Phone number is already in use."
          )
        }
      }

      if (req.file) {
        const result = await uploadToCloudinary(
          req.file.buffer,
          "image",
          `clinic_avatars/${req.file.originalname}`
        )
        profilePhotoUrl = result.secure_url
      }

      const updatedFields: string[] = []

      if (clinicName) {
        clinic.clinicName = clinicName
        updatedFields.push("clinicName")
      }
      if (onlineStatus) {
        clinic.onlineStatus = onlineStatus
        updatedFields.push("onlineStatus")
      }
      if (phoneNo) {
        clinic.phoneNo = phoneNo
        updatedFields.push("phoneNo")
      }
      if (bio) {
        clinic.bio = bio
        updatedFields.push("bio")
      }
      if (!clinic.location) {
        clinic.location = {
          stateOrProvince: "",
          cityOrDistrict: "",
          street: "",
          postalCode: "",
          coordinates: { latitude: 0, longitude: 0 }
        }
      }
      if (stateOrProvince) {
        clinic.location.stateOrProvince = stateOrProvince
        updatedFields.push("stateOrProvince")
      }
      if (cityOrDistrict) {
        clinic.location.cityOrDistrict = cityOrDistrict
        updatedFields.push("cityOrDistrict")
      }
      if (street) {
        clinic.location.street = street
        updatedFields.push("street")
      }
      if (postalCode) {
        clinic.location.postalCode = postalCode
        updatedFields.push("postalCode")
      }
      if (coordinates) {
        clinic.location.coordinates = JSON.parse(coordinates)
        updatedFields.push("coordinates")
      }
      if (country) {
        clinic.country = country
        updatedFields.push("country")
      }
      if (password) {
        clinic.password = await hashPassword(password)
        updatedFields.push("password")
      }
      if (supportInsurance) {
        clinic.supportInsurance = JSON.parse(supportInsurance)
        updatedFields.push("supportInsurance")
      }
      if (currencySymbol) {
        clinic.currencySymbol = currencySymbol
        updatedFields.push("currencySymbol")
      }
      if (profilePhotoUrl) {
        clinic.avatar = profilePhotoUrl
        updatedFields.push("avatar")
      }

      await clinic.save()

      io.emit("clinic:update", { clinicId, updatedFields })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Profile updated successfully."
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
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const skip = (page - 1) * limit
      const { status } = req.query

      // Prepare status filter
      const validStatuses = ["active", "locked", "expired"]
      const isStatusFilterApplied =
        status && validStatuses.includes(status.toString().toLowerCase())

      // Fetch subscriptions (filtered by status if provided)
      const subscriptions = await subscriptionModel
        .find(
          isStatusFilterApplied
            ? { status: status.toString().toLowerCase() }
            : {}
        )
        .select("patient status")

      const patientIds = subscriptions.map((s) => s.patient.toString())

      // Fetch only patients that match filtered subscriptions (if status is applied)
      const patientQuery = isStatusFilterApplied
        ? { _id: { $in: patientIds } }
        : {}

      // Get total matching patients before pagination
      const totalMatchingPatients =
        await PatientModel.countDocuments(patientQuery)

      // Fetch paginated patients
      const patients = await PatientModel.find(patientQuery)
        .sort({ createdAt: -1 })
        .select("patientId fullName email phoneNumber")
        .skip(skip)
        .limit(limit)

      const patientStatusMap = subscriptions.reduce(
        (acc, sub) => {
          acc[sub.patient.toString()] = sub.status.toLowerCase()
          return acc
        },
        {} as Record<string, string>
      )

      const formattedPatients = patients.map((patient) => ({
        patientId: patient.patientId,
        patientName: patient.fullName,
        email: patient.email,
        phoneNumber: patient.phoneNumber,
        status: patientStatusMap[patient._id.toString()] || "not member"
      }))

      // Total patients in DB (not filtered)
      const totalPatientsInDatabase = await PatientModel.countDocuments()

      res.status(httpStatus.OK).json({
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
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get clinic earnings and total tests conducted
   */
  public static async getEarnings(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const clinic = await ClinicModel.findById(clinicId).select("balance")
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      const balance = clinic.balance || 0

      const totalTests = await testModel.countDocuments({
        clinic: clinicId,
        isDeleted: false
      })

      const startOfMonth = moment().startOf("month").toDate()
      const startOfLastMonth = moment()
        .subtract(1, "month")
        .startOf("month")
        .toDate()
      const endOfLastMonth = moment()
        .subtract(1, "month")
        .endOf("month")
        .toDate()

      const thisMonthEarnings = await orderModel.aggregate([
        {
          $match: {
            clinic: new mongoose.Types.ObjectId(clinicId),
            paymentStatus: "paid",
            paymentMethod: { $in: ["pawa_pay", "yellow_card"] },
            createdAt: { $gte: startOfMonth }
          }
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ])

      const lastMonthEarnings = await orderModel.aggregate([
        {
          $match: {
            clinic: new mongoose.Types.ObjectId(clinicId),
            paymentStatus: "paid",
            paymentMethod: { $in: ["pawa_pay", "yellow_card"] },
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
          }
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ])

      const startOfLastWeek = moment()
        .subtract(1, "week")
        .startOf("week")
        .toDate()
      const endOfLastWeek = moment().subtract(1, "week").endOf("week").toDate()

      const lastWeekTests = await testModel
        .countDocuments({
          clinic: clinicId,
          createdAt: { $gte: startOfLastWeek, $lte: endOfLastWeek }
        })
        .setOptions({ includeDeleted: true })

      const thisMonthEarningsValue = thisMonthEarnings?.[0]?.total || 0
      const lastMonthEarningsValue = lastMonthEarnings?.[0]?.total || 0

      const percentageChangeEarnings =
        lastMonthEarningsValue > 0
          ? ((thisMonthEarningsValue - lastMonthEarningsValue) /
              lastMonthEarningsValue) *
            100
          : thisMonthEarningsValue > 0
            ? 100
            : 0

      const lastMonthCreditedBalance = lastMonthEarningsValue * 0.955
      const percentageChangeBalance =
        lastMonthCreditedBalance > 0
          ? ((balance - lastMonthCreditedBalance) / lastMonthCreditedBalance) *
            100
          : balance > 0
            ? 100
            : 0

      const percentageChangeTests =
        lastWeekTests > 0
          ? ((totalTests - lastWeekTests) / lastWeekTests) * 100
          : totalTests > 0
            ? 100
            : 0

      res.status(httpStatus.OK).json({
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
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get clinic earnings overview (daily, weekly, monthly, yearly)
   */
  public static async getEarningsOverview(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const filter = req.query.filter || "monthly"

      let startDate: Date
      let groupFormat: string

      switch (filter) {
        case "daily":
          startDate = moment().subtract(30, "days").toDate()
          groupFormat = "%Y-%m-%d"
          break
        case "weekly":
          startDate = moment().subtract(12, "weeks").toDate()
          groupFormat = "%Y-%U"
          break
        case "yearly":
          startDate = moment().subtract(5, "years").toDate()
          groupFormat = "%Y"
          break
        case "monthly":
        default:
          startDate = moment().subtract(12, "months").toDate()
          groupFormat = "%Y-%m"
          break
      }

      const earningsData = await orderModel.aggregate([
        {
          $match: {
            clinic: new mongoose.Types.ObjectId(clinicId),
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
      ])

      const formattedData = earningsData.map((entry) => ({
        period: entry._id,
        earnings: +(entry.totalEarnings * 0.955).toFixed(2)
      }))

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic earnings overview retrieved successfully.",
        data: formattedData
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getTestDistribution(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = new mongoose.Types.ObjectId(getClinicId(req))

      const homeTestsCount = await testBookingModel.countDocuments({
        clinic: clinicId,
        testLocation: "home",
        status: "completed"
      })

      const onSiteTestsCount = await testBookingModel.countDocuments({
        clinic: clinicId,
        testLocation: "on-site",
        status: "completed"
      })

      const totalTests = homeTestsCount + onSiteTestsCount

      const homePercentage =
        totalTests > 0 ? +((homeTestsCount / totalTests) * 100).toFixed(1) : 0

      const onSitePercentage =
        totalTests > 0 ? +((onSiteTestsCount / totalTests) * 100).toFixed(1) : 0

      res.status(httpStatus.OK).json({
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
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get clinic test sales data (Daily, Weekly, Monthly, Yearly)
   */
  public static async getTestSales(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const { filter = "monthly", testName } = req.query

      let startDate: Date
      let groupFormat: string

      switch (filter) {
        case "daily":
          startDate = moment().subtract(30, "days").toDate()
          groupFormat = "%Y-%m-%d"
          break
        case "weekly":
          startDate = moment().subtract(12, "weeks").toDate()
          groupFormat = "%Y-%U"
          break
        case "yearly":
          startDate = moment().subtract(5, "years").toDate()
          groupFormat = "%Y"
          break
        case "monthly":
        default:
          startDate = moment().subtract(12, "months").toDate()
          groupFormat = "%Y-%m"
          break
      }

      const matchStage: any = {
        clinic: new mongoose.Types.ObjectId(clinicId),
        paymentStatus: "paid",
        createdAt: { $gte: startDate }
      }

      const pipeline: any[] = [{ $match: matchStage }, { $unwind: "$tests" }]

      if (testName) {
        pipeline.push({
          $match: { "tests.testName": testName }
        })
      }

      pipeline.push(
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
            totalSales: { $sum: "$tests.individuals" }
          }
        },
        { $sort: { _id: 1 } }
      )

      const salesData = await orderModel.aggregate(pipeline)

      const formattedData = salesData.map((entry) => ({
        period: entry._id,
        sales: entry.totalSales
      }))

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic test sales data retrieved successfully.",
        data: formattedData
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get the top 2 most popular tests based on bookings
   */
  public static async getPopularTests(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = new mongoose.Types.ObjectId(getClinicId(req))

      const popularTests = await testBookingModel.aggregate([
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
      ])

      const testIds = popularTests.map((test) => test._id)

      const testDetails = await testModel
        .find({ _id: { $in: testIds } })
        .setOptions({ includeDeleted: true })
        .select("testName price")
        .lean()

      const formattedTests = popularTests.map((test) => {
        const matched = testDetails.find(
          (t) => t._id.toString() === test._id.toString()
        )
        return {
          testName: matched?.testName || "Unknown Test",
          price: matched?.price || 0,
          totalBookings: test.totalBookings
        }
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Top 2 popular tests retrieved successfully.",
        data: formattedTests
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get patient statistics including all patients, members, and active patients
   */
  public static async getPatientMetrics(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      getClinicId(req)

      // Timestamps for calculations
      const startOfLastMonth = moment()
        .subtract(1, "month")
        .startOf("month")
        .toDate()
      const endOfLastMonth = moment()
        .subtract(1, "month")
        .endOf("month")
        .toDate()

      // 1️⃣ All Patients
      const allPatients = await PatientModel.find({ isDeleted: false })
        .select("avatar")
        .lean()

      // 2️⃣ Members (Patients with subscriptions)
      const members = await subscriptionModel
        .distinct("patient")
        .then((patients) => patients?.length)

      // 3️⃣ Members Last Month
      const lastMonthMembers = await subscriptionModel
        .distinct("patient", {
          startDate: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        })
        .then((patients) => patients?.length)

      // 4️⃣ Active Patients
      const activeSubscriptions = await subscriptionModel
        .find({ status: "active" })
        .select("patient")
        .lean()

      const lastMonthActivePatients = await subscriptionModel
        .distinct("patient", {
          status: "active",
          startDate: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        })
        .then((patients) => patients?.length)

      const activePatientIds = activeSubscriptions.map((sub) => sub.patient)
      const activePatients = await PatientModel.find({
        _id: { $in: activePatientIds },
        isDeleted: false
      })
        .select("avatar")
        .lean()

      const activeData = activePatients.map((p) => p.avatar).filter(Boolean)

      // Percentage calculations
      const percentageChangeAllPatients = lastMonthMembers
        ? ((allPatients.length - lastMonthMembers) / lastMonthMembers) * 100
        : 0

      const percentageChangeMembers = lastMonthMembers
        ? ((members - lastMonthMembers) / lastMonthMembers) * 100
        : 0

      const percentageChangeActive = lastMonthActivePatients
        ? ((activePatients.length - lastMonthActivePatients) /
            lastMonthActivePatients) *
          100
        : 0

      res.status(httpStatus.OK).json({
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
            amount: activePatients?.length,
            percentageChange: percentageChangeActive.toFixed(1),
            images: activeData?.length ? activeData.slice(0, 5) : undefined
          }
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getClinicNotifications(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const { type, page = 1, limit = 20 } = req.query

      const filter: any = {
        clinic: clinicId,
        isDeleted: { $ne: true }
      }

      const allowedTypes = [
        "order",
        "test result",
        "claim",
        "wallet",
        "info",
        "warning",
        "alert"
      ]

      if (type) {
        if (allowedTypes.includes(type as string)) {
          filter.type = type
        } else {
          return res.status(400).json({
            success: false,
            message: `Invalid notification type '${type}'. Allowed types: ${allowedTypes.join(", ")}`
          })
        }
      }

      const skip = (Number(page) - 1) * Number(limit)

      const [notifications, total] = await Promise.all([
        clinicNotificationModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        clinicNotificationModel.countDocuments(filter)
      ])

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic notifications fetched successfully.",
        data: notifications,
        pagination: {
          totalItems: total,
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          limit: Number(limit)
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async markRecentTwoNotificationsAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      // Fetch the two most recent unread notifications for the clinic
      const recentNotifications = await clinicNotificationModel
        .find({
          clinic: clinicId,
          isRead: false
        })
        .sort({ createdAt: -1 })
        .limit(2)

      if (recentNotifications.length === 0) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "No unread notifications found."
        )
      }

      const notificationIds = recentNotifications?.map(
        (notification) => notification._id
      )

      await clinicNotificationModel.updateMany(
        {
          _id: { $in: notificationIds }
        },
        { isRead: true }
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "Recent two notifications marked as read."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async markAllNotificationsAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const result = await clinicNotificationModel.updateMany(
        {
          clinic: clinicId,
          isRead: false,
          isDeleted: { $ne: true }
        },
        { isRead: true }
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: `Marked ${result.modifiedCount} notifications as read.`,
        data: {
          markedCount: result.modifiedCount
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async uploadCertificate(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const clinic = await ClinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      if (!req.file) {
        throw new AppError(httpStatus.BAD_REQUEST, "No file uploaded.")
      }

      const isImage = /jpeg|jpg|png|gif/i.test(req.file.mimetype)
      const resourceType = isImage ? "image" : "raw"
      const fileExtension = isImage
        ? req.file.originalname.split(".").pop()
        : "pdf"
      const publicId = `clinic_certificates/${clinic.clinicName}_certificate.${fileExtension}`

      const result = await uploadToCloudinary(
        req.file.buffer,
        resourceType,
        "certificate",
        { public_id: publicId }
      )

      clinic.certificate.file = result.secure_url
      clinic.certificate.status = "pending"
      await clinic.save()

      const admin = await adminModel.findOne()

      await adminNotificationModel.create({
        admin: admin?._id,
        title: "Clinic Certificate",
        message: `Clinic ${clinic.clinicName} has uploaded a new certificate for verification.`,
        type: "info",
        isRead: false
      })

      await clinicNotificationModel.create({
        clinic: clinic._id,
        title: "Certificate Uploaded",
        message:
          "Your certificate has been uploaded and is pending verification.",
        type: "info",
        isRead: false
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Certificate uploaded successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Clinic Accepts Contract
   */
  public static async acceptContract(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const clinic = await ClinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      if (clinic.contractAccepted) {
        throw new AppError(httpStatus.BAD_REQUEST, "Contract already accepted.")
      }

      clinic.contractAccepted = true
      await clinic.save()

      const admin = await adminModel.findOne()
      if (admin) {
        await adminNotificationModel.create({
          admin: admin._id,
          title: "Contract Accepted",
          message: `Clinic ${clinic.clinicName} has accepted the contract.`,
          type: "info",
          isRead: false
        })
      }

      SmtpService.sendContractAcceptanceEmail(clinic)
        .then(() => {
          console.log(
            "Contract acceptance email sent successfully to clinic:",
            clinic.clinicName
          )
        })
        .catch((error) => {
          console.error("Error sending Contract acceptance email:", error)
        })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Contract accepted successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async withdrawToMobileMoney(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["phoneNumber", "amount"])

      const { phoneNumber, amount } = req.body
      const clinicId = getClinicId(req)

      if (typeof amount !== "number" || amount < 100) {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid withdrawal amount.")
      }

      const clinic = await ClinicModel.findById(clinicId)
      if (!clinic) throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")

      const withdrawalFee = amount * 0.02
      const totalDeduction = amount + withdrawalFee

      if (clinic.balance < totalDeduction) {
        throw new AppError(httpStatus.BAD_REQUEST, "Insufficient balance.")
      }

      const { sanitizedPhone, provider } =
        await validatePhoneWithPawaPay(phoneNumber)
      const payoutId = uuidv4()

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
          { clinicId: clinicId?.toString(), isPII: true },
          { service: "clinic" },
          { callbackUrl: `${process.env.BACKEND_URL}/api/v1/payment/p/p-w` }
        ]
      }

      const payoutRes = await axios.post(
        `${process.env.PAWAPAY_API_URL}/v2/payouts`,
        payoutPayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      )

      const status = payoutRes.data?.status
      if (status === "REJECTED") {
        const reason = payoutRes.data?.failureReason
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "PawaPay rejected the payout.",
          failureCode: reason?.failureCode,
          failureMessage: reason?.failureMessage
        })
      }

      await withdrawalModel.create({
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
      })

      clinic.balance -= totalDeduction
      await clinic.save()

      await clinicNotificationModel.create([
        {
          clinic: clinic._id,
          title: "Withdrawal Requested",
          message: `You’ve requested a withdrawal of ${amount.toLocaleString()} RWF to ${sanitizedPhone}.`,
          type: "alert",
          isRead: false
        }
      ])

      const admin = await adminModel.findOne()
      if (admin) {
        await adminNotificationModel.create([
          {
            admin: admin._id,
            title: "Clinic Withdrawal Requested",
            message: `Clinic "${clinic.clinicName}" requested ${amount.toLocaleString()} RWF to ${sanitizedPhone}.`,
            type: "alert",
            isRead: false
          }
        ])
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Withdrawal initiated.",
        data: {
          payoutId,
          payoutAmount: amount,
          fee: withdrawalFee,
          newBalance: clinic.balance
        }
      })
    } catch (error: any) {
      const errData = error?.response?.data
      if (errData) {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: errData?.failureReason?.failureMessage,
          data: errData?.failureReason
        })
      }
      next(error)
    }
  }

  static async getPayoutDetails(payoutId: string) {
    const response = await axios.get(
      `${process.env.PAWAPAY_API_URL}/v2/payouts/${payoutId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`
        }
      }
    )

    return response.data?.data
  }

  public static async getClinicWithdrawals(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const clinicId = getClinicId(req)
      const { page = "1", limit = "10", status, date, search } = req.query

      const pageNumber = parseInt(page as string, 10) || 1
      const limitNumber = parseInt(limit as string, 10) || 10
      const skip = (pageNumber - 1) * limitNumber

      const filter: Record<string, any> = { clinic: clinicId }

      if (status) {
        filter.status = (status as string).toLowerCase()
      }

      if (date) {
        const startDate = new Date(date as string)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(date as string)
        endDate.setHours(23, 59, 59, 999)
        filter.createdAt = { $gte: startDate, $lte: endDate }
      }

      if (search) {
        filter.phoneNumber = { $regex: search, $options: "i" }
      }

      const withdrawals = await withdrawalModel
        .find(filter)
        .select("createdAt amount status withdrawalId payoutId provider")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean()

      const totalInDatabase = await withdrawalModel.countDocuments({
        clinic: clinicId
      })

      const total = await withdrawalModel.countDocuments(filter)

      const formatted = await Promise.all(
        withdrawals.map(async (w) => {
          let status = w.status

          const nonFinalStatuses = ["accepted", "processing", "failed", "found"]

          if (
            w.payoutId &&
            (!status || nonFinalStatuses.includes(status.toLowerCase()))
          ) {
            try {
              const payout = await ClinicController.getPayoutDetails(w.payoutId)
              const providerStatus = payout?.status?.toUpperCase()

              if (providerStatus && providerStatus !== status?.toUpperCase()) {
                status = providerStatus.toLowerCase()
                await withdrawalModel.updateOne(
                  { payoutId: w.payoutId },
                  { status, providerStatus }
                )
              }
            } catch (err: any) {
              console.error(
                `❌ Failed to fetch payout ${w.payoutId}:`,
                err?.response?.data || err.message || err
              )
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
          }
        })
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "Withdrawals fetched successfully.",
        hasNoWithdrawals: totalInDatabase === 0,
        data: formatted,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalWithdrawals: total
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getPawaPayPayoutStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { payoutId } = req.params

      if (!payoutId) {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "Missing payoutId."
        })
        return
      }

      const response = await axios.get(
        `${process.env.PAWAPAY_API_URL}/v2/payouts/${payoutId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      )

      const payout = response.data

      res.status(httpStatus.OK).json({
        success: true,
        message: "PawaPay payout fetched successfully.",
        data: payout
      })
    } catch (error: any) {
      const errData = error?.response?.data
      res.status(error?.response?.status || 500).json({
        success: false,
        message: "Failed to fetch payout from PawaPay.",
        data: errData ?? {}
      })
    }
  }

  public static async withdrawToBankWithYellowCard(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, [
        "accountNumber",
        "amount",
        "accountName",
        "bankName"
      ])

      const { accountNumber, amount, accountName, bankName } = req.body
      const clinicId = getClinicId(req)

      if (typeof amount !== "number" || amount < 1000) {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid withdrawal amount.")
      }

      const clinic = await ClinicModel.findById(clinicId)
      if (!clinic) throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      if (clinic.balance < amount) {
        throw new AppError(httpStatus.BAD_REQUEST, "Insufficient balance.")
      }

      const exchangeRate = 1420
      const usdAmount = +(amount / exchangeRate).toFixed(2)

      const ycService = new YellowCardService()

      const sequenceId = `wd_${Date.now()}_${clinicId}`

      const withdrawChannels = await ycService.getPaymentChannels(
        "RW",
        "withdraw"
      )

      if (!withdrawChannels.length) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "No available withdrawal channels."
        )
      }

      const selectedChannelId = withdrawChannels?.find(
        (ch) => ch.channelType === "bank"
      )?.id

      const payout = await ycService.submitPayoutRequest({
        amount: usdAmount,
        currency: "USD",
        channelId: selectedChannelId!,
        sequenceId,
        forceAccept: true,
        customerUID: clinic?._id?.toString(),
        customerType: "retail",
        recipient: {
          accountName,
          accountNumber,
          bankId: selectedChannelId!,
          bankName,
          country: "RW",
          phoneNumber: formatPhone(clinic?.phoneNo),
          reason: "other"
        }
      })

      const withdrawalFee = Math.round(amount * 0.01)

      const withdrawal = await withdrawalModel.create({
        clinic: clinicId,
        amount,
        usdAmount,
        phoneNumber: clinic?.phoneNo,
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
      })

      clinic.balance -= amount + withdrawalFee
      await clinic.save()

      await clinicNotificationModel.create([
        {
          clinic: clinicId,
          title: "Withdrawal Initiated",
          message: `Your withdrawal request of ${amount.toLocaleString()} RWF to bank account ${accountNumber} is being processed.`,
          type: "wallet",
          isRead: false
        }
      ])

      const admin = await adminModel.findOne()
      if (admin) {
        await adminNotificationModel.create([
          {
            admin: admin._id,
            title: "Clinic Withdrawal Alert",
            message: `Clinic ${clinicId} initiated a ${amount.toLocaleString()} RWF withdrawal to ${accountNumber}.`,
            type: "wallet",
            isRead: false
          }
        ])
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Withdrawal request submitted. Awaiting confirmation.",
        data: {
          status: withdrawal.status,
          usdAmount,
          rwfAmount: amount
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async clearClinicNotifications(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      await clinicNotificationModel.deleteMany({ clinic: clinicId })

      res.status(httpStatus.OK).json({
        success: true,
        message: "All notifications cleared successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get clinic withdrawal stats (Earning, Balance, Total Tests)
   */
  public static async getWithdrawalStats(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const clinic = await ClinicModel.findById(clinicId).select("balance")
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      const balance = clinic.balance || 0

      // ==== Earnings (this month vs last month) ====
      const startOfThisMonth = moment().startOf("month").toDate()
      const startOfLastMonth = moment()
        .subtract(1, "month")
        .startOf("month")
        .toDate()
      const endOfLastMonth = moment()
        .subtract(1, "month")
        .endOf("month")
        .toDate()

      const thisMonthEarningsAgg = await orderModel.aggregate([
        {
          $match: {
            clinic: new mongoose.Types.ObjectId(clinicId),
            paymentStatus: "paid",
            createdAt: { $gte: startOfThisMonth }
          }
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ])

      const lastMonthEarningsAgg = await orderModel.aggregate([
        {
          $match: {
            clinic: new mongoose.Types.ObjectId(clinicId),
            paymentStatus: "paid",
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
          }
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ])

      const thisMonthEarnings = thisMonthEarningsAgg?.[0]?.total || 0
      const lastMonthEarnings = lastMonthEarningsAgg?.[0]?.total || 0

      const creditedThisMonth = thisMonthEarnings * 0.955
      const creditedLastMonth = lastMonthEarnings * 0.955

      const earningsPercentage =
        creditedLastMonth > 0
          ? ((creditedThisMonth - creditedLastMonth) / creditedLastMonth) * 100
          : creditedThisMonth > 0
            ? 100
            : 0

      // ==== Balance (% change vs last credited balance) ====
      const balancePercentage =
        creditedLastMonth > 0
          ? ((balance - creditedLastMonth) / creditedLastMonth) * 100
          : balance > 0
            ? 100
            : 0

      // ==== Total Tests (all-time vs last week) ====
      const totalTests = await orderModel.countDocuments({
        clinic: new mongoose.Types.ObjectId(clinicId),
        paymentStatus: "paid"
      })

      const startOfLastWeek = moment()
        .subtract(1, "week")
        .startOf("week")
        .toDate()
      const endOfLastWeek = moment().subtract(1, "week").endOf("week").toDate()

      const lastWeekTests = await orderModel.countDocuments({
        clinic: new mongoose.Types.ObjectId(clinicId),
        paymentStatus: "paid",
        createdAt: { $gte: startOfLastWeek, $lte: endOfLastWeek }
      })

      const testsPercentage =
        lastWeekTests > 0
          ? ((totalTests - lastWeekTests) / lastWeekTests) * 100
          : totalTests > 0
            ? 100
            : 0

      res.status(httpStatus.OK).json({
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
      })
    } catch (error) {
      next(error)
    }
  }
}
