/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express"
import httpStatus from "http-status"
import clinicModel from "../clinic/clinic.model"
import { AvailabilityModel } from "./availability.model"
import { getClinicId } from "../utils"
import AppError from "../utils/app.error"
import { getTimezoneForCountry } from "../utils/timezoneMap"
import moment from "moment"

export class AvailabilityController {
  public static async setAvailability(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const { day, timeRanges, isClosed } = req.body

      if (
        !day ||
        !timeRanges ||
        !Array.isArray(timeRanges) ||
        timeRanges.length === 0
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Day and at least one time range are required."
        )
      }

      const validDays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
      ]
      const dayLower = day.toLowerCase()
      if (!validDays.includes(dayLower)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `${day} is not a valid day of the week.`
        )
      }

      for (const range of timeRanges) {
        if (range.openHour === undefined || range.closeHour === undefined) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            "Each time range must have openHour and closeHour."
          )
        }
        if (range.openHour >= range.closeHour) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            "openHour must be less than closeHour."
          )
        }
      }

      await AvailabilityModel.findOneAndUpdate(
        { clinic: clinicId, day: dayLower },
        { timeRanges, isClosed },
        { upsert: true, new: true }
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: `Availability for ${dayLower} updated successfully.`
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete clinic availability for a specific day
   */
  public static async deleteAvailability(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)
      const { day } = req.body

      if (!day) {
        throw new AppError(httpStatus.BAD_REQUEST, "Day is required.")
      }

      const validDays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
      ]
      const dayLower = day.toLowerCase()

      if (!validDays.includes(dayLower)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `${day} is not a valid day of the week.`
        )
      }

      const deleted = await AvailabilityModel.findOneAndDelete({
        clinic: clinicId,
        day: dayLower
      })

      if (!deleted) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          `No availability found for ${dayLower}.`
        )
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: `Availability for ${dayLower} deleted successfully.`
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get clinic's full weekly availability schedule
   */
  public static async getAvailability(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clinicId = getClinicId(req)

      const availability = await AvailabilityModel.find({
        clinic: clinicId
      }).select("-_id -clinic -__v")

      res.status(httpStatus.OK).json({
        success: true,
        data: availability
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getAvailableSlots(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { clinicId } = req.params
      const { date } = req.query

      const clinic = await clinicModel.findOne({ clinicId })
      if (!clinic) throw new AppError(httpStatus.NOT_FOUND, "Clinic not found")

      const weeklyAvailability = await AvailabilityModel.find({
        clinic: clinic._id
      }).select("-_id -clinic -__v")

      const timezone = getTimezoneForCountry(clinic.country)
      const today = moment().tz(timezone).startOf("day")

      if (!date) {
        const extendedAvailability = weeklyAvailability.map((a: any) => {
          const dayIndex = moment().day(a.day.toLowerCase()).day()

          const nextDate = today.clone().day(dayIndex)

          if (nextDate.isBefore(today, "day")) {
            nextDate.add(7, "days") // mutates the moment object in place
          }

          return {
            ...a.toObject(),
            nextDate: nextDate.format("YYYY-MM-DD")
          }
        })

        return res.status(httpStatus.OK).json({
          success: true,
          data: extendedAvailability
        })
      }

      const dayOfWeek = moment
        .tz(date as string, timezone)
        .format("dddd")
        .toLowerCase()

      const dayAvailability = weeklyAvailability.find(
        (d) => d.day.toLowerCase() === dayOfWeek
      )

      if (!dayAvailability) {
        return res.status(httpStatus.OK).json({
          success: true,
          message: "Clinic is not available on this day",
          data: null
        })
      }

      return res.status(httpStatus.OK).json({
        success: true,
        data: dayAvailability
      })
    } catch (error) {
      next(error)
    }
  }
}
