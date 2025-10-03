"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_error_1 = __importDefault(require("../utils/app.error"));
const http_status_1 = __importDefault(require("http-status"));
const clinic_model_1 = __importDefault(require("./clinic.model"));
require("dotenv/config");
class ClinicMiddleware {
    static extractToken(req) {
        var _a;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const parts = authHeader.split(" ");
            if (parts.length !== 2 || parts[0] !== "Bearer") {
                throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Token format is invalid.");
            }
            return parts[1];
        }
        const cookieToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token;
        if (cookieToken)
            return cookieToken;
        throw new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Token not provided.");
    }
    static authenticate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const token = ClinicMiddleware.extractToken(req);
                const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                const clinic = yield clinic_model_1.default.findById(payload.id);
                if (!clinic) {
                    throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Authorization failed");
                }
                req.clinic = {
                    id: clinic._id.toString(),
                    email: clinic.email,
                    clinicName: clinic.clinicName
                };
                next();
            }
            catch (error) {
                if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                    return next(new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Invalid token."));
                }
                return next(error instanceof app_error_1.default
                    ? error
                    : new app_error_1.default(http_status_1.default.UNAUTHORIZED, "Authorization failed."));
            }
        });
    }
}
exports.default = ClinicMiddleware;
