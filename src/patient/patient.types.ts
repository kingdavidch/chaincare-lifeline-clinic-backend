export interface IAddress {
  stateOrProvince?: string
  cityOrDistrict?: string
  street: string
  postalCode: string
  coordinates: {
    latitude: number
    longitude: number
  }
}

export interface IPatient {
  patientId: number
  _id: number
  fullName: string
  phoneNumber: string
  email: string
  password: string
  googleId?: string
  loginProvider?: "email" | "google"
  country: string
  termsAccepted: boolean
  location: IAddress
  avatar: string
  isDeleted?: boolean
  isVerified: boolean
  insurance: IPatientInsurance[]
  dob?: string // format: "MM/DD/YYYY"
  idNumber?: string;
  idType?: "national_id" | "passport" | "license" | "other";
  expoPushToken: string
  resetPasswordToken?: string
  resetPasswordExpires?: Date
  emailOtp?: string
  emailOtpExpiresAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface IRecipient {
  name: string
  country: string
  address: string
  dob: string
  email: string
  phone: string
}

export interface IPatientInsurance {
  insuranceId: number
  affiliationNumber: string
  policyNumber: string
  relationship: string
  fullName: string
  dateOfBirth?: Date
  gender?: string
  phoneNumber?: string
  workplaceAddress?: string
  workplaceDepartment?: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface IPatientPayload {
  id: string
  email: string
  fullName: string
  [key: string]: any
}
