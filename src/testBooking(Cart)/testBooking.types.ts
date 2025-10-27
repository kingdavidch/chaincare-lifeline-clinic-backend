import mongoose from "mongoose"

export interface ICartDiscount {
  code: string | null
  percentage: number
  discountAmount: number
  finalPrice: number
  expiresAt: Date | null
}

export interface ITestBooking {
  patient: mongoose.Types.ObjectId
  clinic: mongoose.Types.ObjectId
  test: mongoose.Types.ObjectId
  date: Date
  time: string
  scheduledAt: Date
  price: number
  status: "pending" | "booked" | "completed" | "cancelled"
  testLocation: string
  discount?: ICartDiscount
}
