import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import cors from "cors"
import cookieParser from "cookie-parser"

import appError from "../utils/app.error"
import httpStatus from "http-status"
import errorHandler from "../error/error.handler"

import clinicRouter from "../clinic/clinic.routes"
import testRouter from "../test/test.routes"
import patientRouter from "../patient/patient.routes"
import testBookingRouter from "../testBooking(Cart)/testBooking.routes"
import subscriptionRouter from "../subscription/subscription.routes"
import discountRouter from "../discount/discount.routes"
import availabilityRouter from "../availability/availability.route"
import orderRouter from "../order/order.routes"
import claimRouter from "../claim/claim.routes"
import testResultRouter from "../testResult/test.result.routes"
import adminRouter from "../admin/admin.routes"
import reviewRouter from "../review/review.routes"
import paymentRouter from "../payment/payment.routes"

export default class App {
  static appConfig(app: express.Application): void {
    const globalRoutePrefix = "/api/v1"

    const allowedMethods = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ] as string[]

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL_ADMIN,
      process.env.FRONTEND_URL_DEV,
      process.env.CLINIC_PUBLIC_URL
    ].filter(Boolean) as string[]

    app
      .use(
        cors({
          origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true)
            } else {
              callback(new Error("Not allowed by CORS"))
            }
          },
          methods: allowedMethods,
          credentials: true
        })
      )
      .options("*", cors())
      .use(cookieParser())
      .use(express.json())
      .use(helmet())
      .use(morgan("dev"))

      .get("/", (req: express.Request, res: express.Response) => {
        res.send(`${new Date().toLocaleDateString()}`)
      })

      .use(`${globalRoutePrefix}/patient`, patientRouter)
      .use(`${globalRoutePrefix}/clinic`, clinicRouter)
      .use(`${globalRoutePrefix}/tests`, testRouter)
      .use(`${globalRoutePrefix}/cart`, testBookingRouter)
      .use(`${globalRoutePrefix}/discount`, discountRouter)
      .use(`${globalRoutePrefix}/availability`, availabilityRouter)
      .use(`${globalRoutePrefix}/orders`, orderRouter)
      .use(`${globalRoutePrefix}/payment`, paymentRouter)
      .use(`${globalRoutePrefix}/test-result`, testResultRouter)
      .use(`${globalRoutePrefix}/review`, reviewRouter)
      .use(`${globalRoutePrefix}/admin`, adminRouter)
      .use(`${globalRoutePrefix}/subscription`, subscriptionRouter)
      .use(`${globalRoutePrefix}/claims`, claimRouter)

      .all("*", (req, _, next) => {
        const err = new appError(
          httpStatus.NOT_FOUND,
          `Are You Lost? (${req.originalUrl}) Not found`
        )
        next(err)
      })
      .use(errorHandler)
  }
}
