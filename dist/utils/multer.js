"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.certificateUpload = exports.testResultUpload = exports.avatarUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const allowedFileTypes = {
    image: { types: /jpeg|jpg|png|gif/, maxSize: 5 * 1024 * 1024 }, // 5MB for images
    avatar: { types: /jpeg|jpg|png|gif/, maxSize: 5 * 1024 * 1024 }, // Adding avatar as an alias for image
    testResult: { types: /pdf/, maxSize: 10 * 1024 * 1024 }, // 10MB limit for test result PDFs
    certificate: {
        types: /pdf|jpeg|jpg|png|gif/,
        maxSize: 10 * 1024 * 1024 // 10MB limit
    }
};
const createFileFilter = (allowedTypes) => (req, file, cb) => {
    const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    if (extname && mimeType) {
        cb(null, true);
    }
    else {
        cb(new Error(`Unsupported file type. Allowed types: ${allowedTypes.toString()}`));
    }
};
const createMulterUpload = (fileType) => {
    if (!allowedFileTypes[fileType]) {
        throw new Error(`Invalid file type: ${fileType}`);
    }
    const { types, maxSize } = allowedFileTypes[fileType];
    return (0, multer_1.default)({
        storage: multer_1.default.memoryStorage(),
        limits: { fileSize: maxSize },
        fileFilter: createFileFilter(types)
    });
};
exports.avatarUpload = createMulterUpload("avatar");
exports.testResultUpload = createMulterUpload("testResult");
exports.certificateUpload = createMulterUpload("certificate");
