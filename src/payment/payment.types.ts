/* eslint-disable @typescript-eslint/no-explicit-any */

import { Types } from "mongoose"

export interface SubmitCollectionDto {
  amount: number
  channelId: string
  currency: string
  customerEmail: string
  customerPhoneNumber: string
}

export interface SubmitCollectionResponse {
  id: string
  status: string
  amount: number
  channelId: string
  currency: string
  customerEmail: string
  customerPhoneNumber: string
  createdAt: Date
}

export interface Channel {
  max: number
  currency: string
  countryCurrency: string
  status: string
  feeLocal: number
  createdAt: string
  vendorId: string
  country: string
  feeUSD: number
  min: number
  channelType: string
  rampType: string
  updatedAt: string
  apiStatus: string
  settlementType: string
  estimatedSettlementTime: number
  id: string
}

export interface ExchangeRate {
  from: string
  to: string
  rate: number
  inverseRate: number
  updatedAt: string
}
export interface YellowCardRecipient {
  name: string
  country: string
  address: string
  dob: string
  email: string
  phone: string
}

export interface YellowCardSource {
  accountType: "bank" | "momo"
  accountNumber: string
}

export interface YellowCardSubmitCollectionDto {
  amount: number
  channelId: string
  currency?: string
  customerUID?: string
  sequenceId?: string
  recipient: YellowCardRecipient
  source?: YellowCardSource
}

export interface YellowCardSubmitCollectionResponse {
  currency: string
  status: string
  serviceFeeAmountUSD: number
  partnerFeeAmountLocal: number
  country: string
  recipient: {
    country: string
    address: string
    idType: string
    phone: string
    dob: string
    name: string
    idNumber: string
    email: string
  }
  expiresAt: string
  requestSource: string
  directSettlement: boolean
  refundRetry: number
  id: string
  partnerId: string
  rate: number
  tier0Active: boolean
  createdAt: string
  forceAccept: boolean
  source: {
    country: string
  }
  sequenceId: string
  convertedAmount: number
  channelId: string
  serviceFeeAmountLocal: number
  updatedAt: string
  partnerFeeAmountUSD: number
  amount: number
  bankInfo: {
    bankName: string
    accountNumber: string
    accountName: string
    bankCode?: string
  }
}

export interface YellowCardCollectionDetails {
  id: string
  amount: number
  currency: string
  status: string
  channelId: string
  rate: number
  convertedAmount: number
  createdAt: string
  updatedAt: string
  expiresAt: string
  recipient: Record<string, any>
  source: Record<string, any>
  [key: string]: any // for flexibility
}

export interface YellowCardWebhookPayload {
  id: string
  status: "pending" | "processing" | "complete" | "failed" | string
  amount?: number
  currency?: string
  channelId?: string
  sequenceId?: string
  [key: string]: any
}

export interface YellowCardAcceptCollectionResponse {
  id: string
  amount: number
  currency: string
  status: string
  expiresAt: string
  bankInfo: {
    name: string
    accountNumber: string
    accountName: string
    branchCode?: string
  }
}

export interface IWithdrawal extends Document {
  withdrawalId: number
  clinic: Types.ObjectId
  amount: number
  usdAmount?: number
  fee?: number
  phoneNumber: string
  accountNumber: string
  status: "pending" | "completed" | "failed" | "processing"
  providerStatus?: string
  rejectionReason?: string
  provider: "pawapay" | "YellowCard"
  providerChannel?: string
  providerTransactionId?: string
  payoutId?: string
  metadata?: {
    accountName?: string
    bankId?: string
    reason?: string
    sequenceId?: string
    rate?: number
    providerResponse?: any
  }
  statusHistory?: {
    status: "pending" | "completed" | "failed" | "processing"
    changedAt: Date
  }[]
  createdAt?: Date
  updatedAt?: Date
}
