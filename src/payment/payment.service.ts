/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosResponse } from "axios"
import httpStatus from "http-status"
import {
  Channel,
  ExchangeRate,
  YellowCardAcceptCollectionResponse,
  YellowCardCollectionDetails,
  YellowCardSubmitCollectionDto,
  YellowCardSubmitCollectionResponse
} from "./payment.types"
import AppError from "../utils/app.error"
import { generateYCHeaders } from "./yc.auth.headers"
import "dotenv/config"

export class YellowCardService {
  private readonly baseUrl = process.env.YELLOWCARD_BASE_URL!
  private readonly apiKey: string = process.env.YELLOWCARD_API_KEY!
  private readonly apiSecret: string = process.env.YELLOWCARD_API_SECRET!

  public async getPaymentChannels(
    country: string,
    rampType?: "deposit" | "withdraw"
  ): Promise<Channel[]> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Missing YC credentials"
      )
    }

    const path = "/business/channels"
    const fullUrl = `${this.baseUrl}${path}`

    const headers = generateYCHeaders({
      path,
      method: "GET",
      apiKey: this.apiKey,
      apiSecret: this.apiSecret
    })

    try {
      const response: AxiosResponse<{ channels: Channel[] }> = await axios.get(
        fullUrl,
        {
          headers,
          params: { country }
        }
      )

      const allChannels = response.data?.channels || []

      if (rampType) {
        return allChannels.filter((channel) => channel.rampType === rampType)
      }

      return allChannels
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message
      const status = error.response?.status || 500

      console.error("🔴 YC Error:", error.response?.data)
      throw new AppError(status, `YC getChannels failed: ${msg}`)
    }
  }

  public async getExchangeRate(
    from: string,
    to: string
  ): Promise<ExchangeRate> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Missing YC credentials"
      )
    }

    const path = `/business/rates`
    const fullUrl = `${this.baseUrl}${path}`

    const headers = generateYCHeaders({
      path,
      method: "GET",
      apiKey: this.apiKey,
      apiSecret: this.apiSecret
    })

    try {
      const response: AxiosResponse<ExchangeRate> = await axios.get(fullUrl, {
        headers,
        params: { from, to }
      })

      return response.data
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message
      const status = error.response?.status || 500

      throw new AppError(status, `YC getExchangeRate failed: ${msg}`)
    }
  }

  public async submitCollectionRequest(
    data: YellowCardSubmitCollectionDto
  ): Promise<YellowCardSubmitCollectionResponse> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Missing YC credentials"
      )
    }

    const path = "/business/collections"
    const fullUrl = `${this.baseUrl}${path}`

    const body = {
      amount: data.amount,
      channelId: data.channelId,
      currency: data.currency || "USD",
      sequenceId: data.sequenceId || `txn_${Date.now()}`,
      recipient: data.recipient,
      source: data.source || {
        accountType: "bank",
        accountNumber: "1111111111" // sandbox test number
      },
      customerType: "retail",
      forceAccept: true,
      customerUID: data.customerUID
    }

    const headers = generateYCHeaders({
      path,
      method: "POST",
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      body
    })

    try {
      const response: AxiosResponse<YellowCardSubmitCollectionResponse> =
        await axios.post(fullUrl, body, { headers })

      return response.data
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message
      const status = error.response?.status || 500

      console.error("🔴 YC Error:", error.response?.data)
      throw new AppError(status, `YC submitCollectionRequest failed: ${msg}`)
    }
  }

  public async acceptCollectionRequest(
    collectionId: string
  ): Promise<YellowCardAcceptCollectionResponse> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Missing YC credentials"
      )
    }

    const path = `/business/collections/${collectionId}/accept`
    const fullUrl = `${this.baseUrl}${path}`

    const headers = generateYCHeaders({
      path,
      method: "POST",
      apiKey: this.apiKey,
      apiSecret: this.apiSecret
    })

    try {
      const response: AxiosResponse<YellowCardAcceptCollectionResponse> =
        await axios.post(fullUrl, null, { headers })

      return response.data
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message
      const status = error.response?.status || 500

      console.error("🔴 YC Error:", error.response?.data)
      throw new AppError(status, `YC acceptCollectionRequest failed: ${msg}`)
    }
  }

  public async getCollectionDetails(
    id: string
  ): Promise<YellowCardCollectionDetails> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Missing YC credentials"
      )
    }

    const path = `/business/collections/${id}`
    const fullUrl = `${this.baseUrl}${path}`

    const headers = generateYCHeaders({
      path,
      method: "GET",
      apiKey: this.apiKey,
      apiSecret: this.apiSecret
    })

    try {
      const response: AxiosResponse<YellowCardCollectionDetails> =
        await axios.get(fullUrl, {
          headers
        })

      return response.data
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message
      const status = error.response?.status || 500

      console.error("🔴 YC Error:", error.response?.data)
      throw new AppError(status, `YC getCollectionDetails failed: ${msg}`)
    }
  }

  public async submitPayoutRequest(data: {
    amount: number
    currency: string
    channelId: string
    recipient: {
      accountName: string
      accountNumber: string
      bankId: string
      bankName: string
      country: string
      phoneNumber: string
      reason: string
    }
    sequenceId: string
    customerUID: string
    forceAccept?: boolean
    customerType?: "retail" | "business"
  }): Promise<any> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Missing YC credentials"
      )
    }

    const path = "/business/payments"
    const fullUrl = `${this.baseUrl}${path}`

    const networkId = await this.getNetworkIdByCountry("RW")

    const body = {
      amount: data.amount,
      currency: data.currency,
      channelId: data.channelId,
      sequenceId: data.sequenceId,
      forceAccept: data.forceAccept ?? true,
      customerType: data.customerType ?? "retail",
      reason: data.recipient.reason,
      customerUID: data.customerUID.toString(),
      sender: {
        name: process.env.YC_SENDER_NAME,
        country: process.env.YC_SENDER_COUNTRY,
        phone: process.env.YC_SENDER_PHONE,
        address: process.env.YC_SENDER_ADDRESS,
        dob: process.env.YC_SENDER_DOB,
        email: process.env.YC_SENDER_EMAIL,
        idNumber: process.env.YC_SENDER_ID_NUMBER,
        idType: process.env.YC_SENDER_ID_TYPE
      },
      destination: {
        accountNumber: data.recipient.accountNumber,
        accountType: "bank",
        networkId,
        bank: {
          accountBank: data.recipient.bankName,
          networkName: data.recipient.bankName,
          country: data.recipient.country
        },
        accountName: data.recipient.accountName,
        phoneNumber: data.recipient.phoneNumber,
        country: "RW"
      }
    }

    const headers = generateYCHeaders({
      path,
      method: "POST",
      apiKey: this.apiKey,
      apiSecret: this.apiSecret,
      body
    })

    try {
      const response: AxiosResponse<any> = await axios.post(fullUrl, body, {
        headers
      })
      return response.data
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message
      const status = error.response?.status || 500
      console.error("🔴 YC payout submit error:", error.response?.data)
      throw new AppError(status, `YC submitPayoutRequest failed: ${msg}`)
    }
  }

  public async acceptPayoutRequest(paymentId: string): Promise<any> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Missing YC credentials"
      )
    }

    const path = `/business/payments/${paymentId}/accept`
    const fullUrl = `${this.baseUrl}${path}`

    const headers = generateYCHeaders({
      path,
      method: "POST",
      apiKey: this.apiKey,
      apiSecret: this.apiSecret
    })

    try {
      const response: AxiosResponse<any> = await axios.post(fullUrl, null, {
        headers
      })
      return response.data
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message
      const status = error.response?.status || 500
      console.error("🔴 YC payout accept error:", error.response?.data)
      throw new AppError(status, `YC acceptPayoutRequest failed: ${msg}`)
    }
  }

  public async getNetworkIdByCountry(country: string): Promise<string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Missing YC credentials"
      )
    }

    const path = `/business/networks`
    const fullUrl = `${this.baseUrl}${path}`

    const headers = generateYCHeaders({
      path,
      method: "GET",
      apiKey: this.apiKey,
      apiSecret: this.apiSecret
    })

    try {
      const response = await axios.get(fullUrl, {
        headers,
        params: { country }
      })

      const networks: any[] = response.data?.networks || []

      if (!networks.length) {
        throw new AppError(404, `No networks found for country: ${country}`)
      }

      return networks[0].id
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message
      const status = error.response?.status || 500

      throw new AppError(status, `YC getBankNetworks failed: ${msg}`)
    }
  }
}
