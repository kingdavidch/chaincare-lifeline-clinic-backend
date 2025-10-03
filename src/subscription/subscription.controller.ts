import { Request, Response, NextFunction } from "express"
import httpStatus from "http-status"
import AppError from "../utils/app.error"
import { getPatientId, handleRequiredFields } from "../utils"
import subscriptionModel from "./subscription.model"
import { SUBSCRIPTION_PLANS } from "../constant/subscription.plans"
import axios from "axios"
import { v4 as uuidv4 } from "uuid"
import "dotenv/config"
import patientModel from "../patient/patient.model"
import moment from "moment"

export default class SubscriptionController {
  /**
   * Subscribe to a Plan
   */
  public static async subscribe(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      handleRequiredFields(req, ["id", "mtnNumber"])

      const patient = await patientModel.findById(patientId)
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const { id, mtnNumber } = req.body

      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === id)
      if (!plan) {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid subscription plan.")
      }

      const amountInRWF = plan.price
      if (amountInRWF <= 0) {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment amount.")
      }

      const depositPayload = {
        depositId: uuidv4(),
        amount: amountInRWF.toString(),
        currency: "RWF",
        country: "RWA",
        correspondent: "MTN_MOMO_RWA",
        payer: {
          type: "MSISDN",
          address: { value: mtnNumber }
        },
        customerTimestamp: new Date().toISOString(),
        statementDescription: "Subscription payment",
        metadata: [
          { fieldName: "type", fieldValue: "subscription" },
          { fieldName: "patientId", fieldValue: patientId },
          { fieldName: "subscriptionPlanId", fieldValue: String(plan.id) },
          { fieldName: "customerPhone", fieldValue: mtnNumber }
        ]
      }

      const response = await axios.post(
        `${process.env.PAWAPAY_API_URL}/deposits`,
        depositPayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      )

      if (response.data.status !== "ACCEPTED") {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          response.data.rejectionReason || "Payment not accepted"
        )
      }

      return res.status(httpStatus.OK).json({
        success: true,
        message: "Subscription payment initiated. Awaiting confirmation.",
        paymentStatus: response.data.status,
        depositId: response.data.depositId
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get Patient's Active Subscription
   */
  public static async getActiveSubscription(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      const subscription = await subscriptionModel
        .findOne({ patient: patientId, status: "active" })
        .select(
          "planName price duration includedTests privilege initialPrivilege startDate endDate status isPaid"
        )
        .lean()

      if (!subscription) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "No active subscription found."
        )
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Active subscription retrieved successfully.",
        data: subscription
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Cancel Subscription
   */
  public static async cancelSubscription(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const subscription = await subscriptionModel.findOneAndUpdate(
        { patient: patientId, status: "active" },
        { status: "locked" },
        { new: true }
      )

      if (!subscription) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "No active subscription found to cancel."
        )
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Subscription canceled successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get Patient's Subscription Privilege, Balance and Details
   */
  public static async getPatientPrivilegeAndBalance(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      const patient = await patientModel
        .findById(patientId)
        .select("fullName phoneNumber avatar")
        .lean()

      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const subscription = await subscriptionModel
        .findOne({ patient: patientId, status: "active" })
        .select("planName monthlySpending startDate")
        .lean()

      if (!subscription) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "No active subscription found for this patient."
        )
      }

      const now = moment()
      const startDate = moment(subscription.startDate)
      const hoursSinceStart = now.diff(startDate, "hours")
      const isActive = hoursSinceStart >= 72
      const activationTimeLeft = isActive ? 0 : 72 - hoursSinceStart

      const privilege =
        subscription.planName?.toLowerCase() === "premium" ? 68000 : 0

      const totalSpent =
        subscription.monthlySpending?.reduce(
          (acc, month) => acc + (month?.totalSpent || 0),
          0
        ) ?? 0

      const balance = privilege - totalSpent

      res.status(httpStatus.OK).json({
        success: true,
        message:
          "Patient subscription privilege, balance and details retrieved successfully.",
        data: {
          patientName: patient.fullName,
          phoneNumber: patient.phoneNumber,
          avatar: patient.avatar,
          subscription: subscription.planName,
          privilege,
          balance,
          isActive,
          activationTimeLeft // in hours
        }
      })
    } catch (error) {
      next(error)
    }
  }
}
