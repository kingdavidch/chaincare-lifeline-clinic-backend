/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"

export type NotificationType =
  | "order"
  | "claim"
  | "test result"
  | "info"
  | "payment"
  | "warning"
  | "subscription"

interface PushPayload {
  expoPushToken: string
  title: string
  message: string
  type?: NotificationType
  data?: Record<string, any>
}

export const sendPushNotification = async ({
  expoPushToken,
  title,
  message,
  type,
  data = {}
}: PushPayload): Promise<void> => {
  try {
    const response = await axios.post("https://exp.host/--/api/v2/push/send", [
      {
        to: expoPushToken,
        sound: "default",
        title,
        body: message,
        data: {
          ...data,
          type
        }
      }
    ])

    const tickets = response.data?.data
    if (Array.isArray(tickets)) {
      tickets.forEach((ticket: any) => {
        if (ticket.status === "ok") {
          console.log("✅ Push notification sent:", ticket.id)
        } else {
          console.warn("⚠️ Push notification error:", ticket)
        }
      })
    } else {
      console.warn("⚠️ Unexpected push response:", response.data)
    }
  } catch (error: any) {
    console.error(
      "❌ Push notification failed:",
      error?.response?.data || error.message || error
    )
  }
}
