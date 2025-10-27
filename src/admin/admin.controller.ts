/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"
import base64 from "base-64"
import crypto from "crypto"
import "dotenv/config"
import { NextFunction, Request, Response } from "express"
import httpStatus from "http-status"
import jwt from "jsonwebtoken"
import moment from "moment"
import { io } from ".."
import claimModel from "../claim/claim.model"
import clinicModel from "../clinic/clinic.model"
import clinicNotificationModel from "../clinic/clinic.notification.model"
import { COUNTRIES } from "../constant"
import orderModel from "../order/order.model"
import patientModel from "../patient/patient.model"
import SmtpService from "../smtp/admin/smtp.admin.service"
import SmtpServiceClinic from "../smtp/clinic/smtp.clinic.service"
import subscriptionModel from "../subscription/subscription.model"
import testItem from "../test/test.item.model"
import testModel from "../test/test.model"
import testBookingModel from "../testBooking(Cart)/testBooking.model"
import testResultModel from "../testResult/test.result.model"
import { getAdminId, handleRequiredFields } from "../utils"
import AppError from "../utils/app.error"
import { comparePasswords, hashPassword } from "../utils/password.utils"
import AdminModel from "./admin.model"
import AdminNotificationModel from "./admin.notification.model"
import { mapDeliveryMethod } from "../order/utils"
import patientNotificationModel from "../patient/patient.notification.model"
import reviewModel from "../review/review.model"
import { notifyAdmin } from "./utils"
import practitionerCategoryModel from "../clinic/practitionercategory.model"

export default class AdminController {
  // auth
  public static async signup(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["userName", "email", "password"])

      const { userName, email, password } = req.body

      const existingAdminByUserName = await AdminModel.findOne({ userName })

      // Check if the email already exists in patients, clinics, or admins
      const existingPatientByEmail = await patientModel.findOne({ email })
      const existingClinicByEmail = await clinicModel.findOne({ email })
      const existingAdminByEmail = await AdminModel.findOne({ email })

      if (
        existingPatientByEmail ||
        existingClinicByEmail ||
        existingAdminByEmail
      ) {
        throw new AppError(
          httpStatus.CONFLICT,
          "An account with this email already exists."
        )
      }

      if (existingAdminByUserName) {
        throw new AppError(
          httpStatus.CONFLICT,
          "An account with this userName already exists."
        )
      }

      const hashedPassword = await hashPassword(password)

      const newAdmin = new AdminModel({
        userName,
        email,
        password: hashedPassword
      })

