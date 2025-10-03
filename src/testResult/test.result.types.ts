import mongoose from "mongoose"

export interface ITestResult {
  testResultNo: number
  refNo: string
  testBooking: mongoose.Types.ObjectId
  patient: mongoose.Types.ObjectId
  clinic: mongoose.Types.ObjectId
  test: mongoose.Types.ObjectId
  order: mongoose.Types.ObjectId
  orderId: string
  resultFile: string // URL to the uploaded file
  resultText?: string // Optional text result
  uploadedAt: Date
  resultSent?: boolean
  createdAt: Date
}
