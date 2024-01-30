"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyTOTP = void 0;
const totp_generator_1 = __importDefault(require("totp-generator"));
class VerifyTOTP {
    constructor(KEY) {
        this.middleware = (req, res, next) => this.verifyTOTP(req, res, next);
        if (typeof KEY != "string") {
            throw "TOTP key should be a string";
        }
        this.KEY = KEY;
    }
    verifyTOTP(req, res, next) {
        var _a;
        const token = (0, totp_generator_1.default)(this.KEY);
        if (((_a = req.query) === null || _a === void 0 ? void 0 : _a.token) == token) {
            next();
        }
        else {
            res.status(403).send("Access denied! Invalid token.");
        }
    }
}
exports.VerifyTOTP = VerifyTOTP;
