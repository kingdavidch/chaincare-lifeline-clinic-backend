import mongoose from "mongoose"

export interface IReview {
  reviewNo: number
  patient: mongoose.Types.ObjectId
  clinic: mongoose.Types.ObjectId
  rating: number // 1-5 Star Rating
  comment?: string
  createdAt?: Date
}
