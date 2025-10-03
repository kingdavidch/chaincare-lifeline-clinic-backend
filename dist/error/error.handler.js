"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handleError = (err, res) => {
    const statusCode = err.statusCode || 500;
    const errorResponse = {
        success: false,
        message: err.message,
        details: err.details,
        status: statusCode
    };
    return res.status(statusCode).json(errorResponse);
};
const errorHandler = (err, req, res, next) => {
    handleError(err, res);
    next();
};
exports.default = errorHandler;
