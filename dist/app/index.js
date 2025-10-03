"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_error_1 = __importDefault(require("../utils/app.error"));
const http_status_1 = __importDefault(require("http-status"));
const error_handler_1 = __importDefault(require("../error/error.handler"));
const clinic_routes_1 = __importDefault(require("../clinic/clinic.routes"));
const test_routes_1 = __importDefault(require("../test/test.routes"));
const patient_routes_1 = __importDefault(require("../patient/patient.routes"));
const testBooking_routes_1 = __importDefault(require("../testBooking(Cart)/testBooking.routes"));
const subscription_routes_1 = __importDefault(require("../subscription/subscription.routes"));
const discount_routes_1 = __importDefault(require("../discount/discount.routes"));
const order_routes_1 = __importDefault(require("../order/order.routes"));
const claim_routes_1 = __importDefault(require("../claim/claim.routes"));
const test_result_routes_1 = __importDefault(require("../testResult/test.result.routes"));
const admin_routes_1 = __importDefault(require("../admin/admin.routes"));
const review_routes_1 = __importDefault(require("../review/review.routes"));
const payment_routes_1 = __importDefault(require("../payment/payment.routes"));
class App {
    static appConfig(app) {
        const globalRoutePrefix = "/api/v1";
        const allowedMethods = [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ];
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            process.env.FRONTEND_URL_ADMIN,
            process.env.FRONTEND_URL_DEV
        ].filter(Boolean);
        app
            .use((0, cors_1.default)({
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                }
                else {
                    callback(new Error("Not allowed by CORS"));
                }
            },
            methods: allowedMethods,
            credentials: true
        }))
            .options("*", (0, cors_1.default)())
            .use((0, cookie_parser_1.default)())
            .use(express_1.default.json())
            .use((0, helmet_1.default)())
            .use((0, morgan_1.default)("dev"))
            .get("/", (req, res) => {
            res.send(`${new Date().toLocaleDateString()}`);
        })
            .use(`${globalRoutePrefix}/patient`, patient_routes_1.default)
            .use(`${globalRoutePrefix}/clinic`, clinic_routes_1.default)
            .use(`${globalRoutePrefix}/tests`, test_routes_1.default)
            .use(`${globalRoutePrefix}/cart`, testBooking_routes_1.default)
            .use(`${globalRoutePrefix}/discount`, discount_routes_1.default)
            .use(`${globalRoutePrefix}/orders`, order_routes_1.default)
            .use(`${globalRoutePrefix}/payment`, payment_routes_1.default)
            .use(`${globalRoutePrefix}/test-result`, test_result_routes_1.default)
            .use(`${globalRoutePrefix}/review`, review_routes_1.default)
            .use(`${globalRoutePrefix}/admin`, admin_routes_1.default)
            .use(`${globalRoutePrefix}/subscription`, subscription_routes_1.default)
            .use(`${globalRoutePrefix}/claims`, claim_routes_1.default)
            .all("*", (req, _, next) => {
            const err = new app_error_1.default(http_status_1.default.NOT_FOUND, `Are You Lost? (${req.originalUrl}) Not found`);
            next(err);
        })
            .use(error_handler_1.default);
    }
}
exports.default = App;
