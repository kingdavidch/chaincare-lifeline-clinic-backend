import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { IAdminPayload } from "./admin.types"
import appError from "../utils/app.error"
import httpStatus from "http-status"
import AdminModel from "./admin.model"
import "dotenv/config"

export default class AdminMiddleware {
  private static extractTokenFromHeader(
    authorizationHeader: string | undefined
  ): string {
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
      const token = AdminMiddleware.extractTokenFromHeader(
        req.headers.authorization
      )

      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as IAdminPayload

      const admin = await AdminModel.findById(payload.id)
      if (!admin) {
        throw new appError(httpStatus.NOT_FOUND, "Authorization failed")
      }

      req.admin = {
        id: admin._id.toString(),
        email: admin.email,
        userName: admin.userName
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
