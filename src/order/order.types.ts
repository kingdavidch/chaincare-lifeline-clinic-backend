import mongoose from "mongoose"
import { IPatient, IPatientInsurance } from "../patient/patient.types"
import { IClinic } from "../clinic/clinic.types"
import { ITest } from "../test/test.types"

export interface IOrder {
  orderId: string
  patient: mongoose.Types.ObjectId | IPatient
  clinic: mongoose.Types.ObjectId | IClinic
  tests: {
    test: mongoose.Types.ObjectId | ITest
    testName: string
    price: number
    individuals: number
    turnaroundTime: string
    description: string
    testImage?: string
    date?: Date
    time?: string
    scheduledAt?: Date
    status:
      | "pending"
      | "sample_collected"
      | "processing"
      | "result_ready"
      | "result_sent"
      | "rejected"
      | "cancelled"
      | "failed"

    statusReason?: string | null

    statusHistory?: {
      status:
        | "pending"
        | "sample_collected"
        | "processing"
        | "result_ready"
        | "result_sent"
        | "rejected"
        | "cancelled"
        | "failed"
      changedAt: Date
    }[]
  }[]
  paymentMethod:
    | "lifeline subscription"
    | "insurance"
    | "pawa_pay"
    | "yellow_card"
  insuranceDetails?: IPatientInsurance | null
  deliveryAddress: {
    fullName: string
    phoneNo: string
    address: string
    cityOrDistrict: string
  }
  appliedDiscount?: {
    code: string
    percentage: number
    discountAmount: number
    expiresAt: Date
  }
  paymentStatus: "pending" | "paid" | "failed"
  deliveryMethod: number // 0 = Home service, 1 = In-person
  totalAmount: number
  createdAt?: Date
  updatedAt?: Date
  yellowCardInfo: {
    channelId?: string
    sequenceId?: string
    ycTransactionId?: string
    status?: string
    rejectionReason?: string
  }
  pawaPayInfo?: {
    transactionId?: string
    depositId?: string
    phoneNumber?: string
    status?: "initiated" | "pending" | "network_error" | "rejected" | "complete"
    errorMessage?: string
    rejectionReason?: string
    initiatedAt?: Date
  }
}
