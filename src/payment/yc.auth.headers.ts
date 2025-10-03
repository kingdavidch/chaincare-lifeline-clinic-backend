/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto"

export interface YCAuthHeaderOptions {
  path: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  body?: Record<string, any> | null
  apiKey: string
  apiSecret: string
}

export function generateYCHeaders({
  path,
  method,
  body,
  apiKey,
  apiSecret
}: YCAuthHeaderOptions): Record<string, string> {
  const timestamp = new Date().toISOString()

  const hmac = crypto.createHmac("sha256", apiSecret)

  hmac.update(timestamp, "utf8")
  hmac.update(path, "utf8")
  hmac.update(method, "utf8")

  if (body) {
    const bodyHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(body), "utf8")
      .digest("base64")

    hmac.update(bodyHash, "utf8")
  }

  const signature = hmac.digest("base64")

  return {
    "X-YC-Timestamp": timestamp,
    Authorization: `YcHmacV1 ${apiKey}:${signature}`
  }
}
