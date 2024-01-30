"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBody = exports.parseURI = void 0;
const body_parser_1 = __importDefault(require("body-parser"));
const parseURI = (req, res, next) => {
    var err = null;
    try {
        decodeURIComponent(req.path);
    }
    catch (e) {
        err = e;
    }
    if (err) {
        return res.redirect('/');
    }
    next();
};
exports.parseURI = parseURI;
const parseBody = (req, res, next) => {
    body_parser_1.default.json()(req, res, (error) => {
        if (error && error.status >= 400) {
            res.status(400).send({ message: "Invalid request body" });
        }
        else {
            next();
        }
    });
};
exports.parseBody = parseBody;
