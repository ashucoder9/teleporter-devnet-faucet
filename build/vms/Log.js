"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Log {
    constructor(chain) {
        this.error = (message) => {
            console.log(`ERROR ${this.chain}: ${message}`);
        };
        this.warn = (message) => {
            console.log(`WARNING ${this.chain}: ${message}`);
        };
        this.info = (message) => {
            console.log(`INFO ${this.chain}: ${message}`);
        };
        this.chain = chain;
    }
}
exports.default = Log;
