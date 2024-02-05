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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const avalanche_1 = require("avalanche");
const middlewares_1 = require("./middlewares");
const evm_1 = __importDefault(require("./vms/evm"));
const config_json_1 = require("./config.json");
dotenv_1.default.config();
const app = (0, express_1.default)();
const router = express_1.default.Router();
app.use((0, cors_1.default)());
app.use(middlewares_1.parseURI);
app.use(middlewares_1.parseBody);
if (config_json_1.NATIVE_CLIENT) {
    app.use(express_1.default.static(path_1.default.join(__dirname, "client")));
}
// address rate limiter
new middlewares_1.RateLimiter(app, [
    ...config_json_1.evmchains,
    ...config_json_1.erc20tokens
], (req, res) => {
    var _a;
    const addr = (_a = req.body) === null || _a === void 0 ? void 0 : _a.address;
    if (typeof addr == "string" && addr) {
        return addr.toUpperCase();
    }
});
const captcha = new middlewares_1.VerifyCaptcha(app, process.env.CAPTCHA_SECRET, process.env.V2_CAPTCHA_SECRET);
let evms = new Map();
// Get the complete config object from the array of config objects (chains) with ID as id
const getChainByID = (chains, id) => {
    let reply;
    chains.forEach((chain) => {
        if (chain.ID == id) {
            reply = chain;
        }
    });
    return reply;
};
// Populates the missing config keys of the child using the parent's config
const populateConfig = (child, parent) => {
    Object.keys(parent || {}).forEach((key) => {
        if (!child[key]) {
            child[key] = parent[key];
        }
    });
    return child;
};
// Setting up instance for EVM chains
config_json_1.evmchains.forEach((chain) => {
    const chainInstance = new evm_1.default(chain, process.env[chain.ID] || process.env.PK);
    evms.set(chain.ID, {
        config: chain,
        instance: chainInstance
    });
});
// Adding ERC20 token contracts to their HOST evm instances
config_json_1.erc20tokens.forEach((token, i) => {
    var _a;
    if (token.HOSTID) {
        token = populateConfig(token, getChainByID(config_json_1.evmchains, token.HOSTID));
    }
    config_json_1.erc20tokens[i] = token;
    const evm = evms.get((_a = getChainByID(config_json_1.evmchains, token.HOSTID)) === null || _a === void 0 ? void 0 : _a.ID);
    evm === null || evm === void 0 ? void 0 : evm.instance.addERC20Contract(token);
});
// POST request for sending tokens or coins
router.post('/sendToken', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const address = (_a = req.body) === null || _a === void 0 ? void 0 : _a.address;
    const chain = (_b = req.body) === null || _b === void 0 ? void 0 : _b.chain;
    const erc20 = (_c = req.body) === null || _c === void 0 ? void 0 : _c.erc20;
    const evm = evms.get(chain);
    if (evm) {
        config_json_1.DEBUG && console.log("address:", address, "chain:", chain, "erc20:", erc20, "ip:", req.headers["cf-connecting-ip"] || req.ip);
        evm === null || evm === void 0 ? void 0 : evm.instance.sendToken(address, erc20, (data) => {
            const { status, message, txHash } = data;
            res.status(status).send({ message, txHash });
        });
    }
    else {
        res.status(400).send({ message: "Invalid parameters passed!" });
    }
}));
// GET request for fetching all the chain and token configurations
router.get('/getChainConfigs', (req, res) => {
    const configs = [...config_json_1.evmchains, ...config_json_1.erc20tokens];
    res.send({ configs });
});
// GET request for fetching faucet address for the specified chain
router.get('/faucetAddress', (req, res) => {
    var _a;
    const chain = (_a = req.query) === null || _a === void 0 ? void 0 : _a.chain;
    const evm = evms.get(chain);
    res.send({
        address: evm === null || evm === void 0 ? void 0 : evm.instance.account.address
    });
});
// GET request for fetching faucet balance for the specified chain or token
router.get('/getBalance', (req, res) => {
    var _a, _b;
    const chain = (_a = req.query) === null || _a === void 0 ? void 0 : _a.chain;
    const erc20 = (_b = req.query) === null || _b === void 0 ? void 0 : _b.erc20;
    const evm = evms.get(chain);
    let balance = evm === null || evm === void 0 ? void 0 : evm.instance.getBalance(erc20);
    if (balance) {
        balance = balance;
    }
    else {
        balance = new avalanche_1.BN(0);
    }
    res.status(200).send({
        balance: balance === null || balance === void 0 ? void 0 : balance.toString()
    });
});
router.get('/faucetUsage', (req, res) => {
    var _a, _b;
    const chain = (_a = req.query) === null || _a === void 0 ? void 0 : _a.chain;
    const evm = evms.get(chain);
    const usage = (_b = evm === null || evm === void 0 ? void 0 : evm.instance) === null || _b === void 0 ? void 0 : _b.getFaucetUsage();
    res.status(200).send({
        usage
    });
});
app.use('/api', router);
app.get('/health', (req, res) => {
    res.status(200).send('Server healthy');
});
app.get('/ip', (req, res) => {
    res.status(200).send({
        ip: req.headers["cf-connecting-ip"] || req.ip
    });
});
app.get('*', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const chain = req.query.subnet;
    const erc20 = req.query.erc20;
    if (config_json_1.NATIVE_CLIENT) {
        res.sendFile(path_1.default.join(__dirname, "client", "index.html"));
    }
    else {
        res.redirect(`https://core.app/tools/testnet-faucet${chain ? "?subnet=" + chain + (erc20 ? "&token=" + erc20 : "") : ""}`);
    }
}));
app.listen(process.env.PORT || 8000, () => {
    console.log(`Server started at port ${process.env.PORT || 8000}`);
});
