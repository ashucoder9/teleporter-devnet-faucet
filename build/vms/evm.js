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
const avalanche_1 = require("avalanche");
const web3_1 = __importDefault(require("web3"));
const utils_1 = require("./utils");
const Log_1 = __importDefault(require("./Log"));
const ERC20Interface_json_1 = __importDefault(require("./ERC20Interface.json"));
// cannot issue tx if no. of pending requests is > 16
const MEMPOOL_LIMIT = 15;
// pending tx timeout should be a function of MEMPOOL_LIMIT
const PENDING_TX_TIMEOUT = 40 * 1000; // 40 seconds
const BLOCK_FAUCET_DRIPS_TIMEOUT = 60 * 1000; // 60 seconds
class EVM {
    constructor(config, PK) {
        this.web3 = new web3_1.default(config.RPC);
        this.account = this.web3.eth.accounts.privateKeyToAccount(PK);
        this.contracts = new Map();
        this.NAME = config.NAME;
        this.DECIMALS = config.DECIMALS || 18;
        this.DRIP_AMOUNT = (0, utils_1.calculateBaseUnit)(config.DRIP_AMOUNT.toString(), this.DECIMALS);
        this.MAX_PRIORITY_FEE = config.MAX_PRIORITY_FEE;
        this.MAX_FEE = config.MAX_FEE;
        this.RECALIBRATE = config.RECALIBRATE || 30;
        this.LEGACY = false;
        this.log = new Log_1.default(this.NAME);
        this.hasNonce = new Map();
        this.hasError = new Map();
        this.pendingTxNonces = new Set();
        this.nonce = -1;
        this.balance = new avalanche_1.BN(0);
        this.isFetched = false;
        this.isUpdating = false;
        this.recalibrate = false;
        this.waitingForRecalibration = false;
        this.queuingInProgress = false;
        this.recalibrateNowActivated = false;
        this.requestCount = 0;
        this.waitArr = [];
        this.queue = [];
        this.error = false;
        this.blockFaucetDrips = true;
        this.setupTransactionType();
        this.recalibrateNonceAndBalance();
        setInterval(() => {
            this.recalibrateNonceAndBalance();
        }, this.RECALIBRATE * 1000);
        // just a check that requestCount is within the range (will indicate race condition)
        setInterval(() => {
            if (this.requestCount > MEMPOOL_LIMIT || this.requestCount < 0) {
                this.log.error(`request count not in range: ${this.requestCount}`);
            }
        }, 10 * 1000);
        // block requests during restart (to settle any pending txs initiated during shutdown)
        setTimeout(() => {
            this.log.info("starting faucet drips...");
            this.blockFaucetDrips = false;
        }, BLOCK_FAUCET_DRIPS_TIMEOUT);
    }
    // Setup Legacy or EIP1559 transaction type
    setupTransactionType() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const baseFee = (yield this.web3.eth.getBlock('latest')).baseFeePerGas;
                if (baseFee == undefined) {
                    this.LEGACY = true;
                }
                this.error = false;
            }
            catch (err) {
                this.error = true;
                this.log.error(err.message);
            }
        });
    }
    // Function to issue transfer transaction. For ERC20 transfers, 'id' will be a string representing ERC20 token ID
    sendToken(receiver, id, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.blockFaucetDrips) {
                cb({ status: 400, message: "Faucet is getting started! Please try after sometime" });
                return;
            }
            if (this.error) {
                cb({ status: 400, message: "Internal RPC error! Please try after sometime" });
                return;
            }
            if (!this.web3.utils.isAddress(receiver)) {
                cb({ status: 400, message: "Invalid address! Please try again." });
                return;
            }
            // do not accept any request if mempool limit reached
            if (this.requestCount >= MEMPOOL_LIMIT) {
                cb({ status: 400, message: "High faucet usage! Please try after sometime" });
                return;
            }
            // increasing request count before processing request
            this.requestCount++;
            let amount = this.DRIP_AMOUNT;
            // If id is provided, then it is ERC20 token transfer, so update the amount
            if (this.contracts.get(id)) {
                const dripAmount = this.contracts.get(id).config.DRIP_AMOUNT;
                if (dripAmount) {
                    amount = (0, utils_1.calculateBaseUnit)(dripAmount.toString(), this.contracts.get(id).config.DECIMALS || 18);
                }
            }
            const requestId = receiver + id + Math.random().toString();
            this.processRequest({ receiver, amount, id, requestId });
            // After transaction is being processed, the nonce will be available and txHash can be returned to user
            const waitingForNonce = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                if (this.hasNonce.get(requestId) != undefined) {
                    clearInterval(waitingForNonce);
                    const nonce = this.hasNonce.get(requestId);
                    this.hasNonce.set(requestId, undefined);
                    const { txHash } = yield this.getTransaction(receiver, amount, nonce, id);
                    if (txHash) {
                        cb({
                            status: 200,
                            message: `Transaction successful on ${this.NAME}!`,
                            txHash
                        });
                    }
                    else {
                        cb({
                            status: 400,
                            message: `Transaction failed on ${this.NAME}! Please try again.`
                        });
                    }
                }
                else if (this.hasError.get(receiver) != undefined) {
                    clearInterval(waitingForNonce);
                    const errorMessage = this.hasError.get(receiver);
                    this.hasError.set(receiver, undefined);
                    cb({
                        status: 400,
                        message: errorMessage
                    });
                }
            }), 300);
        });
    }
    /*
    * put in waiting array, if:
    * 1. balance/nonce is not fetched yet
    * 2. recalibrate in progress
    * 3. waiting for pending txs to confirm to begin recalibration
    *
    * else put in execution queue
    */
    processRequest(req) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isFetched || this.recalibrate || this.waitingForRecalibration) {
                this.waitArr.push(req);
                if (!this.isUpdating && !this.waitingForRecalibration) {
                    yield this.updateNonceAndBalance();
                }
            }
            else {
                this.putInQueue(req);
            }
        });
    }
    getBalance(id) {
        if (id && this.contracts.get(id)) {
            return this.getERC20Balance(id);
        }
        else {
            return this.balance;
        }
    }
    getERC20Balance(id) {
        var _a;
        return (_a = this.contracts.get(id)) === null || _a === void 0 ? void 0 : _a.balance;
    }
    fetchERC20Balance() {
        return __awaiter(this, void 0, void 0, function* () {
            this.contracts.forEach((contract) => __awaiter(this, void 0, void 0, function* () {
                contract.balance = new avalanche_1.BN(yield contract.methods.balanceOf(this.account.address).call());
            }));
        });
    }
    updateNonceAndBalance() {
        return __awaiter(this, void 0, void 0, function* () {
            // skip if already updating
            if (this.isUpdating) {
                return;
            }
            this.isUpdating = true;
            try {
                [this.nonce, this.balance] = yield Promise.all([
                    this.web3.eth.getTransactionCount(this.account.address, 'latest'),
                    this.web3.eth.getBalance(this.account.address),
                ]);
                yield this.fetchERC20Balance();
                this.balance = new avalanche_1.BN(this.balance);
                this.error && this.log.info("RPC server recovered!");
                this.error = false;
                this.isFetched = true;
                this.isUpdating = false;
                this.recalibrate = false;
                while (this.waitArr.length != 0) {
                    this.putInQueue(this.waitArr.shift());
                }
            }
            catch (err) {
                this.isUpdating = false;
                this.error = true;
                this.log.error(err.message);
            }
        });
    }
    balanceCheck(req) {
        const balance = this.getBalance(req.id);
        if (req.id && this.contracts.get(req.id)) {
            if (this.contracts.get(req.id).balance.gte(req.amount)) {
                this.contracts.get(req.id).balance = this.contracts.get(req.id).balance.sub(req.amount);
                return true;
            }
        }
        else {
            if (this.balance.gte(req.amount)) {
                this.balance = this.balance.sub(req.amount);
                return true;
            }
        }
        return false;
    }
    /*
    * 1. pushes a request in queue with the last calculated nonce
    * 2. sets `hasNonce` corresponding to `requestId` so users receive expected tx_hash
    * 3. increments the nonce for future request
    * 4. executes the queue
    */
    putInQueue(req) {
        return __awaiter(this, void 0, void 0, function* () {
            // this will prevent recalibration if it's started after calling putInQueue() function
            this.queuingInProgress = true;
            // checking faucet balance before putting request in queue
            if (this.balanceCheck(req)) {
                this.queue.push(Object.assign(Object.assign({}, req), { nonce: this.nonce }));
                this.hasNonce.set(req.requestId, this.nonce);
                this.nonce++;
                this.executeQueue();
            }
            else {
                this.queuingInProgress = false;
                this.requestCount--;
                this.log.warn("Faucet balance too low! " + req.id + " " + this.getBalance(req.id));
                this.hasError.set(req.receiver, "Faucet balance too low! Please try after sometime.");
            }
        });
    }
    // pops the 1st request in queue, and call the utility function to issue the tx
    executeQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            const { amount, receiver, nonce, id } = this.queue.shift();
            this.sendTokenUtil(amount, receiver, nonce, id);
        });
    }
    sendTokenUtil(amount, receiver, nonce, id) {
        return __awaiter(this, void 0, void 0, function* () {
            // adding pending tx nonce in a set to prevent recalibration
            this.pendingTxNonces.add(nonce);
            // request from queue is now moved to pending txs list
            this.queuingInProgress = false;
            const { rawTransaction } = yield this.getTransaction(receiver, amount, nonce, id);
            /*
            * [CRITICAL]
            * If a issued tx fails/timed-out, all succeeding nonce will stuck
            * and we need to cancel/re-issue the tx with higher fee.
            */
            try {
                /*
                * asyncCallWithTimeout function can return
                * 1. successfull response
                * 2. throw API error (will be catched by catch block)
                * 3. throw timeout error (will be catched by catch block)
                */
                yield (0, utils_1.asyncCallWithTimeout)(this.web3.eth.sendSignedTransaction(rawTransaction), PENDING_TX_TIMEOUT, `Timeout reached for transaction with nonce ${nonce}`);
            }
            catch (err) {
                this.log.error(err.message);
            }
            finally {
                this.pendingTxNonces.delete(nonce);
                this.requestCount--;
            }
        });
    }
    getTransaction(to, value, nonce, id) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const tx = {
                type: 2,
                gas: "21000",
                nonce,
                to,
                maxPriorityFeePerGas: this.MAX_PRIORITY_FEE,
                maxFeePerGas: this.MAX_FEE,
                value
            };
            if (this.LEGACY) {
                delete tx["maxPriorityFeePerGas"];
                delete tx["maxFeePerGas"];
                tx.gasPrice = yield this.getAdjustedGasPrice();
                tx.type = 0;
            }
            if (this.contracts.get(id)) {
                const txObject = (_a = this.contracts.get(id)) === null || _a === void 0 ? void 0 : _a.methods.transfer(to, value);
                tx.data = txObject.encodeABI();
                tx.value = 0;
                tx.to = (_b = this.contracts.get(id)) === null || _b === void 0 ? void 0 : _b.config.CONTRACTADDRESS;
                tx.gas = (_c = this.contracts.get(id)) === null || _c === void 0 ? void 0 : _c.config.GASLIMIT;
            }
            let signedTx;
            try {
                signedTx = yield this.account.signTransaction(tx);
            }
            catch (err) {
                this.error = true;
                this.log.error(err.message);
            }
            const txHash = signedTx === null || signedTx === void 0 ? void 0 : signedTx.transactionHash;
            const rawTransaction = signedTx === null || signedTx === void 0 ? void 0 : signedTx.rawTransaction;
            return { txHash, rawTransaction };
        });
    }
    getGasPrice() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.web3.eth.getGasPrice();
        });
    }
    // get expected price from the network for legacy txs
    getAdjustedGasPrice() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const gasPrice = yield this.getGasPrice();
                const adjustedGas = Math.floor(gasPrice * 1.25);
                return Math.min(adjustedGas, parseInt(this.MAX_FEE));
            }
            catch (err) {
                this.error = true;
                this.log.error(err.message);
                return 0;
            }
        });
    }
    /*
    * This function will trigger the re-calibration of nonce and balance.
    * 1. Sets `waitingForRecalibration` to `true`.
    * 2. Will not trigger re-calibration if:
    *   a. any txs are pending
    *   b. nonce or balance are already getting updated
    *   c. any request is being queued up for execution
    * 3. Checks at regular interval, when all the above conditions are suitable for re-calibration
    * 4. Keeps any new incoming request into `waitArr` until nonce and balance are updated
    */
    recalibrateNonceAndBalance() {
        return __awaiter(this, void 0, void 0, function* () {
            this.waitingForRecalibration = true;
            if (this.pendingTxNonces.size === 0 && this.isUpdating === false && this.queuingInProgress === false) {
                this.isFetched = false;
                this.recalibrate = true;
                this.waitingForRecalibration = false;
                this.pendingTxNonces.clear();
                this.updateNonceAndBalance();
            }
            else if (this.recalibrateNowActivated === false) {
                const recalibrateNow = setInterval(() => {
                    this.recalibrateNowActivated = true;
                    if (this.pendingTxNonces.size === 0 && this.isUpdating === false && this.queuingInProgress === false) {
                        clearInterval(recalibrateNow);
                        this.recalibrateNowActivated = false;
                        this.waitingForRecalibration = false;
                        this.recalibrateNonceAndBalance();
                    }
                }, 300);
            }
        });
    }
    addERC20Contract(config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.contracts.set(config.ID, {
                methods: (new this.web3.eth.Contract(ERC20Interface_json_1.default, config.CONTRACTADDRESS)).methods,
                balance: 0,
                config
            });
        });
    }
    getFaucetUsage() {
        return 100 * (this.requestCount / MEMPOOL_LIMIT);
    }
}
exports.default = EVM;
