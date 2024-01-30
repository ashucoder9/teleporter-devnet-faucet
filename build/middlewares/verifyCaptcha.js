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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyCaptcha = void 0;
const axios = require('axios');
class VerifyCaptcha {
    constructor(app, CAPTCHA_SECRET, V2_CAPTCHA_SECRET) {
        this.middleware = (req, res, next) => this.verifyCaptcha(req, res, next);
        if (typeof CAPTCHA_SECRET != "string") {
            throw "Captcha Secret should be string";
        }
        this.secret = CAPTCHA_SECRET;
        this.v2secret = V2_CAPTCHA_SECRET;
    }
    verifyV2Token(v2Token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (v2Token) {
                const URL = `https://www.google.com/recaptcha/api/siteverify?secret=${this.v2secret}&response=${v2Token}`;
                let response;
                try {
                    response = yield axios.post(URL)
                        .then((r) => {
                        return r;
                    });
                }
                catch (err) {
                    console.log("Recaptcha V2 error:", err === null || err === void 0 ? void 0 : err.message);
                }
                const data = response === null || response === void 0 ? void 0 : response.data;
                if (data === null || data === void 0 ? void 0 : data.success) {
                    return true;
                }
            }
            return false;
        });
    }
    verifyV3Token(v3Token) {
        return __awaiter(this, void 0, void 0, function* () {
            const URL = `https://www.google.com/recaptcha/api/siteverify?secret=${this.secret}&response=${v3Token}`;
            let response;
            try {
                response = yield axios.post(URL);
            }
            catch (err) {
                console.log("Recaptcha V3 error:", err === null || err === void 0 ? void 0 : err.message);
            }
            const data = response === null || response === void 0 ? void 0 : response.data;
            if (data === null || data === void 0 ? void 0 : data.success) {
                if ((data === null || data === void 0 ? void 0 : data.action) == 'faucetdrip') {
                    if ((data === null || data === void 0 ? void 0 : data.score) > 0.5) {
                        return true;
                    }
                }
            }
            return false;
        });
    }
    shouldAllow(token, v2Token) {
        return __awaiter(this, void 0, void 0, function* () {
            // temporarily turn-off recaptcha v3 verifications
            if (false && (yield this.verifyV3Token(token))) {
                return true;
            }
            else {
                if (yield this.verifyV2Token(v2Token)) {
                    return true;
                }
            }
            return false;
        });
    }
    verifyCaptcha(req, res, next) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const shouldAllow = yield this.shouldAllow((_a = req === null || req === void 0 ? void 0 : req.body) === null || _a === void 0 ? void 0 : _a.token, (_b = req === null || req === void 0 ? void 0 : req.body) === null || _b === void 0 ? void 0 : _b.v2Token);
            if (shouldAllow) {
                next();
            }
            else {
                return res.status(400).send({ message: "Captcha verification failed! Try solving below." });
            }
        });
    }
}
exports.VerifyCaptcha = VerifyCaptcha;
