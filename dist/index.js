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
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const db_1 = __importDefault(require("./config/db"));
const app_1 = __importDefault(require("./app"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const shouldCompress = (req, res) => {
    if (req.headers["x-no-compression"])
        return false;
    return compression_1.default.filter(req, res);
};
app.use((0, compression_1.default)({
    filter: shouldCompress,
    threshold: 0
}));
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, { cors: { origin: "*" } });
exports.io = io;
io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield db_1.default.connect();
        app_1.default.appConfig(app);
        httpServer.listen(port, () => {
            console.log(`${new Date().toLocaleString()} Server running on port: ${port}`);
        });
        handleProcessEvents(httpServer);
    }
    catch (error) {
        console.error("Failed to connect to the database:", error);
        process.exit(1);
    }
});
startServer();
function handleProcessEvents(server) {
    server.on("error", handleError);
    process.on("uncaughtException", handleUncaughtException);
    process.on("unhandledRejection", (reason) => {
        handleUnhandledRejection(reason, server);
    });
}
function handleError(error) {
    if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use.`);
    }
    else {
        console.error("Error starting server:", error);
    }
    process.exit(1);
}
function handleUncaughtException(error) {
    console.error("Uncaught exception:", error);
    process.exit(1);
}
function handleUnhandledRejection(reason, server) {
    console.error("Unhandled rejection:", reason);
    server.close(() => process.exit(1));
}
