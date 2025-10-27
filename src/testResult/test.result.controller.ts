/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express"
import httpStatus from "http-status"
import clinicModel from "../clinic/clinic.model"
import clinicNotificationModel from "../clinic/clinic.notification.model"
import orderModel from "../order/order.model"
import patientModel from "../patient/patient.model"
import patientNotificationModel from "../patient/patient.notification.model"
import TestResultEmailService from "../smtp/testResult/smtp.test.result.service"
import testItemModel from "../test/test.item.model"
import testModel from "../test/test.model"
import testBookingModel from "../testBooking(Cart)/testBooking.model"
import {
  getClinicId,
  getPatientId,
  handleRequiredFields,
  uploadToCloudinary
} from "../utils"
import AppError from "../utils/app.error"
import { sendPushNotification } from "../utils/sendPushNotification"
import testResultModel from "./test.result.model"
import { formatCase } from "../order/utils"

export default class TestResultController {
  public static async uploadTestResult(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      handleRequiredFields(req, ["orderId", "testName"])

      const { orderId, testName } = req.body
      const clinicId = getClinicId(req)

      const clinic = await clinicModel.findById(clinicId).select("clinicName")
      if (!clinic) throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")

      const order = await orderModel.findOne({ orderId, clinic: clinicId })
      if (!order) throw new AppError(httpStatus.NOT_FOUND, "Order not found.")

      const patient = await patientModel
        .findById(order.patient)
        .select("fullName email expoPushToken")
      if (!patient)
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")

      const test = await testModel.findOne({
        testName: { $regex: new RegExp(`^${testName.toLowerCase()}$`, "i") },
        clinic: clinicId
      })
      if (!test) throw new AppError(httpStatus.NOT_FOUND, "Test not found.")

      const orderTest = order.tests.find(
        (t) => String(t.test) === String(test._id)
      )
      if (!orderTest) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "This test is not part of this order."
        )
      }

      if (!req.file) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Test result file is required."
        )
      }

      const testBooking = await testBookingModel.findOne({
        patient: patient._id,
        test: test._id,
        clinic: clinicId
      })
      if (!testBooking) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Appointments booking not found for this patient and test."
        )
      }

      const publicId = `${patient.fullName}_${test.testName}.pdf`
      const result = await uploadToCloudinary(
        req.file.buffer,
        "raw",
        "test_results",
        { public_id: publicId }
      )

      const refNo = `REF-${Math.floor(
        100000000000 + Math.random() * 900000000000
      )}`

      const existingResult = await testResultModel.findOne({
        order: order._id,
        test: test._id,
        clinic: clinicId
      })
      if (existingResult) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Result already uploaded for this order and test."
        )
      }

      const testResult = await new testResultModel({
        refNo,
        testBooking: testBooking._id,
        patient: patient._id,
        test: test._id,
        clinic: clinicId,
        order: order._id,
        orderId: order.orderId,
        resultFile: result.secure_url,
        uploadedAt: new Date(),
        resultSent: true
      }).save()

      const statusFlow = [
        "pending",
        "sample_collected",
        "processing",
        "result_ready",
        "result_sent"
      ]

      const currentStatus = orderTest.status
      const currentIndex = statusFlow.indexOf(currentStatus)
      const finalIndex = statusFlow.indexOf("result_sent")

      const statusesToFill =
        currentIndex === -1
          ? statusFlow.slice(0, finalIndex + 1)
          : statusFlow.slice(currentIndex + 1, finalIndex + 1)

      const now = new Date()

      const historyEntries = statusesToFill.map((s) => ({
        status: s,
        changedAt: now
      }))

      await orderModel.updateOne(
        { _id: order._id, "tests.test": test._id },
        {
          $set: {
            "tests.$.status": "result_sent",
            "tests.$.statusReason": "Result uploaded and sent by clinic"
          },
          $push: {
            "tests.$.statusHistory": { $each: historyEntries }
          }
        }
      )

      const newNotification = await patientNotificationModel.create({
        patient: patient._id,
        title: "Test Results Sent",
        message: `Your ${formatCase(
          test.testName
        )} test results have been sent. Reference No: ${refNo}`,
        type: "test result",
        isRead: false,
        metadata: { resultUrl: result.secure_url }
      })

      if (patient.expoPushToken) {
        await sendPushNotification({
          expoPushToken: patient.expoPushToken,
          title: newNotification.title,
          message: newNotification.message,
          type: newNotification.type,
          data: { resultUrl: result.secure_url, screen: "test_history" }
        })
      }

      await TestResultEmailService.sendTestResultEmail(patient, {
        refNo,
        testName: test.testName,
        clinicName: clinic.clinicName,
        testDate: new Date(order.createdAt!).toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short"
        }),
        resultDate: new Date(
          testResult.createdAt || Date.now()
        ).toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short"
        }),
        resultUrl: result.secure_url
      }).catch((error) => console.error("Error sending email:", error))

      await clinicNotificationModel.create({
        clinic: clinicId,
        title: "Test Result Sent",
        message: `Test result for ${patient.fullName} (${test.testName}) has been sent.`,
        type: "test result",
        isRead: false
      })

      res.status(httpStatus.CREATED).json({
        success: true,
        message:
          "Appointments result uploaded and status updated to 'result_sent'."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getClinicTestResults(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const { page = "1", date } = req.query

      const pageNumber = parseInt(page as string, 10) || 1
      const baseLimit = 10
      const limit = baseLimit * pageNumber
      const skip = 0

      const filter: Record<string, unknown> = { clinic: clinicId }

      if (date) {
        const startDate = new Date(date as string)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(date as string)
        endDate.setHours(23, 59, 59, 999)
        filter.uploadedAt = { $gte: startDate, $lte: endDate }
      }

      const testResults = await testResultModel
        .find(filter)
        .select(
          "testBooking test refNo uploadedAt resultFile clinic _id orderId"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()

      const totalTestResultsInDatabase = await testResultModel.countDocuments({
        clinic: clinicId
      })

      const formattedResults = await Promise.all(
        testResults.map(async (result) => {
          const testBooking = await testBookingModel.findById(
            result.testBooking
          )
          if (!testBooking || testBooking.clinic.toString() !== clinicId) {
            return null
          }

          const patient = await patientModel
            .findById(testBooking.patient)
            .select("fullName")

          const test = await testModel
            .findById(result.test)
            .setOptions({ includeDeleted: true })
            .select("testName")
            .lean()

          return {
            id: result._id,
            refNo: result.refNo,
            orderId: result.orderId,
            patientName: patient?.fullName,
            testName: test?.testName || "Deleted Test",
            resultFile: result?.resultFile,
            date: `${new Date(result?.uploadedAt).getDate()}-${(
              new Date(result.uploadedAt).getMonth() + 1
            )
              .toString()
              .padStart(2, "0")}-${new Date(result?.uploadedAt).getFullYear()}`,
            time: new Date(result.uploadedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true
            })
          }
        })
      )

      const filteredResults = formattedResults.filter((r) => r !== null)

      const totalResults = await testResultModel.countDocuments(filter)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Clinic test results retrieved successfully.",
        data: filteredResults,
        hasNoTestResults: totalTestResultsInDatabase === 0,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalResults / baseLimit),
          totalResults
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getPatientTestResults(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { page = "1", sort } = req.query
      const pageNumber = parseInt(page as string, 10) || 1
      const limitNumber = 4
      const skip = (pageNumber - 1) * limitNumber

      const filter: any = { patient: patientId }

      const query = testResultModel
        .find(filter)
        .select("testBooking test refNo uploadedAt resultFile")
        .sort(
          sort === "oldest"
            ? { uploadedAt: 1 }
            : sort === "newest"
              ? { uploadedAt: -1 }
              : {}
        )
        .skip(skip)
        .limit(limitNumber)

      const testResults = await query.lean()
      const allTestItems = await testItemModel.find().select("name image")

      const formattedResults = await Promise.all(
        testResults.map(async (result) => {
          const testBooking = await testBookingModel.findById(
            result.testBooking
          )
          if (!testBooking) return null

          const test = await testModel
            .findById(result.test)
            .setOptions({ includeDeleted: true })
            .select("testName")
            .lean()

          const clinic = await clinicModel
            .findById(testBooking.clinic)
            .select("clinicName")

          const testImage =
            allTestItems.find(
              (ti) => ti.name.toLowerCase() === test?.testName?.toLowerCase()
            )?.image || ""

          return {
            testName: test?.testName || "Deleted Test",
            testImage,
            refNo: result.refNo,
            resultFile: result.resultFile,
            clinicName: clinic?.clinicName || "",
            date: new Date(result.uploadedAt).toLocaleDateString("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short"
            }),
            status: "SUCCESS",
            uploadedAt: result.uploadedAt
          }
        })
      )

      const filteredResults = formattedResults.filter(Boolean)

      const totalResults = await testResultModel.countDocuments(filter)

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test results retrieved successfully.",
        data: filteredResults,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalResults / limitNumber),
          totalResults
        }
      })
    } catch (error) {
      next(error)
    }
  }

  public static async resendTestResultEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { testResultId } = req.params
      const clinicId = getClinicId(req)

      const testResult = await testResultModel.findOne({
        _id: testResultId,
        clinic: clinicId
      })

      if (!testResult) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "Session result not found or does not belong to this clinic."
        )
      }

      const patient = await patientModel
        .findById(testResult.patient)
        .select("fullName email")
      if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found.")
      }

      const test = await testModel.findById(testResult.test).select("testName")
      if (!test) {
        throw new AppError(httpStatus.NOT_FOUND, "Appointments not found.")
      }

      const testBooking = await testBookingModel
        .findById(testResult.testBooking)
        .select("clinic date")
      if (!testBooking) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "Appointments booking not found."
        )
      }

      const clinic = await clinicModel
        .findById(testBooking.clinic)
        .select("clinicName")
      if (!clinic) {
        throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
      }

      await TestResultEmailService.sendTestResultEmail(patient, {
        refNo: testResult.refNo,
        testName: test.testName,
        clinicName: clinic.clinicName,
        testDate: new Date(testBooking.date).toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short"
        }),
        resultDate: new Date(
          testResult.createdAt || Date.now()
        ).toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short"
        }),
        resultUrl: testResult.resultFile
      })
        .then(() => {
          console.log("email sent")
        })
        .catch((error) => {
          console.error("Error sending email:", error)
        })

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test result email resent successfully."
      })
    } catch (error) {
      next(error)
    }
  }
}
