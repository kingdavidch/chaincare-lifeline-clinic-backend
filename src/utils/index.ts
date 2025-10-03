/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"
import { UploadApiErrorResponse, UploadApiResponse } from "cloudinary"
import "dotenv/config"
import { Request } from "express"
import httpStatus from "http-status"
import mongoose from "mongoose"
import otpgenerator from "otp-generator"
import cloudinary from "../config/cloudinary"
import appError from "./app.error"

export const handleRequiredFields = (
  req: Request,
  requiredFields: string[]
) => {
  const missingFields = requiredFields.filter((field) => !(field in req.body))
  if (missingFields.length > 0) {
    throw new appError(
      httpStatus.BAD_REQUEST,
      "Please ensure all required fields are provided."
    )
  }
}

export const validateObjectId = (
  id: string | undefined,
  fieldName: string = "ID"
) => {
  if (!mongoose.Types.ObjectId.isValid(id!)) {
    throw new appError(
      httpStatus.BAD_REQUEST,
      `${fieldName} is not a valid MongoDB ObjectId`
    )
  }
}

export interface CloudinaryUploadResponse {
  secure_url: string
  public_id: string
  format: string
  resource_type: string
}

export const uploadToCloudinary = (
  buffer: Buffer,
  resourceType: "image" | "raw",
  folder: string,
  options: { public_id?: string; tags?: string[] } = {}
): Promise<CloudinaryUploadResponse> => {
  return new Promise((resolve, reject) => {
    cloudinary.v2.uploader
      .upload_stream(
        {
          resource_type: resourceType,
          folder: folder,
          public_id: options.public_id,
          tags: options.tags
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined
        ) => {
          if (error) {
            return reject(
              new Error(
                `Cloudinary Upload Error: ${error.message}. Status Code: ${error.http_code}`
              )
            )
          }
          if (!result) {
            return reject(new Error("No result from Cloudinary."))
          }
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            resource_type: result.resource_type
          })
        }
      )
      .end(buffer)
  })
}

export function getClinicId(req: Request): string | undefined {
  return (req?.clinic as { id: string })?.id
}

export function getAdminId(req: Request): string | undefined {
  return (req?.admin as { id: string })?.id
}

export function getPatientId(req: Request): string | undefined {
  return (req?.patient as { id: string })?.id
}

export const generateEmailOTP = (): string => {
  return otpgenerator.generate(4, {
    upperCaseAlphabets: false,
    specialChars: false,
    digits: true,
    lowerCaseAlphabets: false
  })
}

export const generateOrderID = () => {
  const prefix = "LFC-"
  const randomNum = Math.floor(100000 + Math.random() * 900000)
  return `${prefix}${randomNum}`
}

export function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function validatePhoneWithPawaPay(phoneNumber: string) {
  const apiUrl = `${process.env.PAWAPAY_API_URL}/v2`

  try {
    const response = await axios.post(
      `${apiUrl}/predict-provider`,
      { phoneNumber },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      }
    )

    const data = response.data

    if (data.failureReason) {
      const { failureCode, failureMessage } = data.failureReason
      throw new appError(
        httpStatus.BAD_REQUEST,
        `PawaPay error (${failureCode}): ${failureMessage}`
      )
    }

    return {
      sanitizedPhone: data.phoneNumber,
      provider: data.provider,
      country: data.country
    }
  } catch (err: any) {
    throw new appError(
      httpStatus.BAD_REQUEST,
      "Phone number validation failed",
      err?.response?.data?.message || "Invalid or unsupported number"
    )
  }
}

export const formatDOB = (dob: Date | string) => {
  const date = new Date(dob)
  return `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date
    .getDate()
    .toString()
    .padStart(2, "0")}/${date.getFullYear()}`
}

export const formatPhone = (phone: string) => {
  // Convert 07xxxxxxxx to +2507xxxxxxxx
  return phone.startsWith("+") ? phone : `+250${phone.replace(/^0/, "")}`
}
