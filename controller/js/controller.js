/*
Copyright 2026 GregVido

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
*/

const { ipcRenderer } = require('electron');
const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs-extra');
const DiscordIpcClient = require('./js/ipc-client.js');

const GlobalProperties = require('../GlobalProperties.js');

window.onload = async () => {
    const menuButtons = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.panel');

    const micadiscord = process.env.APPDATA + '\\MicaDiscordData\\settings.json';
    const micadiscordInfo = process.env.APPDATA + '\\MicaDiscordData\\info.json';
    const micadiscordThemes = process.env.APPDATA + '\\MicaDiscordData\\themes.json';
    const micadiscordData = process.env.APPDATA + '\\MicaDiscordData\\';

    let isPackaged = false;

    ipcRenderer.on('packaged', (_evt, enable) => {
        isPackaged = enable;
    });

    function switchSection(index) {
        menuButtons.forEach((button) => button.classList.remove('active'));
        sections.forEach((section) => section.classList.remove('visible'));

        menuButtons[index].classList.add('active');
        sections[index].classList.add('visible');
    }

    menuButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            switchSection(index);
        });
    });

    function getLastDiscordVersion() {
        const files = fs.readdirSync(process.env.LOCALAPPDATA + '\\Discord');
        let output = '0';

        for (const file of files) {
            if (file.startsWith('app-')) {
                if (file > output) output = file;
            }
        }

        return output;
    }

    function getDiscordDesktopPath() {
        const basePath = process.env.LOCALAPPDATA + '\\Discord\\' + getLastDiscordVersion() + '\\modules';
        const files = fs.readdirSync(basePath);

        for (const file of files) {
            if (file.startsWith('discord_desktop_core')) {
                return basePath + '\\' + file + '\\discord_desktop_core\\';
            }
        }

        return basePath;
    }

    const discord = getDiscordDesktopPath();
    const client = new DiscordIpcClient();

    let connected = false;
    let installedVersion = '1.0';
    let discordDetected = false;

    const connectedInfo = document.querySelector('.connected');
    const connectionLabel = document.getElementById('connection-label');
    const logElement = document.querySelector('.log');
    const progressElement = document.querySelector('progress');
    const versionAlert = document.getElementById('version-alert');

    function setConnectionState(color, title, label) {
        connectedInfo.style.background = color;
        connectedInfo.setAttribute('title', title);
        connectionLabel.textContent = label;
    }

    function refreshConnectionUi() {
        if (connected) {
            setConnectionState(
                'rgb(100, 202, 159)',
                'MicaDiscord is connected to Discord',
                'Connected'
            );
            return;
        }

        if (discordDetected) {
            setConnectionState(
                'rgb(252, 208, 10)',
                'MicaDiscord is not installed',
                'Discord detected'
            );
            return;
        }

        setConnectionState(
            'rgb(128, 13, 13)',
            'MicaDiscord cannot connect to Discord',
            'Disconnected'
        );
    }

    client.on('hello', (packet) => {
        connected = true;

        if (packet && packet.version) {
            installedVersion = packet.version;
        }

        refreshConnectionUi();
    });

    client.on('state', (packet) => {
        connected = true;

        if (packet && packet.version) {
            installedVersion = packet.version;
        }

        refreshConnectionUi();
    });

    client.on('disconnected', () => {
        connected = false;
        refreshConnectionUi();
    });

    client.on('error', () => {
        connected = false;
        refreshConnectionUi();
    });

    function discordIsOpen() {
        return new Promise((resolve) => {
            exec('tasklist', (_err, stdout) => {
                resolve(stdout.toLowerCase().includes('discord.exe'));
            });
        });
    }

    async function updateDiscordPresence() {
        discordDetected = await discordIsOpen();
        refreshConnectionUi();
    }

    client.connect();
    await updateDiscordPresence();

    setInterval(async () => {
        if (!connected) {
            await updateDiscordPresence();
        }
    }, 1500);

    const applyButton = document.getElementById('apply');
    const optionsButton = document.getElementById('options');
    const installButton = document.querySelector('.download');
    const uninstallButton = document.getElementById('uninstall');

    applyButton.addEventListener('click', () => {
        if (!connected) {
            ipcRenderer.send('apply', false);
            return;
        }

        client.send({
            type: 'applyAppearance',
            effect: Number(document.querySelector('input[name="effect"]:checked').value),
            theme: Number(document.querySelector('input[name="theme"]:checked').value)
        });
    });

    optionsButton.addEventListener('click', () => {
        ipcRenderer.send('options');
    });

    ipcRenderer.on('corner', (_evt, value) => {
        if (!connected) return;

        client.send({
            type: 'setCorner',
            value: Number(value)
        });
    });

    ipcRenderer.on('borderColor', (_evt, value, enable) => {
        if (!connected) return;

        client.send({
            type: 'setBorderColor',
            value,
            enabled: !!enable
        });
    });

    ipcRenderer.on('backgroundColor', (_evt, color, alpha, type, enable) => {
        if (!connected) return;

        client.send({
            type: 'setCustomEffect',
            color,
            alpha: Number(alpha),
            kind: Number(type),
            enabled: !!enable
        });
    });

    async function log(message) {
        logElement.innerText += `${message}\n`;
        logElement.scrollTop = logElement.scrollHeight;
    }

    async function progress(value) {
        progressElement.value = value;
    }

    function killDiscord() {
        return new Promise((resolve) => {
            exec('taskkill /f /im discord.exe', () => resolve(true));
        });
    }

    function launchDiscord() {
        return new Promise((resolve) => {
            exec(process.env.LOCALAPPDATA + '\\Discord\\Update.exe --processStart Discord.exe', () => {
                resolve(true);
            });
        });
    }

    const installFunc = async () => {
        logElement.innerText = '';
        await log('MicaDiscord - By GregVido and Arbitro\n');

        const discordOpened = await discordIsOpen();

        if (discordOpened) {
            await log('> Closing Discord');
            await progress(0);
            await killDiscord();
        }

        try {
            await log('> Installing Mica-Electron');

            let found = false;
            const previousFolders = ['..'];

            while (!found) {
                if (fs.existsSync(path.join(__dirname, ...previousFolders, 'data'))) {
                    await fs.copy(path.join(__dirname, ...previousFolders, 'data'), discord);
                    found = true;
                } else {
                    previousFolders.push('..');
                }

                if (previousFolders.length > 12) {
                    throw new Error('Unable to locate data folder.');
                }
            }

            await progress(50);

            await log('> Launching Discord');
            await launchDiscord();

            fs.writeFileSync(
                micadiscordInfo,
                JSON.stringify({ lastUpdate: GlobalProperties.VERSION }, null, 4)
            );

            versionAlert.style.display = 'none';

            await log('\n-- Installation completed successfully --');
            await progress(100);

            setTimeout(async () => {
                await updateDiscordPresence();
                if (!connected && typeof client.connect === 'function') {
                    client.connect();
                }
            }, 1200);
        } catch (error) {
            console.log(__dirname);
            console.log(error);
            await log(`\n-- Installation failed: ${error.message || error} --`);
        }
    };

    installButton.addEventListener('click', installFunc);

    uninstallButton.addEventListener('click', async () => {
        let uninstallSuccess = false;

        logElement.innerText = '';
        switchSection(0);

        await log('> Checking app folder');
        await progress(0);

        if (fs.existsSync(discord)) {
            if (fs.existsSync(discord + 'main.js')) {
                fs.unlinkSync(discord + 'main.js');
                uninstallSuccess = true;
                await log('> Deleted main.js');
                await progress(25);
            }

            if (fs.existsSync(discord + 'injector.js')) {
                fs.unlinkSync(discord + 'injector.js');
                await log('> Deleted injector.js');
                await progress(50);
            }

            if (fs.existsSync(discord + 'index.js')) {
                if (fs.existsSync(discord + 'package.json')) {
                    fs.unlinkSync(discord + 'package.json');
                }

                fs.writeFileSync(
                    discord + 'package.json',
                    '{"name":"discord_desktop_core","version":"0.0.0","private":"true","main":"index.js"}'
                );

                await log('> Restored BetterDiscord package.json');
                await progress(75);
            } else {
                if (fs.existsSync(discord + 'package.json')) {
                    fs.unlinkSync(discord + 'package.json');
                    uninstallSuccess = true;
                    await log('> Deleted package.json');
                    await progress(75);
                }
            }

            if (uninstallSuccess) {
                const discordOpened = await discordIsOpen();

                if (discordOpened) {
                    await progress(90);
                    await log('> Restarting Discord');

                    await killDiscord();
                    await launchDiscord();
                }
            }
        } else {
            await log('> Folder not found');
        }

        await progress(100);

        setTimeout(async () => {
            connected = false;
            await updateDiscordPresence();
        }, 1000);
    });

    if (fs.existsSync(micadiscord)) {
        const settingsMD = JSON.parse(fs.readFileSync(micadiscord).toString());
        settingsMD.editor = settingsMD.editor ?? true;

        setTimeout(() => {
            const effectInput = document.querySelector(
                `input[name="effect"][value="${settingsMD.effect}"]`
            );
            if (effectInput) {
                effectInput.checked = true;
            }

            const themeInputs = document.querySelectorAll('input[name="theme"]');
            if (themeInputs[settingsMD.theme]) {
                themeInputs[settingsMD.theme].checked = true;
            }
        }, 100);
    }

    if (fs.existsSync(micadiscordInfo)) {
        const infoMD = JSON.parse(fs.readFileSync(micadiscordInfo).toString());

        if (infoMD.lastUpdate >= GlobalProperties.VERSION) {
            versionAlert.style.display = 'none';
        }
    }

    const themesFolder = micadiscordData + 'themes\\';
    const themeSetting = fs.existsSync(micadiscordThemes)
        ? JSON.parse(fs.readFileSync(micadiscordThemes, 'utf8'))
        : { theme: '' };

    const themeList = document.getElementById('theme-list');
    const inputArray = {};

    function createFileInArray(file) {
        const theme = document.createElement('div');
        theme.className = 'theme-item';

        const left = document.createElement('div');
        left.className = 'theme-left';

        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.id = file;
        radioInput.name = 'theme-file';
        radioInput.value = file;

        left.appendChild(radioInput);

        const labelInput = document.createElement('label');
        labelInput.setAttribute('for', file);
        labelInput.innerText = file;

        left.appendChild(labelInput);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'theme-delete';
        deleteButton.type = 'button';
        deleteButton.textContent = 'Remove';

        deleteButton.addEventListener('click', () => {
            fs.unlinkSync(themesFolder + file);

            if (inputArray[file]) {
                inputArray[file].remove();
                delete inputArray[file];
            }
        });

        theme.appendChild(left);
        theme.appendChild(deleteButton);

        themeList.appendChild(theme);
        inputArray[file] = theme;

        if (themeSetting.theme === file.split('.')[0]) {
            radioInput.checked = true;
        }
    }

    fs.readdir(themesFolder, (_err, files = []) => {
        files.forEach((file) => {
            createFileInArray(file);
        });
    });

    setInterval(async () => {
        const getList = async () => {
            return new Promise((resolve) => {
                const list = [];

                fs.readdir(themesFolder, (_err, files = []) => {
                    files.forEach((file) => {
                        if (!(file in inputArray) || !inputArray[file]) {
                            createFileInArray(file);
                        }

                        list.push(file);
                    });

                    resolve(list);
                });
            });
        };

        const list = await getList();

        Object.keys(inputArray).forEach((file) => {
            if (!list.includes(file)) {
                const element = inputArray[file];

                if (element) {
                    const checked = element.querySelector('input').checked;

                    themeList.removeChild(element);
                    delete inputArray[file];

                    const keyList = Object.keys(inputArray);

                    if (keyList.length && checked) {
                        inputArray[keyList[0]].querySelector('input').checked = true;
                    }
                }
            }
        });
    }, 1000);

    document.getElementById('applyTheme').addEventListener('click', () => {
        const input = document.querySelector('#theme-list input[type="radio"]:checked');

        if (!input) return;

        if (!connected) {
            ipcRenderer.send('apply', false);
            return;
        }

        const cssContent = fs.readFileSync(micadiscordData + 'themes\\' + input.value).toString();

        client.send({
            type: 'applyThemeCss',
            css: cssContent
        });

        themeSetting.theme = input.value.split('.')[0];
        fs.writeFileSync(micadiscordThemes, JSON.stringify(themeSetting, null, 4));
    });

    document.getElementById('add-theme').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        input.setAttribute('accept', '.css,text/css');
        input.click();

        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const name = path.parse(file.name).name;
            const dest = path.join(micadiscordData, 'themes', `${name}.css`);

            try {
                await fs.ensureDir(path.join(micadiscordData, 'themes'));

                const content = await file.text();
                fs.writeFileSync(dest, content, 'utf8');
            } catch (err) {
                console.error('Failed to import theme:', err);
            }
        };
    });

    document.getElementById('version').innerText = `Version ${GlobalProperties.VERSION}`;
};