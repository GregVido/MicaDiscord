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
const open = require('open');
const path = require('path');

app.commandLine.appendSwitch('enable-transparent-visuals');

const ICON_PATH = path.join(__dirname, 'app.ico');

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

app.whenReady().then(() => {
    const loader = createLoaderWindow();

    ipcMain.once('update', async (event) => {
        const options = {
            type: 'question',
            buttons: ['Cancel', 'Yes, please', 'No, thanks'],
            defaultId: 2,
            title: 'Update',
            message: 'An update is available. Download ?'
        };

        const result = await dialog.showMessageBox(loader, options);

        if (result.response === 1) {
            open('https://github.com/GregVido/MicaDiscord');
            setTimeout(() => app.quit(), 1000);
        } else {
            event.sender.send('res');
        }
    });

    ipcMain.once('error', () => {
        if (!loader.isDestroyed()) {
            loader.hide();
        }

        createErrorWindow();
    });

    ipcMain.once('kill', () => {
        app.quit();
    });

    ipcMain.once('getController', () => {
        if (!loader.isDestroyed()) {
            loader.hide();
        }

        const controller = createControllerWindow();

        ipcMain.on('apply', (_evt, enable) => {
            if (!enable) {
                dialog.showMessageBoxSync(controller, {
                    message: 'MicaDiscord ne peut pas appliquer les effets :/',
                    detail: 'Vous pouvez appliquer les effets seulement lorsque MicaDiscord est connecté à Discord.',
                    type: 'error',
                    title: 'Erreur'
                });
            }
        });

        ipcMain.on('noVersion', () => {
            dialog.showMessageBoxSync(controller, {
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
            controller.webContents.send('corner', value);
        });

        ipcMain.on('borderColor', (_evt, value, enable) => {
            controller.webContents.send('borderColor', value, enable);
        });

        ipcMain.on('backgroundColor', (_evt, color, alpha, type, enable) => {
            controller.webContents.send('backgroundColor', color, alpha, type, enable);
        });
    });
});

app.on('window-all-closed', () => {
    app.quit();
});