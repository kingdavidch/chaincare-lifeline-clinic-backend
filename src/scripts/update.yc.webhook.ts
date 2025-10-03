/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"
import "dotenv/config"
import { generateYCHeaders } from "../payment/yc.auth.headers"

async function updateYCWebhook() {
  const apiKey = process.env.YELLOWCARD_API_KEY!
  const apiSecret = process.env.YELLOWCARD_API_SECRET!
  const baseUrl = process.env.YELLOWCARD_BASE_URL!
  const webhookId = process.env.YELLOWCARD_WEBHOOK_ID!
  const BACKEND_URL = process.env.BACKEND_URL!

  const path = "/business/webhooks"
  const url = `${baseUrl}${path}`

  const body = {
    id: webhookId,
    url: `${BACKEND_URL}/api/v1/payment/yellowcard/deposit-webhook`,
    active: true
  }

  const headers = generateYCHeaders({
    path,
    method: "PUT",
    apiKey,
    apiSecret,
    body
  })

  try {
    const res = await axios.put(url, body, { headers })
    console.log("✅ Webhook updated:", res.data)
  } catch (err: any) {
    console.error(
      "❌ Failed to update webhook:",
      err.response?.data || err.message
    )
  }
}

updateYCWebhook()
