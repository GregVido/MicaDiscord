const net = require('net');
const os = require('os');

const PIPE_NAME = 'MicaDiscord';
const PIPE_PATH =
    process.platform === 'win32'
        ? `\\\\.\\pipe\\${PIPE_NAME}`
        : `${os.tmpdir()}/${PIPE_NAME}.sock`;

function createMessageParser(onMessage) {
    let buffer = '';

    return (chunk) => {
        buffer += chunk.toString('utf8');

        while (true) {
            const newlineIndex = buffer.indexOf('\n');
            if (newlineIndex === -1) break;

            const raw = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (!raw) continue;

            try {
                onMessage(JSON.parse(raw));
            } catch (err) {
                console.error('Invalid IPC message:', raw, err);
            }
        }
    };
}

function sendMessage(stream, payload) {
    if (!stream || stream.destroyed) return false;
    stream.write(`${JSON.stringify(payload)}\n`);
    return true;
}

module.exports = {
    PIPE_PATH,
    createMessageParser,
    sendMessage,
};