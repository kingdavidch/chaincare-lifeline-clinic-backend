class AppError extends Error {
  constructor(
    public statusCode: number = 500,
    public message: string = "Something went wrong",
    public details?: string
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export default AppError
