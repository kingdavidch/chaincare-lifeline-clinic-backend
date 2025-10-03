"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AppError extends Error {
    constructor(statusCode = 500, message = "Something went wrong", details) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.details = details;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.default = AppError;
