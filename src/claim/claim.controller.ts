import { Request, Response, NextFunction } from "express"
import httpStatus from "http-status"
import claimModel from "./claim.model"
import patientModel from "../patient/patient.model"
import subscriptionModel from "../subscription/subscription.model"
import testModel from "../test/test.model"
import AppError from "../utils/app.error"
import { getClinicId } from "../utils"
import "dotenv/config"
import ClaimEmailService from "../smtp/claim/smtp.claim.service"
import clinicModel from "../clinic/clinic.model"
import clinicNotificationModel from "../clinic/clinic.notification.model"
import moment from "moment"
import patientNotificationModel from "../patient/patient.notification.model"
import { sendPushNotification } from "../utils/sendPushNotification"
import adminNotificationModel from "../admin/admin.notification.model"
import adminModel from "../admin/admin.model"
import { io } from ".."

export default class ClaimController {
  /**
   * Clinic Adds a Claim (Only for Premium Subscription Patients)
   */
  public static async addClaim(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const { testId, patientEmail } = req.body

      const patient = await patientModel.findOne({ email: patientEmail })
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
          "Only Premium Plan subscribers can make claims."
        )
      }

      const currentDate = moment()
      const cooldownDays = parseInt(process.env.ORDER_COOLDOWN_DAYS ?? "0")
      const cooldownEndDate = moment(subscription.startDate).add(
        cooldownDays,
        "days"
      )

      const lastClaim = await claimModel
        .findOne({ patient: patient._id })
        .sort({ date: -1 })

      if (lastClaim) {
        const lastClaimDate = moment(lastClaim.date).add(cooldownDays, "days")

        if (currentDate.isBefore(lastClaimDate)) {
          throw new AppError(
            httpStatus.FORBIDDEN,
            `You can only make a claim every ${cooldownDays} days. Next claim available on ${lastClaimDate.format("dddd, MMMM D, YYYY")}.`
          )
        }
      }

      const test = await testModel.findOne({ _id: testId, clinic: clinicId })
      if (!test) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "Test not found in this clinic."
        )
      }

      if (subscription.privilege < test.price) {
        throw new AppError(
          httpStatus.PAYMENT_REQUIRED,
          "Insufficient privilege balance to make this claim."
        )
      }

      const currentMonthStart = moment().startOf("month").toDate()
      let currentMonthSpending = subscription.monthlySpending.find((ms) =>
        moment(ms.month).isSame(currentMonthStart, "month")
      )

      if (!currentMonthSpending) {
        currentMonthSpending = {
          month: currentMonthStart,
          totalSpent: test.price
        }
        subscription.monthlySpending.push(currentMonthSpending)
      } else {
        currentMonthSpending.totalSpent += test.price
      }

      subscription.privilege -= test.price
      await subscription.save()

      // Track money owed to the clinic
      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      clinic.totalMoneyOwed = (clinic.totalMoneyOwed || 0) + test.price
      await clinic.save() // Save the updated owed amount

      const currentTime = currentDate.format("hh:mm A")

      const newClaim = await claimModel.create({
        clinic: clinicId,
        patient: patient._id,
        testName: test.testName,
        cost: test.price,
        date: currentDate.toDate(),
        time: currentTime
      })

      const totalSpentThisPeriod = subscription.monthlySpending.reduce(
        (acc, month) => acc + month.totalSpent,
        0
      )

      const claimDetails = {
        claimNo: newClaim?.claimNo,
        testName: test?.testName,
        clinicName: clinic?.clinicName,
        clinicAddress: clinic?.location?.street,
        clinicPhone: clinic?.phoneNo,
        claimDate: currentDate.format("dddd, MMMM D, YYYY"),
        price: test?.price,
        turnaroundTime: test?.turnaroundTime,
        homeCollection: test?.homeCollection || "N/A",
        preTestRequirements: test?.preTestRequirements || "N/A",
        totalSpent: totalSpentThisPeriod,
        remainingBalance: subscription?.privilege,
        nextClaimDate: cooldownEndDate?.format("dddd, MMMM D, YYYY")
      }

      // Send email to patient
      await ClaimEmailService.sendClaimNotificationEmail(patient, claimDetails)
        .then(() => console.log("Claim email sent successfully."))
        .catch((error) => console.log("Error sending Claim email:", error))

      // Patient notification
      const newNotification = await patientNotificationModel.create({
        patient: patient._id,
        title: "New Claim Submitted",
        message: `Your claim for ${test.testName} at ${clinic.clinicName} has been submitted successfully (Claim No: ${newClaim.claimNo}).`,
        type: "claim",
        isRead: false
      })

      if (patient?.expoPushToken) {
        await sendPushNotification({
          expoPushToken: patient.expoPushToken,
          title: newNotification.title,
          message: newNotification.message,
          type: newNotification.type
        })
      }

      // Clinic notification
      await clinicNotificationModel.create({
        clinic: clinicId,
        title: "New Claim Added",
        message: `A new claim (Claim No: ${newClaim.claimNo}) has been added for ${patient.fullName}.`,
        type: "claim",
        isRead: false
      })

      // ✅ Admin notification
      const admin = await adminModel.findOne()
      if (admin) {
        await adminNotificationModel.create({
          admin: admin._id,
          title: "New Claim Submitted",
          message: `A new claim (Claim No: ${newClaim.claimNo}) was submitted by clinic "${clinic.clinicName}" for test "${test.testName}".`,
          type: "claim",
          isRead: false
        })
      }

      io.emit("claim:add", {
        clinicId,
        claimId: newClaim._id,
        patientId: patient._id,
        testName: test.testName,
        cost: test.price,
        claimDate: currentDate.toDate(),
        remainingBalance: subscription.privilege,
        totalSpentThisMonth: currentMonthSpending.totalSpent,
        clinicName: clinic.clinicName
      })

      res.status(httpStatus.CREATED).json({
        success: true,
        message:
          "Claim added successfully. Notification email sent to patient.",
        remainingBalance: subscription.privilege,
        totalSpentThisMonth: currentMonthSpending.totalSpent
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Clinic Gets All Claims (With Pagination, Search, and Date Filtering)
   */
  public static async getAllClaims(
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

      const query: Record<string, unknown> = { clinic: clinicId }

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
        specificDate.setHours(0, 0, 0, 0) // Set to start of the day
        const nextDay = new Date(specificDate)
        nextDay.setDate(nextDay.getDate() + 1) // Move to next day start

        query.date = { $gte: specificDate, $lt: nextDay }
      }

      // Check if there are any claims at all in the database (unfiltered)
      const totalClaimsInDatabase = await claimModel.countDocuments({
        clinic: clinicId
      })

      // Fetch claims with filters
      const [claims, totalClaims] = await Promise.all([
        claimModel
          .find(query)
          .populate("patient", "fullName")
          .select("claimNo patient testName cost date")
          .sort({ createdAt: -1 })
          .limit(limitNumber)
          .skip(skip)
          .lean(),
        claimModel.countDocuments(query)
      ])

      const claimsWithCurrency = claims?.map((claim) => ({
        ...claim,
        currencySymbol: clinic.currencySymbol
      }))

      // If no claims found, return a "No claims found" message
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
   * Clinic Views Patient Claim History
   */
  public static async getPatientClaimHistory(
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

      const { patientId } = req.params

      const patient = await patientModel.findOne({ patientId })
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const subscription = await subscriptionModel.findOne({
        patient: patient._id,
        status: "active",
        planName: "premium"
      })

      if (!subscription) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Only Premium subscribers have claim history."
        )
      }

      const claims = await claimModel
        .find({ patient: patient._id, clinic: clinicId })
        .select("claimNo testName testNo cost date time")
        .sort({ date: -1 })
        .lean()

      const claimsWithCurrency = claims.map((claim) => ({
        ...claim,
        currencySymbol: clinic.currencySymbol
      }))

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

  public static async clearPatientClaims(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const email = req.params.email?.toLowerCase().trim()

      if (!email) {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "Email is required in the URL."
        })
        return
      }

      const patient = await patientModel.findOne({ email })

      if (!patient) {
        res.status(httpStatus.NOT_FOUND).json({
          success: false,
          message: "Patient not found."
        })
        return
      }

      // Delete claims
      const result = await claimModel.deleteMany({ patient: patient._id })

      // Reset subscription spending safely
      const subscription = await subscriptionModel.findOne({
        patient: patient._id
      })

      if (subscription) {
        subscription.monthlySpending = []
        subscription.markModified("monthlySpending")
        await subscription.save()
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: `All claims cleared for patient ${email}.`,
        deletedCount: result.deletedCount
      })
    } catch (error) {
      next(error)
    }
  }
}
