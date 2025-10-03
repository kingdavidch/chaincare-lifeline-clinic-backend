export interface IAdmin {
  _id: string
  userName: string
  email: string
  password: string
  isActive: boolean
  lastLogin?: Date
  resetPasswordToken?: string
  resetPasswordExpires?: Date
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface IAdminPayload {
  id: string
  email: string
  userName: string
  [key: string]: any
}

