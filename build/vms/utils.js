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
exports.asyncCallWithTimeout = exports.calculateBaseUnit = void 0;
const avalanche_1 = require("avalanche");
function calculateBaseUnit(amount, decimals) {
    for (let i = 0; i < decimals; i++) {
        amount += "0";
    }
    return new avalanche_1.BN(amount);
}
exports.calculateBaseUnit = calculateBaseUnit;
const asyncCallWithTimeout = (asyncPromise, timeLimit, timeoutMessage) => __awaiter(void 0, void 0, void 0, function* () {
    let timeoutHandle;
    const timeoutPromise = new Promise((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeLimit);
    });
    return Promise.race([asyncPromise, timeoutPromise]).then(result => {
        clearTimeout(timeoutHandle);
        return result;
    });
});
exports.asyncCallWithTimeout = asyncCallWithTimeout;
