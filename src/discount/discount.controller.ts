import { Request, Response, NextFunction } from "express"
import discountModel from "./discount.model"
import clinicModel from "../clinic/clinic.model"
import httpStatus from "http-status"
import AppError from "../utils/app.error"
import { getClinicId, getPatientId, handleRequiredFields } from "../utils"
import moment from "moment"
import { io } from ".."
import patientModel from "../patient/patient.model"
import { sendPushNotification } from "../utils/sendPushNotification"
import { Types } from "mongoose"
import testBookingModel from "../testBooking(Cart)/testBooking.model"

export default class DiscountController {
  public static async createDiscount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const clinicId = getClinicId(req)
      handleRequiredFields(req, ["code", "percentage", "validUntil"])
      const { code, percentage, validUntil } = req.body

      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")

      const existing = await discountModel.findOne({
        code: code.toUpperCase(),
        isDeleted: false
      })

      if (existing) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Discount code already exists. Please choose a different one."
        )
      }

      // ✅ Create new discount
      const discount = await discountModel.create({
        clinic: clinicId,
        code: code.toUpperCase(),
        percentage,
        validUntil: moment(validUntil).toDate(),
        status: 0
      })

      io.emit("discount:create", { clinicId, discount })

      // 🔔 Push notification logic
      const restrictedClinicEmail = "damilolasanni48@gmail.com"
      const allowedPatientEmail = "sannifortune11@gmail.com"

      if (clinic.email === restrictedClinicEmail) {
        // ✅ Only send to the allowed patient
        const patient = await patientModel.findOne({
          email: allowedPatientEmail,
          expoPushToken: { $ne: null },
          isDeleted: false
        })

        if (patient?.expoPushToken) {
          await sendPushNotification({
            expoPushToken: patient.expoPushToken,
            title: "New Discount Available 🎉",
            message: `${clinic.clinicName?.toUpperCase()} is offering ${discount.percentage}% OFF with code ${discount.code}`,
            type: "info",
            data: {
              screen: "one_clinic",
              id: clinic._id.toString(),
              discountId: (discount._id as Types.ObjectId).toString()
            }
          })
        }
      } else {
        // 🌍 Broadcast to all patients
        const patients = await patientModel.find(
          { expoPushToken: { $ne: null }, isDeleted: false },
          { expoPushToken: 1 }
        )

        const pushPayloads = patients.map((p) =>
          sendPushNotification({
            expoPushToken: p.expoPushToken!,
            title: "New Discount Available 🎉",
            message: `${clinic.clinicName?.toUpperCase()} is offering ${discount.percentage}% OFF with code ${discount.code}`,
            type: "info",
            data: {
              screen: "one_clinic",
              id: clinic._id.toString(),
              discountId: (discount._id as Types.ObjectId).toString()
            }
          })
        )

        await Promise.all(pushPayloads)
      }

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Discount created successfully.",
        data: discount
      })
    } catch (error) {
      next(error)
    }
  }

  public static async listClinicDiscounts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const clinicId = getClinicId(req)
      const { page = "1", limit = "10", status, code } = req.query

      const pageNumber = parseInt(page as string, 10) || 1
      const limitNumber = parseInt(limit as string, 10) || 10
      const skip = (pageNumber - 1) * limitNumber

      const filter: Record<string, unknown> = {
        clinic: clinicId,
        isDeleted: false
      }

      if (status !== undefined && status !== "") {
        const parsedStatus = parseInt(status as string, 10)
        if (!isNaN(parsedStatus)) {
          filter.status = parsedStatus
        }
      }

      if (code) {
        filter.code = { $regex: new RegExp(code as string, "i") }
      }

      await discountModel.updateMany(
        { clinic: clinicId, validUntil: { $lt: new Date() }, status: 0 },
        { $set: { status: 1 } }
      )

      const discounts = await discountModel
        .find(filter)
        .select(
          "code percentage status validUntil createdAt updatedAt discountNo"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean()

      const formattedDiscounts = discounts.map((d) => {
        const daysLeft = moment(d.validUntil).diff(moment(), "days")

        let warning: string | null = null
        if (d.status === 0 && daysLeft <= 7 && daysLeft >= 0) {
          warning = `⚠️ Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
        } else if (d.status === 1) {
          warning = "Expired"
        }

        return {
          discountNo: d.discountNo,
          code: d.code,
          percentage: d.percentage,
          status: d.status,
          validUntil: moment(d.validUntil).format("DD MMM YYYY"),
          createdAt: moment(d.createdAt).format("DD MMM YYYY, h:mm A"),
          updatedAt: moment(d.updatedAt).format("DD MMM YYYY, h:mm A"),
          warning
        }
      })

      const totalDiscounts = await discountModel.countDocuments(filter)
      const totalDiscountsInDatabase = await discountModel.countDocuments({
        clinic: clinicId,
        isDeleted: false
      })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Discounts retrieved successfully.",
        hasNoDiscounts: totalDiscountsInDatabase === 0,
        data: formattedDiscounts,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalDiscounts / limitNumber),
          totalDiscounts
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async deleteDiscount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const clinicId = getClinicId(req)
      const { id } = req.params

      const discount = await discountModel.findOneAndUpdate(
        { discountNo: id, clinic: clinicId, isDeleted: false },
        { $set: { isDeleted: true } },
        { new: true }
      )
      if (!discount)
        throw new AppError(httpStatus.NOT_FOUND, "Discount not found.")

      io.emit("discount:delete", { clinicId, discountId: discount._id })

      res.json({ success: true, message: "Discount deleted successfully." })
    } catch (error) {
      next(error)
    }
  }

  public static async getActiveDiscountsForClinic(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { clinicId } = req.params

      await discountModel.updateMany(
        { clinic: clinicId, validUntil: { $lt: new Date() }, status: 0 },
        { $set: { status: 1 } }
      )

      const discounts = await discountModel.find({
        clinic: clinicId,
        validUntil: { $gte: new Date() },
        status: 0,
        isDeleted: false
      })

      res.json({ success: true, data: discounts })
    } catch (error) {
      next(error)
    }
  }

  public static async applyDiscount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["clinicId", "code", "amount"])

      const { clinicId, code, amount } = req.body
      const patientId = getPatientId(req)
      const normalizedCode = code.toUpperCase()
      const now = moment.utc()

      // 🔒 Expire past discounts
      await discountModel.updateMany(
        { clinic: clinicId, validUntil: { $lt: now.toDate() }, status: 0 },
        { $set: { status: 1 } }
      )

      // 🔎 Ensure clinic has active discounts
      const activeDiscounts = await discountModel.countDocuments({
        clinic: clinicId,
        status: 0,
        isDeleted: false,
        validUntil: { $gte: now.toDate() }
      })
      if (activeDiscounts === 0) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "This clinic does not currently have any active discount codes."
        )
      }

      // 🎯 Find exact discount code
      const discount = await discountModel.findOne({
        clinic: clinicId,
        code: normalizedCode,
        status: 0,
        isDeleted: false,
        validUntil: { $gte: now.toDate() }
      })

      if (!discount) {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid discount code.")
      }

      if (!moment(discount.validUntil).isAfter(now)) {
        throw new AppError(httpStatus.BAD_REQUEST, "Discount code has expired.")
      }

      // 💰 Calculate new total
      const finalPrice = amount - (amount * discount.percentage) / 100

      await testBookingModel.updateMany(
        { patient: patientId, clinic: clinicId, status: "pending" },
        {
          $set: {
            "discount.code": discount.code,
            "discount.percentage": discount.percentage,
            "discount.finalPrice": finalPrice,
            "discount.expiresAt": discount.validUntil
          }
        }
      )

      res.json({
        success: true,
        message: "Discount applied successfully.",
        data: {
          discountCode: discount.code,
          percentage: discount.percentage,
          newTotal: finalPrice,
          expiresAt: moment(discount.validUntil).format("YYYY-MM-DD HH:mm:ss")
        }
      })
    } catch (error) {
      next(error)
    }
  }
}
