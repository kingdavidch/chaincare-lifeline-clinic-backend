import moment from "moment"
import { HydratedDocument } from "mongoose"
import discountModel from "../discount/discount.model"
import { ITestBooking } from "../testBooking(Cart)/testBooking.types"

type BookingDoc = HydratedDocument<ITestBooking>

export async function revalidateDiscount(booking: BookingDoc | null) {
  if (!booking) return booking

  const now = moment.utc()
  const subtotal = booking.price

  await discountModel.updateMany(
    { clinic: booking.clinic, validUntil: { $lt: now.toDate() }, status: 0 },
    { $set: { status: 1 } }
  )

  if (!booking.discount?.code) {
    booking.discount = {
      code: null,
      percentage: 0,
      discountAmount: 0,
      finalPrice: subtotal,
      expiresAt: null
    }
    await booking.save()
    return booking
  }

  const discount = await discountModel.findOne({
    clinic: booking.clinic,
    code: booking.discount.code,
    status: 0,
    isDeleted: false,
    validUntil: { $gte: now.toDate() }
  })

  if (discount) {
    const discountAmount = (subtotal * discount.percentage) / 100
    booking.discount = {
      code: discount.code,
      percentage: discount.percentage,
      discountAmount,
      finalPrice: subtotal - discountAmount,
      expiresAt: discount.validUntil
    }
  } else {
    booking.discount = {
      code: null,
      percentage: 0,
      discountAmount: 0,
      finalPrice: subtotal,
      expiresAt: null
    }
  }

  await booking.save()
  return booking
}
