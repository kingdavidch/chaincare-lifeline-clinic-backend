import moment from "moment"

import httpStatus from "http-status"
import AppError from "../utils/app.error"
import subscriptionModel from "./subscription.model"

export const canUseSubscription = async (patientId: string) => {
  const subscription = await subscriptionModel.findOne({
    patient: patientId,
    status: "active",
    isPaid: true
  })

  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, "No active subscription found.")
  }

  const now = moment()
  const startDate = moment(subscription.startDate)

  // Enforce 72-hour activation delay
  const delayPassed = now.diff(startDate, "hours") >= 72
  if (!delayPassed) {
    const remainingHours = 72 - now.diff(startDate, "hours")
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Subscription will be usable in ${remainingHours} hour(s).`
    )
  }

  // Enforce 14-day rule between tests
  const lastDates = subscription.lastTestDates || []
  const lastTestDate = lastDates.length
    ? moment(lastDates[lastDates.length - 1])
    : null

  if (lastTestDate && now.diff(lastTestDate, "days") < 14) {
    const nextDate = lastTestDate.add(14, "days")
    throw new AppError(
      httpStatus.FORBIDDEN,
      `You can only use your subscription once every 14 days. Next usage: ${nextDate.format("dddd, MMMM D, YYYY")}`
    )
  }

  // Enforce 2-test monthly limit
  if ((subscription.remainingTests ?? 0) <= 0) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You have used all 2 allowed tests for this month."
    )
  }

  return subscription
}
