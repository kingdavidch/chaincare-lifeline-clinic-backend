import mongoose from "mongoose"

export interface IAddress {
  stateOrProvince: string
  cityOrDistrict: string
  street: string
  postalCode: string
  coordinates: {
    latitude: number
    longitude: number
  }
}

export interface SocialMedia {
  facebook?: string
  twitter?: string
  instagram?: string
  linkedin?: string
  tiktok?: string
  other?: string
}

export interface IClinic {
  _id: string
  clinicId: number
  clinicName: string
  bio?: string
  email: string
  phoneNo: string
  username: string
  deliveryMethods: number[]
  currencySymbol: string
  languages: string[]
  location: IAddress
  password: string
  termsAccepted: boolean
  supportInsurance: number[]
  avatar: string
  balance: number
  status: "pending" | "approved" | "rejected" | "suspended"
  statusReason: string[]
  country: string
  certificate: {
    file: string
    status: "pending" | "approved" | "rejected"
    rejectionReasons: string[]
  }
  onlineStatus?: "online" | "offline"
  contractAccepted: boolean
  totalMoneyOwed: number
  practitionerType: "doctor" | "therapist" | "clinic" | "nurse" | "hospital"
  categories: mongoose.Types.ObjectId[]
  tests: mongoose.Types.ObjectId[]
  reviews: mongoose.Types.ObjectId[]
  isVerified?: boolean
  resetPasswordToken?: string
  resetPasswordExpires?: Date
  isDeleted?: boolean
  socialMedia?: SocialMedia
  createdAt: Date
  updatedAt: Date
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface IClinicPayload {
  id: string
  email: string
  clinicName: string
  [key: string]: any
}
