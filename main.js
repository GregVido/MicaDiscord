/*
Copyright 2026 GregVido

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

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { MicaBrowserWindow } = require('mica-electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

log.initialize();

app.commandLine.appendSwitch('enable-transparent-visuals');

const ICON_PATH = path.join(__dirname, 'app.ico');

let loaderWindow = null;
let controllerWindow = null;


async function getDiscordProcesses() {
    try {
        const { stdout } = await execAsync(
            'powershell -NoProfile -Command "Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -in @(\'Discord\', \'Update\') } | Select-Object Id,ProcessName | ConvertTo-Json -Compress"'
        );

        if (!stdout.trim()) {
            return [];
        }

        const data = JSON.parse(stdout);
        const list = Array.isArray(data) ? data : [data];

        return list.map((proc) => ({
            pid: proc.Id,
            name: `${proc.ProcessName}.exe`
        }));
    } catch (error) {
        log.error('getDiscordProcesses failed:', error);
        return [];
    }
}

async function discordIsOpenMain() {
    const processes = await getDiscordProcesses();
    return processes.some((proc) => (proc.name || '').toLowerCase() === 'discord.exe');
}

async function killDiscordMain() {
    try {
        await execAsync('taskkill /f /t /im discord.exe').catch(() => {});
        await execAsync('taskkill /f /t /im update.exe').catch(() => {});

        await new Promise((resolve) => setTimeout(resolve, 1200));

        const remaining = await getDiscordProcesses();

        return {
            ok: remaining.length === 0,
            remaining: remaining.map((proc) => ({
                pid: proc.pid,
                name: proc.name
            }))
        };
    } catch (error) {
        return {
            ok: false,
            error: error?.message || String(error)
        };
    }
}

async function waitForDiscordToCloseMain(timeout = 15000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const open = await discordIsOpenMain();

        if (!open) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            return true;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return false;
}

function createLoaderWindow() {
    const loader = new MicaBrowserWindow({
        width: 520,
        height: 320,
        minWidth: 520,
        minHeight: 320,
        maxWidth: 520,
        maxHeight: 320,
        useContentSize: true,
        center: true,
        autoHideMenuBar: true,
        show: false,
        frame: false,
        transparent: true,
        resizable: false,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: ICON_PATH
    });

    loader.setRoundedCorner();
    loader.setDarkTheme();
    loader.setMicaTabbedEffect();

    loader.loadFile(path.join(__dirname, 'loader', 'index.html'));

    loader.webContents.once('dom-ready', () => {
        loader.show();
    });

    return loader;
}

function createErrorWindow() {
    const error = new BrowserWindow({
        width: 620,
        height: 340,
        minWidth: 620,
        minHeight: 340,
        maxWidth: 620,
        maxHeight: 340,
        useContentSize: true,
        center: true,
        autoHideMenuBar: true,
        show: true,
        resizable: false,
        maximizable: false,
        minimizable: true,
        fullscreenable: false,
        icon: ICON_PATH,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    error.loadFile(path.join(__dirname, 'error', 'index.html'));

    error.on('close', () => {
        app.quit();
    });

    return error;
}

function createControllerWindow() {
    const controller = new MicaBrowserWindow({
        width: 960,
        height: 600,
        minWidth: 960,
        minHeight: 600,
        useContentSize: true,
        center: true,
        autoHideMenuBar: true,
        show: false,
        resizable: true,
        maximizable: false,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: ICON_PATH
    });

    controller.setRoundedCorner();
    controller.setDarkTheme();
    controller.setMicaTabbedEffect();

    controller.loadFile(path.join(__dirname, 'controller', 'index.html'));

    controller.webContents.once('dom-ready', () => {
        controller.show();
        controller.webContents.send('packaged', app.isPackaged);
    });

    controller.on('close', () => {
        app.quit();
    });

    return controller;
}

function createOptionsWindow() {
    const options = new MicaBrowserWindow({
        width: 760,
        height: 620,
        minWidth: 720,
        minHeight: 560,
        useContentSize: true,
        center: true,
        autoHideMenuBar: true,
        show: false,
        resizable: false,
        maximizable: false,
        minimizable: true,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: ICON_PATH
    });

    options.setRoundedCorner();
    options.setDarkTheme();
    options.setMicaTabbedEffect();

    options.loadFile(path.join(__dirname, 'options', 'index.html'));

    options.webContents.once('dom-ready', () => {
        options.show();
    });

    return options;
}

function sendToLoader(channel, payload) {
    if (loaderWindow && !loaderWindow.isDestroyed()) {
        loaderWindow.webContents.send(channel, payload);
    }
}

function setupAutoUpdater() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('checking-for-update', () => {
        sendToLoader('update-status', 'Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        sendToLoader('update-available', {
            version: info.version
        });
    });

    autoUpdater.on('update-not-available', () => {
        sendToLoader('update-not-available');
    });

    autoUpdater.on('download-progress', (progress) => {
        sendToLoader('update-progress', {
            percent: progress.percent || 0
        });
    });

    autoUpdater.on('update-downloaded', () => {
        sendToLoader('update-downloaded');
    });

    autoUpdater.on('error', (error) => {
        log.error('Auto updater error:', error);
        sendToLoader('update-error', {
            message: error?.message || String(error)
        });
    });
}

app.whenReady().then(() => {
    setupAutoUpdater();

    loaderWindow = createLoaderWindow();

    ipcMain.handle('discord:is-open', async () => {
        try {
            return { ok: true, open: await discordIsOpenMain() };
        } catch (error) {
            return { ok: false, error: error?.message || String(error), open: false };
        }
    });

    ipcMain.handle('discord:kill', async () => {
        return await killDiscordMain();
    });

    ipcMain.handle('discord:wait-close', async (_evt, timeout = 15000) => {
        try {
            return { ok: true, closed: await waitForDiscordToCloseMain(timeout) };
        } catch (error) {
            return { ok: false, error: error?.message || String(error), closed: false };
        }
    });

    ipcMain.handle('check-for-updates', async () => {
        try {
            const result = await autoUpdater.checkForUpdates();

            if (!result || !result.updateInfo) {
                return { available: false };
            }

            return {
                available: result.updateInfo.version !== app.getVersion(),
                version: result.updateInfo.version
            };
        } catch (error) {
            log.error('Failed to check for updates:', error);
            return {
                available: false,
                error: error?.message || String(error)
            };
        }
    });

    ipcMain.handle('download-update', async () => {
        try {
            await autoUpdater.downloadUpdate();
            return { ok: true };
        } catch (error) {
            log.error('Failed to download update:', error);
            return {
                ok: false,
                error: error?.message || String(error)
            };
        }
    });

    ipcMain.handle('quit-and-install-update', async () => {
        setImmediate(() => {
            autoUpdater.quitAndInstall(false, true);
        });

        return { ok: true };
    });

    ipcMain.once('error', () => {
        if (loaderWindow && !loaderWindow.isDestroyed()) {
            loaderWindow.hide();
        }

        createErrorWindow();
    });

    ipcMain.once('kill', () => {
        app.quit();
    });

    ipcMain.once('getController', () => {
        if (loaderWindow && !loaderWindow.isDestroyed()) {
            loaderWindow.hide();
        }

        controllerWindow = createControllerWindow();

        ipcMain.on('apply', (_evt, enable) => {
            if (!enable) {
                dialog.showMessageBoxSync(controllerWindow, {
                    message: 'MicaDiscord ne peut pas appliquer les effets :/',
                    detail: 'Vous pouvez appliquer les effets seulement lorsque MicaDiscord est connecté à Discord.',
                    type: 'error',
                    title: 'Erreur'
                });
            }
        });

        ipcMain.on('noVersion', () => {
            dialog.showMessageBoxSync(controllerWindow, {
                message: 'MicaDiscord est pas à jour ?',
                detail: 'Discord ne possède pas la dernière version de MicaDiscord installé.',
                type: 'error',
                title: 'Erreur'
            });
        });

        ipcMain.on('options', () => {
            createOptionsWindow();
        });

        ipcMain.on('corner', (_evt, value) => {
            controllerWindow.webContents.send('corner', value);
        });

        ipcMain.on('borderColor', (_evt, value, enable) => {
            controllerWindow.webContents.send('borderColor', value, enable);
        });

        ipcMain.on('backgroundColor', (_evt, color, alpha, type, enable) => {
            controllerWindow.webContents.send('backgroundColor', color, alpha, type, enable);
        });
    });
});

app.on('window-all-closed', () => {
    app.quit();
});