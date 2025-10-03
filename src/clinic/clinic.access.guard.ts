import { Request, Response, NextFunction } from "express"
import httpStatus from "http-status"
import { getClinicId } from "../utils"
import clinicModel from "./clinic.model"
import AppError from "../utils/app.error"

export async function ClinicAccessGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clinicId = getClinicId(req)
    const clinic = await clinicModel.findById(clinicId)

    if (!clinic) {
      throw new AppError(httpStatus.NOT_FOUND, "Clinic not found.")
    }

    if (clinic.status !== "approved") {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Access denied. Your clinic is not approved. Please contact admin support for clarification or reactivation."
      )
    }

    const certStatus = clinic.certificate?.status
    if (certStatus !== "approved") {
      const baseMessage =
        certStatus === "rejected"
          ? "Access denied. Your certificate of operation was rejected."
          : "Access denied. Your certificate of operation is still under review."

      const reasons =
        certStatus === "rejected" &&
        clinic.certificate?.rejectionReasons?.length
          ? ` Reason(s): ${clinic.certificate?.rejectionReasons?.join("; ")}`
          : ""

      throw new AppError(
        httpStatus.FORBIDDEN,
        `${baseMessage}${reasons} Please upload a valid certificate or contact support for assistance.`
      )
    }

    next()
  } catch (error) {
    next(error)
  }
}
