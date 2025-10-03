import { Document, Types } from "mongoose"

export interface IClaim extends Document {
  clinic: Types.ObjectId
  patient: Types.ObjectId
  testName: string
  claimNo: number
  date: Date
  time: string
  cost: number
}
