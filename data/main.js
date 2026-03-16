const electron = require('electron');
const Module = require("module");
const path = require('path');
const fs = require('fs');
const net = require('net');

const { PARAMS, VALUE, MicaBrowserWindow } = require('mica-electron');
const { PIPE_PATH, createMessageParser, sendMessage } = require('./shared/ipc.js');

const micadiscord = path.join(process.env.APPDATA, 'MicaDiscordData', 'settings.json');
const micadiscordThemes = path.join(process.env.APPDATA, 'MicaDiscordData', 'themes.json');
const micadiscordData = path.join(process.env.APPDATA, 'MicaDiscordData');

const VERSION = '1.0.6';

function readJson(file, fallback = {}) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return fallback;
    }
}

function writeJson(file, value) {
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

const defaultConfig = {
    effect: PARAMS.BACKGROUND.MICA,
    theme: VALUE.THEME.DARK,
    corner: VALUE.CORNER.ROUND,
    borderColor: undefined,
    customEffect: undefined,
};

const CONFIG = { ...defaultConfig, ...readJson(micadiscord, {}) };

class BrowserWindow extends MicaBrowserWindow {
    constructor(options) {
        options.frame = false;
        options.webPreferences = {
            ...(options.webPreferences || {}),
            nodeIntegration: true,
        };

        super(options);

        this.ipcClients = new Set();
        this.ipcServer = null;
        this.themeCssLoaded = false;

        this.applyCurrentConfig();
        this.setupThemeInjection();
        this.startIpcServer();
    }

    applyCurrentConfig() {
        this.changeTheme(CONFIG.theme);
        this.changeEffect(CONFIG.effect);
        this.applyEffect(PARAMS.CORNER, CONFIG.corner);
        this.alwaysFocused(true);

        if (CONFIG.borderColor) {
            this.applyEffect(PARAMS.BORDER_COLOR, CONFIG.borderColor);
        }

        if (CONFIG.customEffect?.color && CONFIG.customEffect?.alpha != null && CONFIG.customEffect?.type != null) {
            this.setCustomEffect(CONFIG.customEffect.type, CONFIG.customEffect.color, CONFIG.customEffect.alpha);
        }
    }

    setupThemeInjection() {
        this.webContents.on('dom-ready', () => {
            this.injectStoredTheme();
        });
    }

    injectStoredTheme() {
        try {
            const settings = readJson(micadiscordThemes, { theme: 'ClearVision_v6' });
            const cssPath = path.join(micadiscordData, 'themes', `${settings.theme}.css`);
            const injectorPath = path.join(__dirname, 'injector.js');

            if (!fs.existsSync(cssPath) || !fs.existsSync(injectorPath)) return;

            const css = fs.readFileSync(cssPath, 'utf8');
            let injectorCode = fs.readFileSync(injectorPath, 'utf8');
            injectorCode = injectorCode.replace('THEME_CONTENT', '`' + css.replace(/`/g, '\\`') + '`');

            this.webContents.executeJavaScript(`
            try {
                if (typeof window.clearTheme === 'function') {
                    window.clearTheme();
                }
            } catch (e) {}
        `).catch(() => { });

            this.webContents.executeJavaScript(injectorCode).catch(console.error);
            this.themeCssLoaded = true;
        } catch (err) {
            console.error('Theme injection failed:', err);
        }
    }

    startIpcServer() {
        try {
            if (process.platform === 'win32' || !fs.existsSync(PIPE_PATH)) {
                // no-op
            } else {
                fs.unlinkSync(PIPE_PATH);
            }
        } catch { }

        this.ipcServer = net.createServer((socket) => {
            this.ipcClients.add(socket);

            sendMessage(socket, {
                type: 'hello',
                version: VERSION,
                connected: true,
            });

            const parse = createMessageParser((msg) => this.handleIpcMessage(socket, msg));
            socket.on('data', parse);

            socket.on('close', () => {
                this.ipcClients.delete(socket);
            });

            socket.on('error', (err) => {
                console.error('IPC client error:', err);
                this.ipcClients.delete(socket);
            });
        });

        this.ipcServer.on('error', (err) => {
            console.error('IPC server error:', err);
        });

        this.ipcServer.listen(PIPE_PATH, () => {
            console.log('IPC server listening on', PIPE_PATH);
        });
    }

    handleIpcMessage(socket, msg) {
        try {
            switch (msg.type) {
                case 'ping':
                    sendMessage(socket, { type: 'pong', version: VERSION });
                    break;

                case 'applyAppearance':
                    this.changeTheme(msg.theme);
                    this.changeEffect(msg.effect);
                    CONFIG.theme = msg.theme;
                    CONFIG.effect = msg.effect;
                    writeJson(micadiscord, CONFIG);
                    sendMessage(socket, { type: 'ack', action: msg.type });
                    break;

                case 'applyThemeCss':
                    if (typeof msg.css === 'string') {
                        this.webContents.executeJavaScript(`
                            if (typeof window.setTheme === 'function') {
                                window.setTheme(${JSON.stringify(msg.css)});
                            }
                        `).catch(console.error);

                        sendMessage(socket, { type: 'ack', action: msg.type });
                    }
                    break;

                case 'setCorner':
                    CONFIG.corner = msg.value;
                    this.applyEffect(PARAMS.CORNER, CONFIG.corner);
                    writeJson(micadiscord, CONFIG);
                    sendMessage(socket, { type: 'ack', action: msg.type });
                    break;

                case 'setBorderColor':
                    CONFIG.borderColor = msg.enabled ? msg.value : undefined;
                    if (msg.enabled) {
                        this.applyEffect(PARAMS.BORDER_COLOR, msg.value);
                    }
                    writeJson(micadiscord, CONFIG);
                    sendMessage(socket, { type: 'ack', action: msg.type });
                    break;

                case 'setCustomEffect':
                    if (msg.enabled) {
                        CONFIG.customEffect = {
                            color: msg.color,
                            alpha: msg.alpha,
                            type: msg.kind,
                        };
                        this.setCustomEffect(msg.kind, msg.color, msg.alpha);
                    } else {
                        CONFIG.customEffect = undefined;
                        this.changeTheme(CONFIG.theme);
                        this.changeEffect(CONFIG.effect);
                    }

                    writeJson(micadiscord, CONFIG);
                    sendMessage(socket, { type: 'ack', action: msg.type });
                    break;

                case 'getState':
                    sendMessage(socket, {
                        type: 'state',
                        connected: true,
                        version: VERSION,
                        config: CONFIG,
                    });
                    break;
            }
        } catch (err) {
            console.error('IPC message error:', err);
            sendMessage(socket, {
                type: 'error',
                message: String(err?.message || err),
            });
        }
    }

    changeTheme(newValue) {
        switch (newValue) {
            case VALUE.THEME.AUTO:
                this.setAutoTheme();
                break;
            case VALUE.THEME.LIGHT:
                this.setLightTheme();
                break;
            case VALUE.THEME.DARK:
                this.setDarkTheme();
                break;
        }
    }

    changeEffect(newParams) {
        switch (newParams) {
            case PARAMS.BACKGROUND.MICA:
                this.setMicaEffect();
                break;
            case PARAMS.BACKGROUND.TABBED_MICA:
                this.setMicaTabbedEffect();
                break;
            case PARAMS.BACKGROUND.ACRYLIC:
                this.setMicaAcrylicEffect();
                break;
        }
    }

    applyEffect(params, value) {
        switch (params) {
            case PARAMS.CORNER:
                switch (value) {
                    case VALUE.CORNER.ROUND:
                        this.setRoundedCorner();
                        break;
                    case VALUE.CORNER.ROUNDSMALL:
                        this.setSmallRoundedCorner();
                        break;
                    case VALUE.CORNER.DONOTROUND:
                        this.setSquareCorner();
                        break;
                }
                break;

            case PARAMS.BORDER_COLOR:
                this.setBorderColor(value);
                break;

            case PARAMS.CAPTION_COLOR:
                this.setCaptionColor(value);
                break;

            case PARAMS.TEXT_COLOR:
                this.setTitleTextColor(value);
                break;

            case 10:
                switch (value) {
                    case 0:
                        this.setTransparent();
                        break;
                    case 1:
                        this.setBlur();
                        break;
                    case 2:
                        this.setAcrylic();
                        break;
                }
                break;
        }
    }
}

const electronPath = require.resolve("electron");
delete require.cache[electronPath].exports;
require.cache[electronPath].exports = { ...electron, BrowserWindow };

const removeCSP = () => {
    electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (!details.responseHeaders["content-security-policy-report-only"] && !details.responseHeaders["content-security-policy"])
            return callback({ cancel: false });

        delete details.responseHeaders["content-security-policy-report-only"];
        delete details.responseHeaders["content-security-policy"];
        callback({ cancel: false, responseHeaders: details.responseHeaders });
    });
};

removeCSP();

const file = path.join(__dirname, 'index.js');
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file).toString();

    if (content.split('\n').length != 1) {
        const data = content.split('"')[1];
        require(data);
    }
}

module.exports = require("./core.asar");