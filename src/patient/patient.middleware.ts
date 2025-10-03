import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import appError from "../utils/app.error"
import httpStatus from "http-status"
import "dotenv/config"
import patientModel from "./patient.model"
import { IPatientPayload } from "./patient.types"

export default class PatientMiddleware {
  private static extractTokenFromHeader(authorizationHeader?: string): string {
    if (!authorizationHeader) {
      throw new appError(httpStatus.UNAUTHORIZED, "Token not provided.")
    }

    const parts = authorizationHeader.split(" ")
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new appError(httpStatus.UNAUTHORIZED, "Token format is invalid.")
    }

    return parts[1]
  }

  public static async authenticate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Extract token from the Authorization header
      const token = PatientMiddleware.extractTokenFromHeader(
        req.headers.authorization
      )

      // Verify the token and extract the payload
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as IPatientPayload

      // Find the patient by ID from the payload
      const patient = await patientModel.findById(payload.id)
      if (!patient) {
        throw new appError(httpStatus.NOT_FOUND, "Authorization failed")
      }

      req.patient = {
        id: patient._id.toString(),
        email: patient.email,
        fullName: patient.fullName
      }

      next()
    } catch (error) {
      // Handle token errors
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new appError(httpStatus.UNAUTHORIZED, "Invalid token."))
      }

      return next(
        error instanceof appError
          ? error
          : new appError(httpStatus.UNAUTHORIZED, "Authorization failed.")
      )
    }
  }
}
