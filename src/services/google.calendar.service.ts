import { google } from "googleapis"
import { OAuth2Client } from "google-auth-library"
import "dotenv/config"
import { IClinic } from "../clinic/clinic.types"
import { IPatient } from "../patient/patient.types"
import { formatCase } from "../utils"

const oauth2Client = new OAuth2Client(
  process.env.CLIENT_ID!,
  process.env.CLIENT_SECRET!,
  process.env.REDIRECT_URI!
)

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN!
})

const calendar = google.calendar({ version: "v3", auth: oauth2Client })

interface CreateEventParams {
  clinic: IClinic
  patient: IPatient
  testName: string
  orderId: string
  deliveryMethod: number // 0 = home service, 1 = in-person, 2 = online session
  address?: string // For home/in-person
  timeZone?: string // default = Africa/Kigali
  startDateTime: Date // Required
  endDateTime?: Date // Optional – defaults to +1 hour
}

interface CreateEventResult {
  success: true
  eventLink: string | undefined
  meetLink: string | undefined
}

export async function createGoogleCalendarEvent({
  clinic,
  patient,
  testName,
  orderId,
  deliveryMethod,
  address,
  timeZone = "Africa/Kigali",
  startDateTime,
  endDateTime
}: CreateEventParams): Promise<CreateEventResult> {
  const start = startDateTime
  const end = endDateTime ?? new Date(start.getTime() + 60 * 60 * 1000)

  const eventStart = start.toISOString()
  const eventEnd = end.toISOString()

  const capitalizedTestName = formatCase(testName)
  const capitalizedPatientName = formatCase(patient.fullName)
  const capitalizedClinicName = formatCase(clinic.clinicName)

  const isOnline = deliveryMethod === 2
  const methodLabel =
    deliveryMethod === 0
      ? "Home visit"
      : deliveryMethod === 1
        ? "In-person"
        : "Online"

  const descriptionLines = [
    `${methodLabel?.toUpperCase()} Appointment for ${capitalizedTestName}.`,
    `Order ID: ${orderId}`,
    `Patient: ${capitalizedPatientName}`,
    `Clinic: ${capitalizedClinicName}`
  ]

  if (address) {
    descriptionLines.push(address)
  }

  const summary = `Appointment - ${capitalizedTestName} | ${capitalizedPatientName} x ${capitalizedClinicName}`

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all",
      conferenceDataVersion: 1,
      requestBody: {
        summary,
        description: descriptionLines.join("\n"),
        start: {
          dateTime: eventStart,
          timeZone
        },
        end: {
          dateTime: eventEnd,
          timeZone
        },
        attendees: [{ email: clinic.email }, { email: patient.email }],
        conferenceData: isOnline
          ? {
              createRequest: {
                requestId: "lifeline-" + Date.now(),
                conferenceSolutionKey: { type: "hangoutsMeet" }
              }
            }
          : undefined,
        reminders: { useDefault: true }
      }
    })

    const event = response.data

    return {
      success: true,
      eventLink: event.htmlLink ?? undefined,
      meetLink: event.hangoutLink ?? undefined
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("❌ Google Calendar error:", error.message)
      throw new Error(
        "Failed to create Google Calendar event: " + error.message
      )
    }

    throw new Error("Unknown error creating Google Calendar event")
  }
}
