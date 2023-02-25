/*
Copyright 2022 GregVido

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
const { PARAMS, VALUE, MicaBrowserWindow } = require('mica-electron');
const open = require('open');
const path = require('path');

app.commandLine.appendSwitch("enable-transparent-visuals");

const fs = require('fs');

app.on('ready', () => {
    const loader = new BrowserWindow({
        width: 300,
        height: 150,
        autoHideMenuBar: true,
        show: false,
        frame: false,
        maximizable: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'app.ico')
    });

    loader.loadFile(path.join(__dirname, 'loader', 'index.html'));

    loader.webContents.once('dom-ready', () => {
        loader.show();
    });

    ipcMain.once('update', async (event) => {
        const options = {
            type: 'question',
            buttons: ['Cancel', 'Yes, please', 'No, thanks'],
            defaultId: 2,
            title: 'Update',
            message: 'An update is available. Download ?'
        };

        const result = await dialog.showMessageBox(loader, options);
        
        if(result.response == 1) {
            open("https://github.com/GregVido/MicaDiscord");
            setTimeout(app.quit, 1000);
        }
        else
            event.sender.send('res');
        
    });

    ipcMain.once('error', (event) => {
        loader.hide();

        const error = new BrowserWindow({
            width: 600,
            height: 300,
            autoHideMenuBar: true,
            show: true,
            maximizable: false,
            resizable: false,
            icon: path.join(__dirname, 'app.ico')
        });

        error.loadFile(path.join(__dirname, 'error', 'index.html'));

        error.on("close", () => {
            app.quit();
        });
    });

    ipcMain.once('kill', (event) => {
        app.quit();
    });

    ipcMain.once('getController', (event) => {
        loader.hide();

        const controller = new MicaBrowserWindow({
            width: 600,
            height: 300,
            autoHideMenuBar: true,
            show: false,
            maximizable: false,
            resizable: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
            icon: path.join(__dirname, 'app.ico')
        });

        controller.setMicaEffect();
        controller.setLightTheme();

        controller.loadFile(path.join(__dirname, 'controller', 'index.html'));

        controller.webContents.once('dom-ready', () => {
            controller.show();
            controller.webContents.send('packaged', app.isPackaged);
        });

        ipcMain.on('apply', (evt, enable) => {
            if (!enable) {
                dialog.showMessageBoxSync(controller, {
                    message: "MicaDiscord ne peut pas appliquer les effets :/",
                    detail: 'Vous pouvez appliquer les effets seulement lorsque MicaDiscord est connecté à Discord.',
                    type: 'error',
                    title: 'Erreur'
                });
            }
        });

        ipcMain.on('noVersion', (evt,) => {
            dialog.showMessageBoxSync(controller, {
                message: "MicaDiscord est pas à jour ?",
                detail: 'Discord ne possède pas la dernière version de MicaDiscord installé.',
                type: 'error',
                title: 'Erreur'
            });
        });

        ipcMain.on('options', (evt) => {
            const options = new MicaBrowserWindow({
                width: 600,
                height: 390,
                autoHideMenuBar: true,
                show: false,
                maximizable: false,
                resizable: false,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false,
                },
                icon: path.join(__dirname, 'app.ico')
            });

            options.setLightTheme();
            options.setMicaEffect();

            options.loadFile(path.join(__dirname, 'options', 'index.html'));

            options.webContents.once('dom-ready', () => {
                options.show();
            });
        });

        ipcMain.on('corner', (evt, value) => {
            controller.webContents.send('corner', value);
        });

        ipcMain.on('borderColor', (evt, value, enable) => {
            controller.webContents.send('borderColor', value, enable);
        });

        ipcMain.on('backgroundColor', (evt, color, alpha, type, enable) => {
            controller.webContents.send('backgroundColor', color, alpha, type, enable);
        });


        controller.on("close", () => {
            app.quit();
        });
    });
});