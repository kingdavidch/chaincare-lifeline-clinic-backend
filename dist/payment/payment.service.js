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
exports.YellowCardService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const axios_1 = __importDefault(require("axios"));
const http_status_1 = __importDefault(require("http-status"));
const app_error_1 = __importDefault(require("../utils/app.error"));
const yc_auth_headers_1 = require("./yc.auth.headers");
require("dotenv/config");
class YellowCardService {
    constructor() {
        this.baseUrl = process.env.YELLOWCARD_BASE_URL;
        this.apiKey = process.env.YELLOWCARD_API_KEY;
        this.apiSecret = process.env.YELLOWCARD_API_SECRET;
    }
    getPaymentChannels(country, rampType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            if (!this.apiKey || !this.apiSecret) {
                throw new app_error_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Missing YC credentials");
            }
            const path = "/business/channels";
            const fullUrl = `${this.baseUrl}${path}`;
            const headers = (0, yc_auth_headers_1.generateYCHeaders)({
                path,
                method: "GET",
                apiKey: this.apiKey,
                apiSecret: this.apiSecret
            });
            try {
                const response = yield axios_1.default.get(fullUrl, {
                    headers,
                    params: { country }
                });
                const allChannels = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.channels) || [];
                if (rampType) {
                    return allChannels.filter((channel) => channel.rampType === rampType);
                }
                return allChannels;
            }
            catch (error) {
                const msg = ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || error.message;
                const status = ((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) || 500;
                console.error("🔴 YC Error:", (_e = error.response) === null || _e === void 0 ? void 0 : _e.data);
                throw new app_error_1.default(status, `YC getChannels failed: ${msg}`);
            }
        });
    }
    getExchangeRate(from, to) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!this.apiKey || !this.apiSecret) {
                throw new app_error_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Missing YC credentials");
            }
            const path = `/business/rates`;
            const fullUrl = `${this.baseUrl}${path}`;
            const headers = (0, yc_auth_headers_1.generateYCHeaders)({
                path,
                method: "GET",
                apiKey: this.apiKey,
                apiSecret: this.apiSecret
            });
            try {
                const response = yield axios_1.default.get(fullUrl, {
                    headers,
                    params: { from, to }
                });
                return response.data;
            }
            catch (error) {
                const msg = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || error.message;
                const status = ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) || 500;
                throw new app_error_1.default(status, `YC getExchangeRate failed: ${msg}`);
            }
        });
    }
    submitCollectionRequest(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!this.apiKey || !this.apiSecret) {
                throw new app_error_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Missing YC credentials");
            }
            const path = "/business/collections";
            const fullUrl = `${this.baseUrl}${path}`;
            const body = {
                amount: data.amount,
                channelId: data.channelId,
                currency: data.currency || "USD",
                sequenceId: data.sequenceId || `txn_${Date.now()}`,
                recipient: data.recipient,
                source: data.source || {
                    accountType: "bank",
                    accountNumber: "1111111111" // sandbox test number
                },
                customerType: "retail",
                forceAccept: true,
                customerUID: data.customerUID
            };
            const headers = (0, yc_auth_headers_1.generateYCHeaders)({
                path,
                method: "POST",
                apiKey: this.apiKey,
                apiSecret: this.apiSecret,
                body
            });
            try {
                const response = yield axios_1.default.post(fullUrl, body, { headers });
                return response.data;
            }
            catch (error) {
                const msg = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || error.message;
                const status = ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) || 500;
                console.error("🔴 YC Error:", (_d = error.response) === null || _d === void 0 ? void 0 : _d.data);
                throw new app_error_1.default(status, `YC submitCollectionRequest failed: ${msg}`);
            }
        });
    }
    acceptCollectionRequest(collectionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!this.apiKey || !this.apiSecret) {
                throw new app_error_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Missing YC credentials");
            }
            const path = `/business/collections/${collectionId}/accept`;
            const fullUrl = `${this.baseUrl}${path}`;
            const headers = (0, yc_auth_headers_1.generateYCHeaders)({
                path,
                method: "POST",
                apiKey: this.apiKey,
                apiSecret: this.apiSecret
            });
            try {
                const response = yield axios_1.default.post(fullUrl, null, { headers });
                return response.data;
            }
            catch (error) {
                const msg = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || error.message;
                const status = ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) || 500;
                console.error("🔴 YC Error:", (_d = error.response) === null || _d === void 0 ? void 0 : _d.data);
                throw new app_error_1.default(status, `YC acceptCollectionRequest failed: ${msg}`);
            }
        });
    }
    getCollectionDetails(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!this.apiKey || !this.apiSecret) {
                throw new app_error_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Missing YC credentials");
            }
            const path = `/business/collections/${id}`;
            const fullUrl = `${this.baseUrl}${path}`;
            const headers = (0, yc_auth_headers_1.generateYCHeaders)({
                path,
                method: "GET",
                apiKey: this.apiKey,
                apiSecret: this.apiSecret
            });
            try {
                const response = yield axios_1.default.get(fullUrl, {
                    headers
                });
                return response.data;
            }
            catch (error) {
                const msg = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || error.message;
                const status = ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) || 500;
                console.error("🔴 YC Error:", (_d = error.response) === null || _d === void 0 ? void 0 : _d.data);
                throw new app_error_1.default(status, `YC getCollectionDetails failed: ${msg}`);
            }
        });
    }
    submitPayoutRequest(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            if (!this.apiKey || !this.apiSecret) {
                throw new app_error_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Missing YC credentials");
            }
            const path = "/business/payments";
            const fullUrl = `${this.baseUrl}${path}`;
            const networkId = yield this.getNetworkIdByCountry("RW");
            const body = {
                amount: data.amount,
                currency: data.currency,
                channelId: data.channelId,
                sequenceId: data.sequenceId,
                forceAccept: (_a = data.forceAccept) !== null && _a !== void 0 ? _a : true,
                customerType: (_b = data.customerType) !== null && _b !== void 0 ? _b : "retail",
                reason: data.recipient.reason,
                customerUID: data.customerUID.toString(),
                sender: {
                    name: process.env.YC_SENDER_NAME,
                    country: process.env.YC_SENDER_COUNTRY,
                    phone: process.env.YC_SENDER_PHONE,
                    address: process.env.YC_SENDER_ADDRESS,
                    dob: process.env.YC_SENDER_DOB,
                    email: process.env.YC_SENDER_EMAIL,
                    idNumber: process.env.YC_SENDER_ID_NUMBER,
                    idType: process.env.YC_SENDER_ID_TYPE
                },
                destination: {
                    accountNumber: data.recipient.accountNumber,
                    accountType: "bank",
                    networkId,
                    bank: {
                        accountBank: data.recipient.bankName,
                        networkName: data.recipient.bankName,
                        country: data.recipient.country
                    },
                    accountName: data.recipient.accountName,
                    phoneNumber: data.recipient.phoneNumber,
                    country: "RW"
                }
            };
            const headers = (0, yc_auth_headers_1.generateYCHeaders)({
                path,
                method: "POST",
                apiKey: this.apiKey,
                apiSecret: this.apiSecret,
                body
            });
            try {
                const response = yield axios_1.default.post(fullUrl, body, {
                    headers
                });
                return response.data;
            }
            catch (error) {
                const msg = ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || error.message;
                const status = ((_e = error.response) === null || _e === void 0 ? void 0 : _e.status) || 500;
                console.error("🔴 YC payout submit error:", (_f = error.response) === null || _f === void 0 ? void 0 : _f.data);
                throw new app_error_1.default(status, `YC submitPayoutRequest failed: ${msg}`);
            }
        });
    }
    acceptPayoutRequest(paymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!this.apiKey || !this.apiSecret) {
                throw new app_error_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Missing YC credentials");
            }
            const path = `/business/payments/${paymentId}/accept`;
            const fullUrl = `${this.baseUrl}${path}`;
            const headers = (0, yc_auth_headers_1.generateYCHeaders)({
                path,
                method: "POST",
                apiKey: this.apiKey,
                apiSecret: this.apiSecret
            });
            try {
                const response = yield axios_1.default.post(fullUrl, null, {
                    headers
                });
                return response.data;
            }
            catch (error) {
                const msg = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || error.message;
                const status = ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) || 500;
                console.error("🔴 YC payout accept error:", (_d = error.response) === null || _d === void 0 ? void 0 : _d.data);
                throw new app_error_1.default(status, `YC acceptPayoutRequest failed: ${msg}`);
            }
        });
    }
    getNetworkIdByCountry(country) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!this.apiKey || !this.apiSecret) {
                throw new app_error_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Missing YC credentials");
            }
            const path = `/business/networks`;
            const fullUrl = `${this.baseUrl}${path}`;
            const headers = (0, yc_auth_headers_1.generateYCHeaders)({
                path,
                method: "GET",
                apiKey: this.apiKey,
                apiSecret: this.apiSecret
            });
            try {
                const response = yield axios_1.default.get(fullUrl, {
                    headers,
                    params: { country }
                });
                const networks = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.networks) || [];
                if (!networks.length) {
                    throw new app_error_1.default(404, `No networks found for country: ${country}`);
                }
                return networks[0].id;
            }
            catch (error) {
                const msg = ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || error.message;
                const status = ((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) || 500;
                throw new app_error_1.default(status, `YC getBankNetworks failed: ${msg}`);
            }
        });
    }
}
exports.YellowCardService = YellowCardService;
