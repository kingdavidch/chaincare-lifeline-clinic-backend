/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose"

export function isPopulatedTest(test: any): test is { _id: Types.ObjectId } {
  return typeof test === "object" && test !== null && "_id" in test
}

export const formatCase = (str: string) =>
  str.replace(/\b\w/g, (c) => c.toUpperCase())

export const mapDeliveryMethod = (deliveryMethod: any): string => {
  if (typeof deliveryMethod === "number") {
    return deliveryMethod === 0 ? "home service" : "in-person"
  }

  return "unknown"
}

// For saving (string → 0/1)
export function deliveryMethodToNumber(value: string | number): 0 | 1 {
  return value === "home service" || value === 0 || value === "0" ? 0 : 1
}
