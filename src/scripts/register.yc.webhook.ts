/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"
import "dotenv/config"
import { generateYCHeaders } from "../payment/yc.auth.headers"

async function registerYCWebhook() {
  const apiKey = process.env.YELLOWCARD_API_KEY!
  const apiSecret = process.env.YELLOWCARD_API_SECRET!
  const baseUrl = process.env.YELLOWCARD_BASE_URL!
  const BACKEND_URL = "https://4290b4dbf848.ngrok-free.app"
  // const BACKEND_URL = process.env.BACKEND_URL!

  const path = "/business/webhooks"
  const url = `${baseUrl}${path}`

  const body = {
    url: `${BACKEND_URL}/api/v1/payment/yellowcard/payout-webhook`,
    active: true
  }

  const headers = generateYCHeaders({
    path,
    method: "POST",
    apiKey,
    apiSecret,
    body
  })

  try {
    const res = await axios.post(url, body, { headers })
    console.log("✅ Webhook registered:", res.data)
  } catch (err: any) {
    console.error(
      "❌ Failed to register webhook:",
      err.response?.data || err.message
    )
  }
}

registerYCWebhook()
