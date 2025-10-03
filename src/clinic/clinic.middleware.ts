import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { IClinicPayload } from "./clinic.types"
import appError from "../utils/app.error"
import httpStatus from "http-status"
import ClinicModel from "./clinic.model"
import "dotenv/config"

export default class ClinicMiddleware {
  private static extractToken(req: Request): string {
    const authHeader = req.headers.authorization
    if (authHeader) {
      const parts = authHeader.split(" ")
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        throw new appError(httpStatus.UNAUTHORIZED, "Token format is invalid.")
      }
      return parts[1]
    }

    const cookieToken = req.cookies?.token
    if (cookieToken) return cookieToken

    throw new appError(httpStatus.UNAUTHORIZED, "Token not provided.")
  }

  public static async authenticate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const token = ClinicMiddleware.extractToken(req)

      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as IClinicPayload

      const clinic = await ClinicModel.findById(payload.id)
      if (!clinic) {
        throw new appError(httpStatus.NOT_FOUND, "Authorization failed")
      }

      req.clinic = {
        id: clinic._id.toString(),
        email: clinic.email,
        clinicName: clinic.clinicName
      }

      next()
    } catch (error) {
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
