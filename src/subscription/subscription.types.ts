import mongoose from "mongoose"

export interface ISubscription {
  subscriptionId: number
  patient: mongoose.Types.ObjectId
  planName: "standard" | "premium"
  price: number
  duration: string
  includedTests: string[]
  privilege: number
  initialPrivilege: number
  monthlySpending: Array<{
    month: Date
    totalSpent: number
  }>
  status: "active" | "locked" | "expired"
  isPaid: boolean
  startDate: Date
  endDate: Date
  lastUsed: Date
  remainingTests?: number
  testsUsedThisMonth?: number
  lastTestDates?: Date[]
  isRolloverEligible?: boolean
  rolloverCarried?: boolean
}
