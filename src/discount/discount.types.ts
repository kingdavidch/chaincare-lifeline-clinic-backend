import { Document, Types } from "mongoose"

export interface IDiscount extends Document {
  clinic: Types.ObjectId
  code: string
  percentage: number
  validUntil: Date
  status: number
  discountNo?: number
  isHidden?: boolean
  isDeleted: boolean
  createdAt?: Date
  updatedAt?: Date
}
