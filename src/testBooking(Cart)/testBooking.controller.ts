import { NextFunction, Request, Response } from "express"
import httpStatus from "http-status"
import clinicModel from "../clinic/clinic.model"
import testItemModel from "../test/test.item.model"
import TestModel from "../test/test.model"
import { getPatientId, handleRequiredFields } from "../utils"
import AppError from "../utils/app.error"
import TestBookingModel from "./testBooking.model"
import moment from "moment-timezone"
import { getTimezoneForCountry } from "../utils/timezoneMap"
import { revalidateDiscount } from "../services/discount.service"
import orderModel from "../order/order.model"
import { AvailabilityModel } from "../availability/availability.model"

export default class TestBookingController {
  public static async addToCart(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { testId, clinicId, date, time } = req.body

      handleRequiredFields(req, ["testId", "clinicId", "date", "time"])

      const clinic = await clinicModel.findOne({ clinicId })
      if (!clinic) throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")

      const test = await TestModel.findById(testId)
      if (!test) throw new AppError(httpStatus.NOT_FOUND, "Test not found.")

      const existingCartItem = await TestBookingModel.findOne({
        patient: patientId,
        test: testId,
        clinic: clinic._id,
        status: "pending"
      })

      if (existingCartItem) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: "This appointment is already in your cart."
        })
      }

      const timezone = getTimezoneForCountry(clinic.country)
      const scheduledAt = moment
        .tz(`${date} ${time}`, "YYYY-MM-DD hhA", timezone)
        .toDate()

      const dayOfWeek = moment(scheduledAt)
        .tz(timezone)
        .format("dddd")
        .toLowerCase()

      const availability = await AvailabilityModel.findOne({
        clinic: clinic._id,
        day: dayOfWeek
      })

      if (!availability) {
        throw new AppError(
          httpStatus.CONFLICT,
          `Clinic is not available on ${dayOfWeek}`
        )
      }

      if (availability.isClosed) {
        throw new AppError(httpStatus.CONFLICT, "Clinic is closed on this day")
      }

      // --- Parse time string like "12PM", "1PM" into 24-hour number ---
      const parseTimeToHour = (t: string) => {
        const match = t.match(/(\d+)(AM|PM)/)
        if (!match)
          throw new AppError(httpStatus.BAD_REQUEST, "Invalid time format")
        let hour = parseInt(match[1], 10)
        const period = match[2]
        if (period === "PM" && hour !== 12) hour += 12
        if (period === "AM" && hour === 12) hour = 0
        return hour
      }

      let requestedStartHour: number
      let requestedEndHour: number | null = null

      if (time.includes("-")) {
        const [start, end] = time
          .split("-")
          .map((t: string) => parseTimeToHour(t.trim()))
        requestedStartHour = start
        requestedEndHour = end
      } else {
        requestedStartHour = parseTimeToHour(time)
      }

      const isWithinRange = availability.timeRanges.some((range) => {
        if (requestedEndHour !== null) {
          return (
            requestedStartHour >= range.openHour &&
            requestedEndHour <= range.closeHour
          )
        } else {
          return (
            requestedStartHour >= range.openHour &&
            requestedStartHour < range.closeHour
          )
        }
      })

      if (!isWithinRange) {
        throw new AppError(
          httpStatus.CONFLICT,
          `Clinic is not available at ${time} on ${dayOfWeek}`
        )
      }

      const startOfDay = moment
        .tz(scheduledAt, timezone)
        .startOf("day")
        .toDate()
      const endOfDay = moment.tz(scheduledAt, timezone).endOf("day").toDate()

      const [authBookings, publicOrders] = await Promise.all([
        TestBookingModel.find({
          clinic: clinic._id,
          scheduledAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ["pending", "booked"] }
        }),
        orderModel.find({
          clinic: clinic._id,
          "tests.scheduledAt": { $gte: startOfDay, $lte: endOfDay },
          "tests.status": { $in: ["pending", "booked"] }
        })
      ])

      const bookedTimes = new Set<string>()
      authBookings.forEach((b) =>
        bookedTimes.add(moment(b.scheduledAt).format("hhA"))
      )
      publicOrders.forEach((o) =>
        o.tests.forEach((t) => {
          if (t.scheduledAt)
            bookedTimes.add(moment(t.scheduledAt).format("hhA"))
        })
      )

      const requestedSlot = moment(scheduledAt).format("hhA")
      if (bookedTimes.has(requestedSlot)) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This time slot is already booked. Please choose another."
        )
      }

      const testLocation =
        test.homeCollection === "available" ? "home" : "on-site"

      const booking = await TestBookingModel.create({
        patient: patientId,
        clinic: clinic._id,
        test: test._id,
        price: test.price,
        status: "pending",
        testLocation,
        date: moment.tz(date, "YYYY-MM-DD", timezone).toDate(),
        time,
        scheduledAt,
        discount: {
          code: null,
          percentage: 0,
          discountAmount: 0,
          finalPrice: test.price,
          expiresAt: null
        }
      })

      await revalidateDiscount(booking)

      res.status(httpStatus.CREATED).json({
        success: true,
        message: "Appointment added to cart successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = getPatientId(req)

      const cartItems = await TestBookingModel.find({
        patient: patientId,
        status: "pending"
      })

      await Promise.all(cartItems.map((item) => revalidateDiscount(item)))

      const allTestItems = await testItemModel.find().select("name image")

      const cartItemsWithDetails = await Promise.all(
        cartItems.map(async (item) => {
          const test = await TestModel.findOne({
            _id: item.test,
            isDeleted: false
          }).select("testName price currencySymbol")

          if (!test) return null

          const clinic = await clinicModel
            .findById(item.clinic)
            .select("clinicName")
          if (!clinic) return null

          const matchedItem = allTestItems.find(
            (ti) => ti.name.toLowerCase() === test.testName.toLowerCase()
          )

          return {
            clinicId: item.clinic?.toString(),
            test: item.test,
            _id: item._id,
            testName: test.testName,
            testImage: matchedItem?.image || "",
            clinicName: clinic.clinicName,
            date: item.date,
            time: item.time,
            scheduledAt: item.scheduledAt,
            price: test.price,
            currencySymbol: test.currencySymbol,
            discount: {
              code: item.discount?.code ?? null,
              percentage: item.discount?.percentage ?? 0,
              discountAmount: item.discount?.discountAmount ?? 0,
              finalPrice: item.discount?.finalPrice ?? test.price
            }
          }
        })
      )

      const filteredItems = cartItemsWithDetails.filter(
        (item): item is NonNullable<typeof item> => item !== null
      )

      res.status(httpStatus.OK).json({
        success: true,
        message: "Cart items retrieved successfully.",
        data: filteredItems
      })
    } catch (error) {
      next(error)
    }
  }

  public static async removeFromCart(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { bookingId } = req.params

      const booking = await TestBookingModel.findOneAndDelete({
        _id: bookingId,
        patient: patientId,
        status: "pending"
      })
      if (!booking)
        throw new AppError(httpStatus.NOT_FOUND, "Item not found in cart.")

      const remaining = await TestBookingModel.find({
        patient: patientId,
        status: "pending"
      })
      await Promise.all(remaining.map((item) => revalidateDiscount(item)))

      res.status(httpStatus.OK).json({
        success: true,
        message: "Test removed from cart successfully."
      })
    } catch (error) {
      next(error)
    }
  }

  public static async clearCart(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)

      const result = await TestBookingModel.deleteMany({
        patient: patientId,
        status: "pending"
      })
      if (result.deletedCount === 0) {
        throw new AppError(httpStatus.NOT_FOUND, "No items found in the cart.")
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Cart cleared successfully."
      })
    } catch (error) {
      next(error)
    }
  }
}
