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

export default class TestBookingController {
  public static async addToCart(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { testId, clinicId, individuals, date, time } = req.body
      handleRequiredFields(req, [
        "testId",
        "clinicId",
        "individuals",
        "date"
        // "time"
      ])

      if (!Number.isInteger(individuals) || individuals < 1) {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid quantity.")
      }

      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")

      const test = await TestModel.findById(testId)
      if (!test) throw new AppError(httpStatus.NOT_FOUND, "Test not found.")

      const existingCartItem = await TestBookingModel.findOne({
        patient: patientId,
        test: testId,
        clinic: clinicId,
        status: "pending"
      })
      if (existingCartItem) {
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message:
            "Appointment is already in your cart. You can increase the quantity."
        })
      }

      const timezone = getTimezoneForCountry(clinic.country)
      const scheduledAt = moment
        .tz(`${date} ${time}`, "YYYY-MM-DD HH:mm", timezone)
        .toDate()

      const conflict = await TestBookingModel.findOne({
        clinic: clinicId,
        scheduledAt,
        status: { $in: ["pending", "booked"] }
      })
      if (conflict) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This time slot is already booked. Please choose another."
        )
      }

      const testLocation =
        test.homeCollection === "available" ? "home" : "on-site"
      const subtotal = test.price * individuals

      const booking = await TestBookingModel.create({
        patient: patientId,
        clinic: clinic._id,
        test: test._id,
        individuals,
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
          finalPrice: subtotal,
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
            individuals: item.individuals,
            discount: {
              code: item.discount?.code ?? null,
              percentage: item.discount?.percentage ?? 0,
              discountAmount: item.discount?.discountAmount ?? 0,
              finalPrice:
                item.discount?.finalPrice ?? test.price * item.individuals
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

  public static async updateQuantity(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const patientId = getPatientId(req)
      const { bookingId } = req.params
      const { action } = req.body

      if (!["increase", "decrease"].includes(action)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Invalid action. Use 'increase' or 'decrease'."
        )
      }

      const booking = await TestBookingModel.findOne({
        _id: bookingId,
        patient: patientId,
        status: "pending"
      })
      if (!booking)
        throw new AppError(httpStatus.NOT_FOUND, "Item not found in cart.")

      if (action === "increase") {
        booking.individuals += 1
      } else {
        if (booking.individuals <= 1) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            "Cannot have less than 1 individual."
          )
        }
        booking.individuals -= 1
      }

      await revalidateDiscount(booking)

      res.status(httpStatus.OK).json({
        success: true,
        message: `Quantity ${action}d successfully.`,
        data: {
          individuals: booking.individuals,
          discount: booking.discount
        }
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

  public static async getAvailableSlots(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { clinicId } = req.params
      const { date } = req.query

      if (!date) throw new AppError(httpStatus.BAD_REQUEST, "Date is required")

      const clinic = await clinicModel.findById(clinicId)
      if (!clinic) throw new AppError(httpStatus.NOT_FOUND, "Clinic not found")

      const openHour = 9
      const closeHour = 17 // inclusive (9 → 17)

      const timezone = getTimezoneForCountry(clinic.country)
      const slots: string[] = []

      for (let hour = openHour; hour <= closeHour; hour++) {
        const slot = moment.tz(
          `${date} ${hour}:00`,
          "YYYY-MM-DD HH:mm",
          timezone
        )

        const conflict = await TestBookingModel.findOne({
          clinic: clinicId,
          scheduledAt: slot.toDate(),
          status: "booked"
        })

        if (!conflict) {
          slots.push(`${String(hour).padStart(2, "0")}:00`)
        }
      }

      res.status(httpStatus.OK).json({
        success: true,
        message: "Available slots retrieved successfully",
        slots
      })
    } catch (error) {
      next(error)
    }
  }
}
