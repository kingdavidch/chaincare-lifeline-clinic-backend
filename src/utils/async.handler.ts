import { Request, Response, NextFunction } from "express"

/* eslint-disable @typescript-eslint/no-explicit-any */
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next)

export default asyncHandler
