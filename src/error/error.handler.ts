import { Request, Response, NextFunction } from "express"
import AppError from "../utils/app.error"

interface ErrorResponse {
  success: boolean
  message: string
  details?: string
  status: number
}

const handleError = (err: AppError, res: Response) => {
  const statusCode = err.statusCode || 500

  const errorResponse: ErrorResponse = {
    success: false,
    message: err.message,
    details: err.details,
    status: statusCode
  }

  return res.status(statusCode).json(errorResponse)
}

const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  handleError(err, res)
  next()
}

export default errorHandler
