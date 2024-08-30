/*
Copyright 2023 GregVido

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


const electron = require('electron');
const Module = require("module");
const path = require('path');
const net = require('net');
const fs = require('fs');

const { PARAMS, VALUE, MicaBrowserWindow } = require('mica-electron');

const micadiscord = process.env.APPDATA + '\\MicaDiscordData\\settings.json';
const micadiscordThemes = process.env.APPDATA + '\\MicaDiscordData\\themes.json';
const micadiscordData = process.env.APPDATA + '\\MicaDiscordData\\';

const CONFIG = {};
CONFIG.effect = PARAMS.BACKGROUND.MICA;
CONFIG.theme = VALUE.THEME.DARK;
CONFIG.corner = VALUE.CORNER.ROUND;

if (!fs.existsSync(micadiscord))
    fs.writeFileSync(micadiscord, JSON.stringify(CONFIG));
else {
    CONFIG.effect = require(micadiscord).effect;
    CONFIG.theme = require(micadiscord).theme;
    CONFIG.corner = require(micadiscord).corner;
    CONFIG.borderColor = require(micadiscord).borderColor;
    CONFIG.customEffect = require(micadiscord).customEffect;
}

CONFIG.corner = CONFIG.corner ?? VALUE.CORNER.ROUND;

const VERSION = "1.0.6";


class BrowserWindow extends MicaBrowserWindow {
    constructor(options) {
        options.frame = false;

        if (options.webPreferences)
            options.webPreferences.nodeIntegration = true;
        else
            options.webPreferences = { nodeIntegration: true };

        super(options);

        this.changeTheme(CONFIG.theme);
        this.changeEffect(CONFIG.effect);

        this.applyEffect(PARAMS.CORNER, CONFIG.corner);

        this.alwaysFocused(true);

        if (CONFIG.borderColor)
            this.applyEffect(PARAMS.BORDER_COLOR, CONFIG.borderColor);

        if (CONFIG.customEffect) {
            if (CONFIG.customEffect.color && CONFIG.customEffect.alpha != undefined && CONFIG.customEffect.type)
                this.setCustomEffect(CONFIG.customEffect.type, CONFIG.customEffect.color, CONFIG.customEffect.alpha);
        }

        this.webContents.on('dom-ready', () => {

            let settings = require(micadiscordThemes);

            let theme = fs.readFileSync(path.join(__dirname, 'injector.js')).toString();
            theme = theme.replace('THEME_CONTENT', '`' + fs.readFileSync(micadiscordData + '\\themes\\' + settings.theme + '.css').toString() + '`');
            this.webContents.executeJavaScript(theme);
        });

        // this.webContents.openDevTools();

        let port = 65321;

        let server;

        let createServer = () => {

            if (server) {
                server.removeAllListeners()
                server.close();
            }

            server = net.createServer((socket) => {
                socket.write("OK " + VERSION + "\x00");

                socket.on('data', (data) => {
                    let packet = data.toString().split(' ');

                    if (packet[0] == '1') {
                        let effect = parseInt(packet[1]);
                        let theme = parseInt(packet[2]);

                        this.changeTheme(theme);
                        this.changeEffect(effect);

                        this.applyEffect(effect, theme);

                        CONFIG.effect = effect;
                        CONFIG.theme = theme;

                        fs.writeFileSync(micadiscord, JSON.stringify(CONFIG));
                    }

                    else if (packet[0] == '2') {
                        const content = data.toString().slice(2);

                        this.webContents.executeJavaScript(`setTheme(\`${content}\`);`);

                    }

                    else if (packet[0] == '3') {
                        const value = parseInt(packet[1]);

                        CONFIG.corner = value;

                        this.applyEffect(PARAMS.CORNER, CONFIG.corner);
                        fs.writeFileSync(micadiscord, JSON.stringify(CONFIG));
                    }

                    else if (packet[0] == '4') {
                        const value = packet[1];
                        const enable = parseInt(packet[2]);

                        if (enable)
                            CONFIG.borderColor = value;

                        else
                            CONFIG.borderColor = undefined;

                        this.applyEffect(PARAMS.BORDER_COLOR, value);
                        fs.writeFileSync(micadiscord, JSON.stringify(CONFIG));
                    }

                    else if (packet[0] == '5') {
                        const color = packet[1];
                        const alpha = parseFloat(packet[2]);
                        const type = parseInt(packet[3]);
                        const enable = parseInt(packet[4]);

                        if (enable)
                            CONFIG.customEffect = {
                                color: color,
                                alpha: alpha,
                                type: type
                            };

                        else
                            CONFIG.customEffect = undefined;

                        this.setCustomEffect(type, color, alpha);
                        fs.writeFileSync(micadiscord, JSON.stringify(CONFIG));

                        if (!enable) {
                            this.changeTheme(CONFIG.theme);
                            this.changeEffect(CONFIG.effect);
                        }
                    }

                    else if (packet[0] == '6') {
                        server.close();
                    }
                });

                socket.on('error', (e) => {
                    console.log(e);
                });

                socket.on('close', () => {
                    console.log('close');
                });

                socket.on('end', () => {
                    console.log('end');
                });
            });

            server.on('error', (e) => {
                askCloseServer();
            });

            server.on('close', (e) => {
                askCloseServer();
            });

            server.listen(port, '127.0.0.1');
        }

        let askCloseServer = () => {
            const client = new net.Socket();

            client.connect(port, '127.0.0.1', () => {
                client.write('6');
            });

            client.on('error', async (e) => {
                await electron.dialog.showMessageBox(this, {
                    message: "Une erreur est survenue (MicaDiscord)",
                    detail: '' + e,
                    type: 'error',
                    title: 'Erreur'
                });
                client.destroy();
                // createServer();
            });

            client.on('close', async () => {
                // createServer();
            });
        }

        createServer();
    }

    changeTheme(newValue) {
        switch (newValue) {
            case VALUE.THEME.AUTO:
                this.setAutoTheme();
                break

            case VALUE.THEME.LIGHT:
                this.setLightTheme();
                break

            case VALUE.THEME.DARK:
                this.setDarkTheme();
                break
        }
    }

    changeEffect(newParams) {
        switch (newParams) {
            case PARAMS.BACKGROUND.MICA:
                this.setMicaEffect();
                break

            case PARAMS.BACKGROUND.TABBED_MICA:
                this.setMicaTabbedEffect();
                break

            case PARAMS.BACKGROUND.ACRYLIC:
                this.setMicaAcrylicEffect();
                break

        }
    }

    applyEffect(params, value) {
        switch (params) {
            case PARAMS.CORNER:
                switch (value) {
                    case VALUE.CORNER.ROUND:
                        this.setRoundedCorner();
                        break

                    case VALUE.CORNER.ROUNDSMALL:
                        this.setSmallRoundedCorner();
                        break

                    case VALUE.CORNER.DONOTROUND:
                        this.setSquareCorner();
                        break
                }
                break

            case PARAMS.BORDER_COLOR:
                this.setBorderColor(value);
                break

            case PARAMS.CAPTION_COLOR:
                this.setCaptionColor(value);
                break

            case PARAMS.TEXT_COLOR:
                this.setTitleTextColor(value);
                break

            case 10:
                switch (value) {
                    case 0:
                        this.setTransparent();
                        break

                    case 1:
                        this.setBlur();
                        break

                    case 2:
                        this.setAcrylic();
                        break
                }
                break

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