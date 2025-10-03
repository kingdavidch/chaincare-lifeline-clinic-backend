import mongoose from "mongoose"

export interface ITest extends Document {
  clinic: mongoose.Types.ObjectId
  testItem: mongoose.Types.ObjectId
  testNo: number
  testName: string
  price: number
  currencySymbol: string
  turnaroundTime: string
  sampleType?:
    | "blood"
    | "respiratory"
    | "urine"
    | "stool"
    | "tissue biopsies"
    | "swabs"
    | "no sample required"
  preTestRequirements?: string
  insuranceCoverage?: string
  coveredByLifeLine?: boolean
  homeCollection: string
  description?: string
  isDeleted?: boolean
}