      await newAdmin.save()

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Admin registration successful.",
        data: { email: newAdmin.email, userName: newAdmin.userName }
      })
    } catch (error) {
      next(error)
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

      const admin = await AdminModel.findOne({ email })
      if (!admin) {
        throw new AppError(httpStatus.NOT_FOUND, "Invalid email or password.")
      }

      const isPasswordValid = await comparePasswords(password, admin.password)
      if (!isPasswordValid) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Invalid email or password."
        )
      }

      const payload = {
        id: admin._id.toString(),
        email: admin.email,
        userName: admin.userName
      }

      const token = jwt.sign(payload, process.env.JWT_SECRET as string)

      admin.lastLogin = new Date()
      await admin.save()

      await notifyAdmin(
        "Successful Login Attempt",
        `Your account was successfully accessed on ${moment().format("MMMM Do YYYY, h:mm:ss a")}. If this was not you, please contact support immediately.`,
        "info"
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "Login successful. Welcome back!",
        token
      })
    } catch (error) {
      next(error)
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

      const admin = await AdminModel.findOne({ email })
      if (!admin) {
        throw new AppError(httpStatus.NOT_FOUND, "Account not found.")
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex")
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex")

      admin.resetPasswordToken = hashedToken
      admin.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

      await admin.save()

      await SmtpService.sendAdminResetPasswordEmail(admin, resetToken)
        .then(() => {
          console.log("email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending email:", error)
        })

      await notifyAdmin(
        "Password Reset Requested",
        "A password reset request was initiated for your account. If this wasn't you, please contact support immediately.",
        "warning"
      )

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

      const admin = await AdminModel.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      })

      if (!admin) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Token is invalid or has expired."
        )
      }

      // Update password
      admin.password = await hashPassword(newPassword)
      admin.resetPasswordToken = undefined
      admin.resetPasswordExpires = undefined

      await admin.save()

      await notifyAdmin(
        "Password Reset Successful",
        "Your password has been successfully updated. If this wasn't you, please contact support immediately.",
        "info"
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "Your password has been successfully reset."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminId = getAdminId(req)

      const admin = await AdminModel.findById(adminId).select(
        "userName email lastLogin"
      )

      if (!admin) {
        throw new AppError(httpStatus.NOT_FOUND, "Admin not found.")
      }

      res.status(httpStatus.OK).json({
        success: true,
        data: {
          username: admin.userName,
          email: admin.email,
          lastLogin: admin.lastLogin
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async updateAdminProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminId = getAdminId(req)

      const { email, userName, password } = req.body

      if (!email && !userName && !password) {
        throw new AppError(httpStatus.BAD_REQUEST, "No update fields provided.")
      }

      const admin = await AdminModel.findById(adminId)
      if (!admin) {
        throw new AppError(httpStatus.NOT_FOUND, "Admin not found.")
      }

      // Check email conflict (only if updating)
      if (email && email !== admin.email) {
        const [existingAdmin, existingPatient, existingClinic] =
          await Promise.all([
            AdminModel.findOne({ email }),
            patientModel.findOne({ email }),
            clinicModel.findOne({ email })
          ])

        if (existingAdmin || existingPatient || existingClinic) {
          throw new AppError(
            httpStatus.CONFLICT,
            "An account with this email already exists."
          )
        }

        admin.email = email.toLowerCase().trim()
      }

      if (userName) {
        admin.userName = userName.toLowerCase().trim()
      }

      if (password) {
        const hashed = await hashPassword(password)
        admin.password = hashed
      }

      await admin.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Admin profile updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getAdminNotifications(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const adminId = getAdminId(req)
      const { type, page = 1, limit = 20 } = req.query

      const filter: any = {
        admin: adminId,
        isDeleted: { $ne: true }
      }

      const allowedTypes = [
        "order",
        "test result",
        "claim",
        "wallet",
        "info",
        "warning",
        "alert",
        "subscription"
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
        AdminNotificationModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        AdminNotificationModel.countDocuments(filter)
      ])

      res.status(httpStatus.OK).json({
        success: true,
        message: "Admin notifications fetched successfully.",
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
      const adminId = getAdminId(req)

      const recentNotifications = await AdminNotificationModel.find({
        admin: adminId,
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

      const notificationIds = recentNotifications.map(
        (notification) => notification._id
      )

      await AdminNotificationModel.updateMany(
        { _id: { $in: notificationIds } },
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
      const adminId = getAdminId(req)

      const result = await AdminNotificationModel.updateMany(
        {
          admin: adminId,
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

  public static async verifyClinicStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { clinicId } = req.params
      const { status, reason } = req.body

      if (!["approved", "rejected", "suspended"].includes(status)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Invalid status. Use 'approved', 'rejected', or 'suspended'."
        )
      }

      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      clinic.status = status

      await clinic.save()

      const message =
        status === "approved"
          ? "Your clinic registration has been approved."
          : `Your clinic registration has been ${status}. Reason: ${reason}`

      await clinicNotificationModel.create({
        clinic: clinic._id,
        title: "Clinic Status Update",
        message,
        type: "alert",
        isRead: false
      })

      await notifyAdmin(
        `Clinic ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        `Clinic "${clinic.clinicName}" has been marked as ${status}${reason ? `. Reason: ${reason}` : ""}`,
        "info"
      )

      // Optionally send email
      await SmtpServiceClinic.sendStatusUpdateEmail(clinic, status, reason)
        .then(() => {
          console.log("email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending email:", error)
        })

      res.status(httpStatus.OK).json({
        success: true,
        message: `Clinic has been ${status} successfully.`
      })
    } catch (error) {
      next(error)
    }
  }

  public static async verifyClinicCertificate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { clinicId } = req.params
      const { status, rejectionReason } = req.body

      if (!["approved", "rejected"].includes(status)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Invalid status. Use 'approved' or 'rejected'."
        )
      }

      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      // if (!clinic.certificate || !clinic.certificate.file) {
      //   throw new AppError(
      //     httpStatus.BAD_REQUEST,
      //     "Clinic has not uploaded a certificate."
      //   )
      // }

      clinic.certificate.status = status
      clinic.certificate.status = status
      if (status === "rejected") {
        clinic.certificate.rejectionReasons.push(rejectionReason)
      }
      await clinic.save()

      const notificationMessage =
        status === "approved"
          ? "Your clinic certificate has been approved."
          : `Your clinic certificate has been rejected. Reason: ${rejectionReason}`

      await clinicNotificationModel.create({
        clinic: clinic?._id,
        title: "Certificate Verification Update",
        message: notificationMessage,
        type: "info",
        isRead: false
      })

      // Send email notification
      await SmtpServiceClinic.sendCertificateStatusEmail(
        clinic,
        status,
        status === "rejected" ? rejectionReason : undefined
      )
        .then(() => {
          console.log("email sent successfully.")
        })
        .catch((error) => {
          console.error("Error sending email:", error)
        })

      res.status(httpStatus.OK).json({
        success: true,
        message: `Clinic certificate has been ${status} successfully.`
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getClinicByAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params

      const clinic = await clinicModel
        .findById(id)
        .select(
          "-password -resetPasswordToken -resetPasswordExpires -tests -termsAccepted"
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

      // 👇 Get total number of tests
      const testCount = await clinicModel.findById(id).select("tests").lean()

      const totalTests = testCount?.tests?.length || 0

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic information retrieved successfully.",
        data: {
          ...clinic.toObject(),
          totalTests
        }
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
      const { clinicId } = req.params

      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      const {
        clinicName,
        email,
        phoneNo,
        stateOrProvince,
        cityOrDistrict,
        street,
        postalCode,
        coordinates,
        country,
        supportInsurance,
        onlineStatus,
        contractAccepted
      } = req.body

      // 🔍 Check email uniqueness
      if (email && email !== clinic.email) {
        const [existingPatient, existingClinic] = await Promise.all([
          patientModel.findOne({ email }),
          clinicModel.findOne({ email, _id: { $ne: clinicId } })
        ])

        if (existingPatient || existingClinic) {
          throw new AppError(
            httpStatus.CONFLICT,
            "An account with this email already exists."
          )
        }

        clinic.email = email
      }

      // 📞 Check phone number uniqueness
      if (phoneNo && phoneNo !== clinic.phoneNo) {
        const [existingPatientPhone, existingClinicPhone] = await Promise.all([
          patientModel.findOne({ phoneNumber: phoneNo }),
          clinicModel.findOne({ phoneNo, _id: { $ne: clinicId } })
        ])

        if (existingPatientPhone || existingClinicPhone) {
          throw new AppError(
            httpStatus.CONFLICT,
            "Phone number is already in use."
          )
        }

        clinic.phoneNo = phoneNo
      }

      if (clinicName) clinic.clinicName = clinicName
      if (onlineStatus) clinic.onlineStatus = onlineStatus
      if (country) clinic.country = country

      // 📍 Location updates
      clinic.location ??= {
        stateOrProvince: "",
        cityOrDistrict: "",
        street: "",
        postalCode: "",
        coordinates: { latitude: 0, longitude: 0 }
      }

      if (stateOrProvince) clinic.location.stateOrProvince = stateOrProvince
      if (cityOrDistrict) clinic.location.cityOrDistrict = cityOrDistrict
      if (street) clinic.location.street = street
      if (postalCode) clinic.location.postalCode = postalCode
      if (coordinates) clinic.location.coordinates = coordinates
      if (typeof contractAccepted === "boolean") {
        clinic.contractAccepted = contractAccepted
      }

      if (supportInsurance) clinic.supportInsurance = supportInsurance

      await clinic.save()

      io.emit("clinic:update", {
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
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic profile updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getSubscriptionStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscriptionStats = await subscriptionModel.aggregate([
        {
          $group: {
            _id: "$planName",
            totalSubscribers: { $sum: 1 }
          }
        }
      ])

      const lastMonthStats = await subscriptionModel.aggregate([
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
      ])

      const lastMonthMap = new Map(
        lastMonthStats.map((stat) => [
          stat._id.toLowerCase(),
          stat.totalSubscribers
        ])
      )

      const allowedPlans = ["standard", "premium"]

      const statsWithPercentage = allowedPlans.map((plan) => {
        const currentPlanStat = subscriptionStats.find(
          (stat) => stat._id.toLowerCase() === plan
        )
        const currentCount = currentPlanStat
          ? currentPlanStat.totalSubscribers
          : 0
        const lastMonthCount = lastMonthMap.get(plan) || 0

        const percentageIncrease =
          lastMonthCount > 0
            ? ((currentCount - lastMonthCount) / lastMonthCount) * 100
            : currentCount > 0
              ? 100
              : 0

        return {
          planName: plan,
          totalSubscribers: currentCount,
          percentageIncrease: parseFloat(percentageIncrease.toFixed(2))
        }
      })

      res.status(httpStatus.OK).json({
        success: true,
        data: statsWithPercentage
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getStats(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const totalPatients = await patientModel.countDocuments({
        isDeleted: { $ne: true }
      })
      const customersWithOrders = await orderModel.distinct("patient")
      const customersWithoutOrders = totalPatients - customersWithOrders.length

      res.status(httpStatus.OK).json({
        success: true,
        message: "Customer stats retrieved successfully.",
        data: {
          customersWithOrders: customersWithOrders.length,
          customersWithoutOrders
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getEarningsOverview(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
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
        message: "Global earnings overview retrieved successfully.",
        data: formattedData
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getSalesData(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
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

      const salesData = await orderModel.aggregate([
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
      ])

      const formattedData = salesData.map((entry) => ({
        period: entry._id,
        sales: entry.totalSales
      }))

      res.status(httpStatus.OK).json({
        success: true,
        message: "Global sales data retrieved successfully.",
        data: formattedData
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getPopularTests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const popularTests = await testBookingModel.aggregate([
        {
          $match: { status: { $in: ["booked", "completed"] } }
        },
        { $group: { _id: "$test", totalBookings: { $sum: 1 } } },
        { $sort: { totalBookings: -1 } },
        { $limit: 2 }
      ])

      const testIds = popularTests.map((test) => test._id)
      const testDetails = await testModel
        .find({ _id: { $in: testIds } })
        .sort({ createdAt: -1 })
        .select("testName price")

      const formattedTests = popularTests.map((test) => {
        const testInfo = testDetails.find(
          (t) => t._id?.toString() === test._id.toString()
        )
        return {
          testName: testInfo?.testName || "Unknown Test",
          price: testInfo?.price || 0,
          totalBookings: test?.totalBookings
        }
      })

      res.status(httpStatus.OK).json({
        success: true,
        data: formattedTests
      })
    } catch (error) {
      next(error)
    }
  }

  // tests
  public static async getAllTests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { search, filter, page = "1", limit = "10" } = req.query

      const pageNumber = Math.max(parseInt(page as string, 10), 1)
      const limitNumber = Math.max(parseInt(limit as string, 10), 1)

      // 🔑 Build query: all tests, not deleted
      const query: Record<string, any> = {
        isDeleted: false
      }

      // Optional search filter
      if (typeof search === "string" && search.trim() !== "") {
        const regex = new RegExp(search, "i")
        query.testName = { $regex: regex }
      }

      // Optional lifeline filter
      if (filter === "lifeline") {
        query.coveredByLifeLine = true
      }

      // 🔢 Total tests that match
      const totalTests = await testModel.countDocuments(query)
      const totalPages = Math.max(Math.ceil(totalTests / limitNumber), 1)
      const safePage = Math.min(pageNumber, totalPages)
      const skip = (safePage - 1) * limitNumber

      // 🔄 Fetch paginated tests including clinic field
      const [tests, testItemData] = await Promise.all([
        testModel
          .find(query)
          .limit(limitNumber)
          .skip(skip)
          .sort({ createdAt: -1 }),
        testItem.find().select("name image")
      ])

      // 🖼️ Map testImage and clinic info from testItem and clinicModel
      const data = await Promise.all(
        tests.map(async (test) => {
          const testImage =
            testItemData.find(
              (cat) => cat.name.toLowerCase() === test?.testName?.toLowerCase()
            )?.image || ""

          const clinicData = await clinicModel
            .findById(test.clinic)
            .select("avatar clinicName")
            .lean()

          return {
            ...test.toObject(),
            testImage,
            clinicImage: clinicData?.avatar || null,
            clinicName: clinicData?.clinicName || null
          }
        })
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "All tests retrieved successfully.",
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

  public static async getTestDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      const test = await testModel.findById(id)
      if (!test) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found.")
      }

      const clinic = await clinicModel
        .findById(test.clinic)
        .select("clinicName avatar")
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      // 🔍 Match TestItem to get image + icon
      const testItemData = await testItem.findOne({
        name: { $regex: new RegExp(`^${test.testName}$`, "i") }
      })

      const testData = test.toObject()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test details retrieved successfully.",
        data: {
          ...testData,
          clinicName: clinic.clinicName,
          clinicAvatar: clinic.avatar,
          testImage: testItemData?.image,
          testIcon: testItemData?.icon
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getAllTestItem(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tests = await testItem
        .find()
        .select("clinic name")
        .populate("clinic", "clinicNo")
        .collation({ locale: "en", strength: 2 })
        .sort({ name: 1 })

      res.status(200).json({
        success: true,
        message: "Test Item retrieved successfully.",
        data: tests
      })
    } catch (error) {
      next(error)
    }
  }

  public static async addTestItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["name"])
      const { name, image, icon } = req.body

      const existing = await testItem.findOne({
        name: new RegExp(`^${name}$`, "i")
      })
      if (existing) {
        throw new AppError(
          httpStatus.CONFLICT,
          "A test test item with this name already exists."
        )
      }

      await testItem.create({ name, image, icon })

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Test test item added successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Admin Updates a Test
   */
  public static async updateTest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params
      const updates = req.body

      // 🔍 Validate testName against existing test item names
      if (updates?.testName) {
        const testNameLower = updates?.testName?.toLowerCase()

        const existingTestItem = await testItem.findOne({
          name: { $regex: new RegExp(`^${testNameLower}$`, "i") }
        })

        if (!existingTestItem) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            "Invalid test name. The test must exist in the test Item."
          )
        }
      }

      // 🛠 Update test
      const updatedTest = await testModel.findByIdAndUpdate(id, updates, {
        new: true
      })

      if (!updatedTest) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found.")
      }

      io.emit("test:update", {
        testId: updatedTest._id,
        details: updatedTest
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
   * Update a test item (name, image, or icon)
   */
  public static async updateTestItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params
      const { name, image, icon } = req.body

      if (!name && !image && !icon) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "No fields provided to update."
        )
      }

      const test = await testItem.findById(id)
      if (!test) {
        throw new AppError(httpStatus.NOT_FOUND, "Test Item not found.")
      }

      // Check for duplicate name
      if (name && name.toLowerCase() !== test.name.toLowerCase()) {
        const existing = await testItem.findOne({
          name: new RegExp(`^${name}$`, "i"),
          _id: { $ne: id }
        })
        if (existing) {
          throw new AppError(
            httpStatus.CONFLICT,
            "A test Item with this name already exists."
          )
        }
        test.name = name
      }

      if (image) test.image = image
      if (icon) test.icon = icon

      await test.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test Item updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async deleteTestItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      const item = await testItem.findById(id)
      if (!item) {
        throw new AppError(httpStatus.NOT_FOUND, "Test item not found.")
      }

      const testInUse = await testModel.exists({
        testName: new RegExp(`^${item.name}$`, "i")
      })

      if (testInUse) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "This test item is already in use. Please update it instead of deleting."
        )
      }

      await item.deleteOne()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test item deleted successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async deleteTest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { testId } = req.params

      const test = await testModel.findById(testId)

      if (!test) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found.")
      }

      if (test.isDeleted) {
        throw new AppError(httpStatus.BAD_REQUEST, "Test is already deleted.")
      }

      test.isDeleted = true
      await test.save()

      await testBookingModel.deleteMany({
        test: test._id,
        status: "pending"
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test deleted (soft delete) successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  // Get all soft-deleted tests
  public static async getDeletedTests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const deletedTests = await testModel
        .find({ isDeleted: true })
        .sort({ createdAt: -1 })

      // 🔄 Preload all test item to avoid multiple DB queries
      const testItemData = await testItem.find().select("name image")

      const data = deletedTests.map((test) => {
        const testImage = testItemData.find(
          (cat) => cat.name.toLowerCase() === test?.testName?.toLowerCase()
        )?.image

        return {
          ...test.toObject(),
          testImage
        }
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Deleted tests retrieved successfully.",
        data
      })
    } catch (error) {
      next(error)
    }
  }

  // Restore a soft-deleted test
  public static async restoreDeletedTest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { testId } = req.params

      const test = await testModel.findOne({ _id: testId, isDeleted: true })

      if (!test) {
        throw new AppError(httpStatus.NOT_FOUND, "Test not found.")
      }

      if (!test.isDeleted) {
        throw new AppError(httpStatus.BAD_REQUEST, "Test is not deleted.")
      }

      test.isDeleted = false
      await test.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test restored successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  // clinics
  public static async getAllClinics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const sortOrder = req.query.sort === "oldest" ? 1 : -1 // Default to newest
      const skip = (page - 1) * limit

      const filter: any = { isDeleted: false }

      // Filter by contract acceptance if the query param exists
      if (req.query.filterBy === "supported") {
        filter.contractAccepted = true // Only show clinics that have accepted the contract
      }

      // Optional: Filter by clinic status (e.g., approved, pending, etc.)
      if (req.query.status) {
        filter.status = req.query.status
      }

      const total = await clinicModel.countDocuments(filter)

      const clinics = await clinicModel
        .find(filter)
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit)
        .select(
          "clinicId _id clinicName phoneNo email location status contractAccepted"
        )

      const formatted = clinics.map((clinic) => ({
        id: clinic?._id,
        clinicId: clinic?.clinicId,
        clinicName: clinic?.clinicName,
        phoneNo: clinic?.phoneNo,
        email: clinic?.email,
        country: clinic?.country,
        location: clinic?.location,
        status: clinic?.status,
        contractAccepted: clinic?.contractAccepted
      }))

      res.status(httpStatus.OK).json({
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
      })
    } catch (error) {
      next(error)
    }
  }

  //  Get patient statistics including all patients, members, and active patients
  public static async getPatientMetrics(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const startOfLastMonth = moment()
        .subtract(1, "month")
        .startOf("month")
        .toDate()
      const endOfLastMonth = moment()
        .subtract(1, "month")
        .endOf("month")
        .toDate()

      const allPatients = await patientModel
        .find({ isDeleted: false })
        .select("avatar")
        .lean()

      const members = await subscriptionModel
        .distinct("patient")
        .then((list) => list?.length)

      const lastMonthMembers = await subscriptionModel
        .distinct("patient", {
          startDate: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        })
        .then((list) => list?.length)

      const activeSubscriptions = await subscriptionModel
        .find({ status: "active" })
        .select("patient")
        .lean()

      const lastMonthActivePatients = await subscriptionModel
        .distinct("patient", {
          status: "active",
          startDate: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        })
        .then((list) => list?.length)

      const activePatientIds = activeSubscriptions.map((sub) => sub.patient)

      const activePatients = await patientModel
        .find({
          _id: { $in: activePatientIds },
          isDeleted: false
        })
        .select("avatar")
        .lean()

      const activeData = activePatients.map((p) => p.avatar).filter(Boolean)

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
            images: activeData?.length ? activeData.slice(0, 5) : undefined
          }
        }
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

      // 1️⃣ Fetch all patients
      const allPatients = await patientModel
        .find()
        .sort({ createdAt: -1 })
        .select("patientId fullName email phoneNumber isVerified")
        .lean()

      const totalPatients = allPatients.length

      // 2️⃣ Fetch subscriptions for all patients
      const subscriptions = await subscriptionModel
        .find({ patient: { $in: allPatients.map((p) => p._id) } })
        .select("patient status")
        .lean()

      const patientStatusMap = subscriptions.reduce(
        (acc, sub) => {
          acc[sub.patient.toString()] = sub.status.toLowerCase()
          return acc
        },
        {} as Record<string, string>
      )

      // 3️⃣ Format and filter patients before pagination
      let formattedPatients = allPatients.map((p) => ({
        patientId: p.patientId,
        patientName: p.fullName,
        email: p.email,
        phoneNumber: p.phoneNumber,
        isVerified: p.isVerified,
        status: patientStatusMap[p._id.toString()] || "not member"
      }))

      // Apply filter by status BEFORE pagination
      if (
        status &&
        ["active", "locked", "expired"].includes(
          status.toString().toLowerCase()
        )
      ) {
        formattedPatients = formattedPatients.filter(
          (p) => p.status === status.toString().toLowerCase()
        )
      }

      // 4️⃣ Pagination after filtering
      const totalFiltered = formattedPatients.length
      const paginatedPatients = formattedPatients.slice(skip, skip + limit)

      res.status(httpStatus.OK).json({
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
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Admin Views Patient Claim History
   */
  public static async getPatientClaimHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { patientId } = req.params

      const patient = await patientModel.findOne({ patientId })
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const subscription = await subscriptionModel.findOne({
        patient: patient._id,
        planName: "premium",
        status: "active"
      })

      if (!subscription) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Only Premium subscribers have access to claim history."
        )
      }

      const claims = await claimModel
        .find({ patient: patient._id })
        .select("claimNo testName testNo cost date time clinic")
        .sort({ date: -1 })
        .lean()

      const claimsWithCurrency = await Promise.all(
        claims.map(async (claim) => {
          const clinic = await clinicModel
            .findById(claim.clinic)
            .select("currencySymbol")
            .lean()

          return {
            ...claim,
            currencySymbol: clinic?.currencySymbol || ""
          }
        })
      )

      const balance = subscription.privilege

      res.status(httpStatus.OK).json({
        success: true,
        message: "Patient claim history retrieved successfully.",
        data: {
          patientName: patient.fullName,
          subscription: subscription.planName,
          privilege: subscription.initialPrivilege,
          balance,
          claims: claimsWithCurrency
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Admin Gets All Claims (With Pagination, Search, and Date Filtering)
   */
  public static async getAllClaims(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        page = "1",
        limit = "10",
        status = "",
        search = "",
        date
      } = req.query

      const pageNumber = parseInt(page as string, 10)
      const limitNumber = parseInt(limit as string, 10)
      const skip = (pageNumber - 1) * limitNumber

      const query: Record<string, unknown> = {}

      // 🔹 Filter by status (optional)
      if (typeof status === "string" && status.trim() !== "") {
        query.status = status.toLowerCase()
      }

      // 🔍 Search by testName or patient fullName
      if (typeof search === "string" && search.trim() !== "") {
        query.$or = [
          { testName: { $regex: search, $options: "i" } },
          {
            patient: {
              $in: await patientModel
                .find({ fullName: { $regex: search, $options: "i" } })
                .distinct("_id")
            }
          }
        ]
      }

      // 📅 Exact Date Filtering (matches only a specific date)
      if (typeof date === "string" && date.trim() !== "") {
        const specificDate = new Date(date)
        specificDate.setHours(0, 0, 0, 0)
        const nextDay = new Date(specificDate)
        nextDay.setDate(nextDay.getDate() + 1)

        query.date = { $gte: specificDate, $lt: nextDay }
      }

      // 🔍 Total claims in DB (unfiltered)
      const totalClaimsInDatabase = await claimModel.countDocuments()

      // 🔄 Fetch claims + total (filtered)
      const [claims, totalClaims] = await Promise.all([
        claimModel
          .find(query)
          .populate("patient", "fullName")
          .select("claimNo patient testName cost date clinic")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .lean(),
        claimModel.countDocuments(query)
      ])

      // 💸 Attach currencySymbol from clinic
      const claimsWithCurrency = await Promise.all(
        claims.map(async (claim) => {
          const clinic = await clinicModel
            .findById(claim.clinic)
            .select("currencySymbol clinicName email")
            .lean()

          return {
            ...claim,
            clinicName: clinic?.clinicName,
            clinicEmail: clinic?.email,
            currencySymbol: clinic?.currencySymbol
          }
        })
      )

      // 📦 If no claims, respond accordingly
      if (!claims.length) {
        return res.status(httpStatus.OK).json({
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
        })
      }

      // ✅ Success Response
      res.status(httpStatus.OK).json({
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
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Admin Views All Clinic Orders
   */
  public static async getAllOrders(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { page = "1", limit = "10", paymentMethod, date } = req.query

      const pageNumber = parseInt(page as string, 10) || 1
      const limitNumber = parseInt(limit as string, 10) || 10
      const skip = (pageNumber - 1) * limitNumber

      const filter: Record<string, unknown> = {}

      if (paymentMethod) {
        const pm = (paymentMethod as string).toLowerCase()
        if (pm === "momo") {
          filter.paymentMethod = "pawa_pay"
        } else if (pm === "bank transfer") {
          filter.paymentMethod = "yellow_card"
        } else {
          filter.paymentMethod = pm
        }
      }

      if (date) {
        const startDate = new Date(date as string)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(date as string)
        endDate.setHours(23, 59, 59, 999)
        filter.createdAt = { $gte: startDate, $lte: endDate }
      }

      const orders = await orderModel
        .find(filter)
        .select(
          "orderId patient tests totalAmount createdAt paymentMethod clinic"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean()

      const totalOrdersInDatabase = await orderModel.countDocuments()

      const formattedOrders = await Promise.all(
        orders.map(async (order) => {
          const patient = await patientModel
            .findById(order.patient)
            .select("fullName")
            .lean()

          const clinic = await clinicModel
            .findById(order.clinic)
            .select("clinicName")
            .lean()

          let currencySymbol = "RWF"
          if (order.tests?.length > 0 && order.tests[0]?.test) {
            const testRef = order.tests[0].test
            const testDoc = await testModel
              .findById(testRef)
              .select("currencySymbol")
              .lean()
            if (testDoc?.currencySymbol) {
              currencySymbol = testDoc.currencySymbol
            }
          }

          const testNames = (() => {
            const names = order.tests?.map((t) => t.testName) || []
            if (names.length === 0) return "N/A"
            if (names.length <= 2) return names.join(", ")
            return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`
          })()

          const testStatuses = order.tests?.map((t) => t.status) || []
          const uniqueStatuses = [...new Set(testStatuses)]
          let overallStatus = "pending"
          if (uniqueStatuses.length === 1) {
            overallStatus = uniqueStatuses[0]
          } else {
            overallStatus = "mixed"
          }

          const testResults = await testResultModel
            .find({
              patient: order.patient,
              order: order._id,
              test: { $in: order.tests?.map((t) => t.test) || [] }
            })
            .select("resultSent")
            .lean()

          const resultSent = testResults.some((tr) => tr.resultSent === true)

          return {
            id: order._id,
            orderId: order.orderId,
            CustomerName: patient?.fullName || "N/A",
            Clinic: clinic?.clinicName || "N/A",
            Test: testNames,
            Date: order.createdAt
              ? `${new Date(order.createdAt).getDate()}-${String(
                  new Date(order.createdAt).getMonth() + 1
                ).padStart(2, "0")}-${new Date(order.createdAt).getFullYear()}`
              : "N/A",
            Time: order.createdAt
              ? new Date(order.createdAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true
                })
              : "N/A",
            PaymentMethod:
              order?.paymentMethod === "pawa_pay"
                ? "momo"
                : order?.paymentMethod === "yellow_card"
                  ? "bank transfer"
                  : order?.paymentMethod,
            price: order.totalAmount,
            currencySymbol,
            Status: overallStatus,
            resultSent
          }
        })
      )

      const totalOrders = await orderModel.countDocuments(filter)

      res.status(httpStatus.OK).json({
        success: true,
        message: "All orders retrieved successfully.",
        hasNoOrders: totalOrdersInDatabase === 0,
        data: formattedOrders,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalOrders / limitNumber),
          totalOrders
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Admin Views a Specific Order Details
   */
  public static async getOrderDetailsByAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { orderId } = req.params

      const order = await orderModel
        .findById(orderId)
        .populate("patient", "fullName email phoneNumber")
        .select("-__v")
        .lean()

      if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, "Order not found.")
      }

      const clinic = await clinicModel
        .findById(order.clinic)
        .select("currencySymbol clinicName email clinicId")
        .lean()

      const currencySymbol = clinic?.currencySymbol || "₦"

      const allTestItems = await testItem.find().select("name image").lean()

      const testResults = await testResultModel
        .find({
          clinic: order.clinic,
          patient: order.patient,
          order: order._id,
          test: { $in: order.tests.map((t) => t.test) }
        })
        .select("test resultSent")
        .lean()

      const testResultMap = new Map<string, boolean>()
      testResults.forEach((tr) => {
        testResultMap.set(tr.test.toString(), tr.resultSent ?? false)
      })

      const testsWithDetails = await Promise.all(
        order.tests.map(async (test: any) => {
          const testDoc = await testModel
            .findById(test.test)
            .select("currencySymbol image")
            .lean()

          const fallbackImage =
            allTestItems.find(
              (item) => item.name.toLowerCase() === test.testName.toLowerCase()
            )?.image || ""

          const resultSent = testResultMap.get(test.test.toString()) || false

          return {
            _id: test._id,
            testName: test.testName,
            price: test.price,
            currencySymbol: testDoc?.currencySymbol,
            image: fallbackImage,
            resultSent,
            status: test.status,
            rejectionReason: test.rejectionReason || null,
            statusHistory: test.statusHistory || []
          }
        })
      )

      const paymentMethodLabel =
        order.paymentMethod === "pawa_pay"
          ? "momo with pawapay"
          : order.paymentMethod === "yellow_card"
            ? "bank transfer with yellow card"
            : order.paymentMethod

      const orderWithDetails = {
        ...order,
        tests: testsWithDetails,
        insuranceDetails:
          order.paymentMethod === "insurance"
            ? order.insuranceDetails
            : undefined,
        currencySymbol,
        clinicInfo: clinic
          ? {
              clinicId: clinic.clinicId,
              clinicName: clinic.clinicName,
              clinicEmail: clinic.email
            }
          : undefined,
        paymentMethodLabel,
        deliveryMethod: mapDeliveryMethod(order.deliveryMethod)
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Order details retrieved successfully.",
        data: orderWithDetails
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Admin Views Clinic Claim History
   */
  public static async getClinicClaimsHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { clinicId } = req.params
      const { month, year } = req.query

      const currentYear = moment().year()
      const selectedYear = year ? parseInt(year as string) : currentYear
      const selectedMonth = month
        ? parseInt(month as string)
        : moment().month() + 1

      // 🔍 Check if clinic exists
      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      // 🧾 Check if the clinic has any claims at all
      const totalClaimsForClinic = await claimModel.countDocuments({
        clinic: clinicId
      })

      if (totalClaimsForClinic === 0) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "This clinic has no claims yet."
        )
      }

      // 📅 Set date filter range
      const startDate = moment(
        `${selectedYear}-${selectedMonth}-01`,
        "YYYY-MM-DD"
      ).startOf("month")
      const endDate = moment(startDate).endOf("month")

      // 🔎 Fetch claims for month
      const claims = await claimModel
        .find({
          clinic: clinicId,
          date: { $gte: startDate.toDate(), $lte: endDate.toDate() }
        })
        .sort({ date: -1 })

      // 🧮 Calculate money owed
      const moneyOwed = claims.reduce((total, claim) => total + claim.cost, 0)

      // 📋 Format claims
      const claimsWithDetails = await Promise.all(
        claims.map(async (claim) => {
          const patient = await patientModel
            .findById(claim.patient)
            .select("fullName")
          return {
            claimId: claim.claimNo,
            patientName: patient?.fullName,
            testName: claim.testName,
            date: moment(claim.date).format("DD-MM-YYYY"),
            cost: `${clinic.currencySymbol} ${claim.cost.toFixed(2)}`
          }
        })
      )

      if (claims.length === 0) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "No claims found for the selected period."
        )
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Claims retrieved successfully.",
        hasNoClaims: false,
        clinicName: clinic.clinicName,
        moneyOwed: `${clinic.currencySymbol} ${moneyOwed.toFixed(2)}`,
        claims: claimsWithDetails
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get overall clinic metrics including all clinics and supported clinics
   */
  public static async getClinicMetrics(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const startOfLastMonth = moment()
        .subtract(1, "month")
        .startOf("month")
        .toDate()

      const endOfLastMonth = moment()
        .subtract(1, "month")
        .endOf("month")
        .toDate()

      // 🔹 All clinics
      const allClinics = await clinicModel
        .find()
        .select("_id contractAccepted createdAt")
        .lean()
      const supportedClinics = allClinics.filter((c) => c.contractAccepted)

      // 🔹 Clinics created last month
      const lastMonthClinics = allClinics?.filter(
        (c) =>
          moment(c.createdAt).isSameOrAfter(startOfLastMonth) &&
          moment(c.createdAt).isSameOrBefore(endOfLastMonth)
      )

      const lastMonthSupported = lastMonthClinics.filter(
        (c) => c.contractAccepted
      )

      const percentChange = (current: number, prev: number) =>
        prev > 0 ? ((current - prev) / prev) * 100 : 0

      const percentageChangeAll = percentChange(
        allClinics.length,
        lastMonthClinics.length
      )
      const percentageChangeSupported = percentChange(
        supportedClinics.length,
        lastMonthSupported.length
      )

      res.status(httpStatus.OK).json({
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

  public static async purgeClinicOrPatient(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { patientEmail, password } = req.body

      // Get the main clinic
      const mainClinic = await clinicModel.findOne({
        email: "damilolasanni48@gmail.com"
      })
      if (!mainClinic) {
        return res
          .status(404)
          .json({ success: false, message: "Main clinic not found." })
      }

      // DELETE PATIENT if patientEmail is provided
      if (patientEmail) {
        if (
          !password ||
          !(await comparePasswords(password, mainClinic.password))
        ) {
          return res.status(403).json({
            success: false,
            message: "Unauthorized: Incorrect password."
          })
        }

        const patient = await patientModel.findOne({ email: patientEmail })
        if (!patient) {
          return res.status(404).json({
            success: false,
            message: `Patient ${patientEmail} not found.`
          })
        }

        const patientId = patient._id
        await orderModel.deleteMany({ patient: patientId })
        await testBookingModel.deleteMany({ patient: patientId })
        await testResultModel.deleteMany({ patient: patientId })
        await patientNotificationModel.deleteMany({ patient: patientId })
        await reviewModel.deleteMany({ patient: patientId })
        await patientModel.deleteOne({ _id: patientId })

        return res.status(200).json({
          success: true,
          message: `Patient ${patientEmail} deleted successfully.`
        })
      }

      // DELETE main clinic data (not the clinic itself)
      const clinicId = mainClinic._id
      await claimModel.deleteMany({ clinic: clinicId })
      await clinicNotificationModel.deleteMany({ clinic: clinicId })
      await orderModel.deleteMany({ clinic: clinicId })
      await testResultModel.deleteMany({ clinic: clinicId })
      await testBookingModel.deleteMany({ clinic: clinicId })
      await testModel.deleteMany({ clinic: clinicId })
      await reviewModel.deleteMany({ clinic: clinicId })
      await clinicModel.updateOne({ _id: clinicId }, { $set: { balance: 0 } })

      return res.status(200).json({
        success: true,
        message:
          "All data for the main clinic has been purged. Clinic account preserved."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async createSingleClinic(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = req.body

      if (!data || typeof data !== "object") {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid clinic payload.")
      }

      const { email } = data

      // Check if the email already exists in patients, clinics, or admins
      const existingPatientByEmail = await patientModel.findOne({ email })
      const existingClinicByEmail = await clinicModel.findOne({ email })
      const existingAdminByEmail = await AdminModel.findOne({ email })

      if (
        existingPatientByEmail ||
        existingClinicByEmail ||
        existingAdminByEmail
      ) {
        throw new AppError(
          httpStatus.CONFLICT,
          "An account with this email already exists."
        )
      }

      const currencySymbol =
        COUNTRIES.find((c) => c.value.toLowerCase() === "rwanda")
          ?.currencySymbol || "RWF"

      const defaultPassword = await hashPassword("Clinic@123")

      const clinic = new clinicModel({
        ...data,
        password: defaultPassword,
        termsAccepted: true,
        currencySymbol,
        isVerified: true,
        status: "pending"
      })

      await clinic.save()

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Clinic created successfully"
      })
    } catch (error) {
      next(error)
    }
  }

  public static async clearAllSubscriptions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await subscriptionModel.deleteMany({})
      res.status(httpStatus.OK).json({
        success: true,
        message: "All subscriptions have been cleared.",
        deletedCount: result.deletedCount
      })
    } catch (error) {
      next(error)
    }
  }

  public static async clearAdminNotifications(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const adminId = getAdminId(req)

      await AdminNotificationModel.deleteMany({ admin: adminId })

      res.status(httpStatus.OK).json({
        success: true,
        message: "All notifications cleared successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async createPractitionerCategory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["name", "type"])

      const { name, type, description } = req.body

      const exists = await practitionerCategoryModel.exists({
        name: new RegExp(`^${name}$`, "i"),
        type
      })

      if (exists) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Category already exists for this type."
        )
      }

      await practitionerCategoryModel.create({
        name,
        type,
        description
      })

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Category created successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async updatePractitionerCategory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params
      const { name, type, description } = req.body

      const category = await practitionerCategoryModel.findById(id)
      if (!category) {
        throw new AppError(httpStatus.NOT_FOUND, "Category not found.")
      }

      category.name = name || category.name
      category.type = type || category.type
      category.description = description || category.description

      await category.save()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Category updated successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async deletePractitionerCategory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      const category = await practitionerCategoryModel.findById(id)
      if (!category) {
        throw new AppError(httpStatus.NOT_FOUND, "Category not found.")
      }

      const categoryInUse = await clinicModel.exists({ categories: id })
      if (categoryInUse) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Category is in use by one or more clinics. Cannot delete."
        )
      }

      await category.deleteOne()

      res.status(httpStatus.OK).json({
        success: true,
        message: "Category deleted successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  static async getAllCategoriesForAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const categories = await practitionerCategoryModel
        .find()
        .sort({ createdAt: -1 })

      res.status(httpStatus.OK).json({
        success: true,
        data: categories
      })
    } catch (error) {
      next(error)
    }
  }
}
