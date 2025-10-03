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
exports.ClinicAccessGuard = ClinicAccessGuard;
const http_status_1 = __importDefault(require("http-status"));
const utils_1 = require("../utils");
const clinic_model_1 = __importDefault(require("./clinic.model"));
const app_error_1 = __importDefault(require("../utils/app.error"));
function ClinicAccessGuard(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        try {
            const clinicId = (0, utils_1.getClinicId)(req);
            const clinic = yield clinic_model_1.default.findById(clinicId);
            if (!clinic) {
                throw new app_error_1.default(http_status_1.default.NOT_FOUND, "Clinic not found.");
            }
            if (clinic.status !== "approved") {
                throw new app_error_1.default(http_status_1.default.FORBIDDEN, "Access denied. Your clinic is not approved. Please contact admin support for clarification or reactivation.");
            }
            const certStatus = (_a = clinic.certificate) === null || _a === void 0 ? void 0 : _a.status;
            if (certStatus !== "approved") {
                const baseMessage = certStatus === "rejected"
                    ? "Access denied. Your certificate of operation was rejected."
                    : "Access denied. Your certificate of operation is still under review.";
                const reasons = certStatus === "rejected" &&
                    ((_c = (_b = clinic.certificate) === null || _b === void 0 ? void 0 : _b.rejectionReasons) === null || _c === void 0 ? void 0 : _c.length)
                    ? ` Reason(s): ${(_e = (_d = clinic.certificate) === null || _d === void 0 ? void 0 : _d.rejectionReasons) === null || _e === void 0 ? void 0 : _e.join("; ")}`
                    : "";
                throw new app_error_1.default(http_status_1.default.FORBIDDEN, `${baseMessage}${reasons} Please upload a valid certificate or contact support for assistance.`);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    });
}
