/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose"
import { IClinic } from "../clinic/clinic.types"
import { IPatient } from "../patient/patient.types"
import { getTimezoneForCountry } from "../utils/timezoneMap"
import { createGoogleCalendarEvent } from "../services/google.calendar.service"
import orderModel from "./order.model"
import { notifyAdmin } from "../admin/utils"
import { formatAddress } from "../utils"
import moment from "moment"
export function isPopulatedTest(test: any): test is { _id: Types.ObjectId } {
  return typeof test === "object" && test !== null && "_id" in test
}

export const formatCase = (str: string) =>
  str.replace(/\b\w/g, (c) => c.toUpperCase())

export const mapDeliveryMethod = (deliveryMethod: any): string => {
  if (typeof deliveryMethod === "number") {
    if (deliveryMethod === 0) return "home service"
    if (deliveryMethod === 1) return "in-person"
    if (deliveryMethod === 2) return "online session"
  }
  return "unknown"
}

// For saving (string → 0/1)
export function deliveryMethodToNumber(value: string | number): 0 | 1 | 2 {
  if (typeof value === "number") return value as 0 | 1 | 2

  const normalized = value.toLowerCase()
  if (["home service", "home", "0"].includes(normalized)) return 0
  if (["in-person", "in person", "1"].includes(normalized)) return 1
  if (["online", "online session", "virtual", "2"].includes(normalized))
    return 2

  return 1 // default fallback: in-person
}

// createMeetLinksForOrder

function isMongooseDoc<T>(doc: T): doc is T & { toObject: () => T } {
  return (
    typeof (doc as unknown as { toObject?: () => T }).toObject === "function"
  )
}

interface TestWithSchedule {
  scheduledAt?: Date
  testName: string
}

interface OrderForMeetCreation {
  _id: Types.ObjectId
  orderId: string
  clinic: IClinic
  patient: IPatient
  deliveryMethod: number
  deliveryAddress?: {
    address?: string
    cityOrDistrict?: string
  }
  tests: TestWithSchedule[]
}

export async function createCalendarEventsForOrder(
  order: OrderForMeetCreation
) {
  const timeZone = getTimezoneForCountry(order.clinic.country)

  const scheduledTests = order.tests
    .map((test, index) => {
      const plainTest = isMongooseDoc(test) ? test.toObject() : test

      return {
        index,
        testName: plainTest.testName,
        scheduledAt: plainTest.scheduledAt
          ? new Date(plainTest.scheduledAt)
          : undefined
      }
    })
    .filter((test) => !!test.scheduledAt)

  for (const test of scheduledTests) {
    let success = false
    let attempt = 0

    while (!success && attempt < 3) {
      try {
        attempt++

        const address =
          order.deliveryMethod === 1
            ? `Clinic Address: ${formatAddress(order.clinic.location)}`
            : order.deliveryMethod === 0
              ? `Patient Address: ${order.deliveryAddress?.address}, ${order.deliveryAddress?.cityOrDistrict}`
              : undefined

        const calendarResult = await createGoogleCalendarEvent({
          clinic: order.clinic,
          patient: order.patient,
          testName: test.testName,
          orderId: order.orderId,
          deliveryMethod: order.deliveryMethod,
          address,
          startDateTime: test.scheduledAt!,
          timeZone
        })

        await orderModel.updateOne(
          { _id: order._id },
          {
            $set: {
              [`tests.${test.index}.googleEventLink`]: calendarResult.eventLink,
              [`tests.${test.index}.googleMeetLink`]: calendarResult.meetLink
            }
          }
        )

        success = true
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"

        if (attempt === 3) {
          await notifyAdmin(
            "Google Calendar Creation Failed",
            `Failed to create calendar event for "${test.testName}" in order #${order.orderId}. Reason: ${message}`,
            "warning"
          )
        }

        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise((res) => setTimeout(res, delay))
      }
    }
  }
}

export function formatTestStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export const parseTimeToHour = (t: string): number => {
  const m = moment(t, ["hA", "HH:mm"])
  return m.hours()
}
