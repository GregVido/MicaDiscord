const net = require('net');

let PIPE_PATH, createMessageParser, sendMessage;

try {
    ({ PIPE_PATH, createMessageParser, sendMessage } = require('../../data/shared/ipc'));
} catch (err) {
    ({ PIPE_PATH, createMessageParser, sendMessage } = require('../../../data/shared/ipc'));
}

class DiscordIpcClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.connecting = false;
        this.retryDelay = 500;
        this.maxRetryDelay = 4000;
        this.listeners = new Map();
        this.retryTimer = null;
    }

    on(type, handler) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(handler);
    }

    emit(type, payload) {
        const handlers = this.listeners.get(type);
        if (!handlers) return;
        for (const handler of handlers) {
            try {
                handler(payload);
            } catch (err) {
                console.error(err);
            }
        }
    }

    connect() {
        if (this.connected || this.connecting) return;

        this.connecting = true;
        const socket = net.createConnection(PIPE_PATH);

        const parse = createMessageParser((msg) => {
            if (msg.type === 'hello') {
                this.connected = true;
                this.connecting = false;
                this.retryDelay = 500;
            }

            this.emit('message', msg);
            this.emit(msg.type, msg);
        });

        socket.on('connect', () => {
            this.socket = socket;
        });

        socket.on('data', parse);

        socket.on('error', () => {
            this.handleDisconnect();
        });

        socket.on('close', () => {
            this.handleDisconnect();
        });
    }

    handleDisconnect() {
        this.connected = false;
        this.connecting = false;

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.destroy();
            this.socket = null;
        }

        this.emit('disconnected');

        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.connect(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 1.5, this.maxRetryDelay);
    }

    send(payload) {
        return sendMessage(this.socket, payload);
    }
}

module.exports = DiscordIpcClient;