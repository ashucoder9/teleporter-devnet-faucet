"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const range_check_1 = require("range_check");
class RateLimiter {
    constructor(app, configs, keyGenerator) {
        var _a, _b, _c, _d;
        this.PATH = configs[0].RATELIMIT.PATH || '/api/sendToken';
        let rateLimiters = new Map();
        configs.forEach((config) => {
            const { RATELIMIT } = config;
            let RL_CONFIG = {
                MAX_LIMIT: RATELIMIT.MAX_LIMIT,
                WINDOW_SIZE: RATELIMIT.WINDOW_SIZE,
                SKIP_FAILED_REQUESTS: RATELIMIT.SKIP_FAILED_REQUESTS || true,
            };
            rateLimiters.set(config.ID, this.getLimiter(RL_CONFIG, keyGenerator));
        });
        if ((_b = (_a = configs[0]) === null || _a === void 0 ? void 0 : _a.RATELIMIT) === null || _b === void 0 ? void 0 : _b.REVERSE_PROXIES) {
            app.set('trust proxy', (_d = (_c = configs[0]) === null || _c === void 0 ? void 0 : _c.RATELIMIT) === null || _d === void 0 ? void 0 : _d.REVERSE_PROXIES);
        }
        app.use(this.PATH, (req, res, next) => {
            if (this.PATH == '/api/sendToken' && req.body.chain) {
                return rateLimiters.get(req.body.erc20 ? req.body.erc20 : req.body.chain)(req, res, next);
            }
            else {
                return rateLimiters.get(configs[0].ID)(req, res, next);
            }
        });
    }
    getLimiter(config, keyGenerator) {
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: config.WINDOW_SIZE * 60 * 1000,
            max: config.MAX_LIMIT,
            standardHeaders: true,
            legacyHeaders: false,
            skipFailedRequests: config.SKIP_FAILED_REQUESTS,
            message: {
                message: `Too many requests. Please try again after ${config.WINDOW_SIZE} minutes`
            },
            keyGenerator: keyGenerator ? keyGenerator : (req, res) => {
                const ip = this.getIP(req);
                if (ip != null) {
                    return ip;
                }
            }
        });
        return limiter;
    }
    getIP(req) {
        const ip = req.headers['cf-connecting-ip'] || req.ip;
        return (0, range_check_1.searchIP)(ip);
    }
}
exports.RateLimiter = RateLimiter;
