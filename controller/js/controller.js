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

const { ipcRenderer, app } = require('electron');
const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs-extra');

const GlobalProperties = require('../GlobalProperties.js');

window.onload = async () => {
    const menuBts = document.querySelectorAll('span');
    const sections = document.querySelectorAll('section');

    const micadiscord = process.env.APPDATA + '\\MicaDiscordData\\settings.json';
    const micadiscordInfo = process.env.APPDATA + '\\MicaDiscordData\\info.json';
    const micadiscordThemes = process.env.APPDATA + '\\MicaDiscordData\\themes.json';
    const micadiscordData = process.env.APPDATA + '\\MicaDiscordData\\';

    let isPackaged = false;

    ipcRenderer.on('packaged', (evt, enable) => {
        isPackaged = enable;
    });

    let getLastDiscordVersion = () => {
        const files = fs.readdirSync(process.env.LOCALAPPDATA + '\\Discord');
        let output = '0';

        for (let file of files) {
            if (file.startsWith('app-')) {
                if (file > output)
                    output = file;
            }
        }
        return output;
    }


    let getDiscordDesktopPath = () => {
        const PATH = process.env.LOCALAPPDATA + '\\Discord\\' + getLastDiscordVersion() + '\\modules';
        const files = fs.readdirSync(PATH);

        for (let file of files) {
            if (file.startsWith('discord_desktop_core'))
                return PATH + '\\' + file + '\\discord_desktop_core\\';
        }

        return PATH;
    }

    getLastDiscordVersion();

    const discord = getDiscordDesktopPath();

    const net = require('net');

    Object.values(menuBts).map((btn, i) => {
        btn.addEventListener('click', () => {
            Object.values(sections).map((section) => {
                section.style.animation = '200ms fadeout';
                if (section.classList.contains('visible')) {
                    setTimeout(() => {
                        section.classList.remove('visible');
                    }, 200 - 5);
                }
            })
            Object.values(menuBts).map((_btn) => {
                _btn.classList.remove('focus');
            })
            sections[i].classList.add('visible');
            sections[i].style.animation = '200ms fadein';
            btn.classList.add('focus');
        });
    });

    function discordIsOpen() {
        return new Promise((res, err) => {
            exec('tasklist', (err, stdout, stderr) => {
                res(stdout.toLowerCase().includes('discord.exe'));
            });
        });
    }

    var client = new net.Socket();
    let connected = false;

    const connectedInfo = document.querySelector('.connected');
    let installedVersion = "1.0";

    async function initSocket() {
        client.on('data', async function (data) {
            const packet = data.toString();

            if (packet.startsWith('OK')) {

                connectedInfo.style.color = 'rgb(100, 202, 159)';
                connectedInfo.setAttribute('title', "MicaDiscord est connecté à Discord");

                const hasVersion = packet.split(' ').length == 2;

                if (hasVersion)
                    installedVersion = packet.split(' ')[1];

            }


        });

        client.on('close', async () => {
            connected = false;
        });
    }

    setInterval(async () => {
        if (!connected) {
            const discordOpened = await discordIsOpen();

            if (discordOpened) {
                connectedInfo.style.color = 'rgb(252, 208, 10)';
                connectedInfo.setAttribute('title', "MicaDiscord n'est pas installé");
            } else {
                connectedInfo.style.color = 'rgb(128, 13, 1)';
                connectedInfo.setAttribute('title', "MicaDiscord n'arrive pas à se connecter à Discord");
            }

            client.connect(65321, '127.0.0.1', async function () {
                connected = true;
                await initSocket();
            });
        }
    }, 1000);

    const apply = document.getElementById('apply');
    const options = document.getElementById('options');

    apply.addEventListener('click', () => {
        if (!connected)
            ipcRenderer.send('apply', false);

        else {
            client.write(`1 ${document.querySelector('input[name="effect"]:checked').value} ${document.querySelector('input[name="theme"]:checked').value}`);
        }
    });

    options.addEventListener('click', () => {
        ipcRenderer.send('options');
    });

    ipcRenderer.on('corner', (evt, value) => {
        client.write(`3 ${value}`);
    });

    ipcRenderer.on('borderColor', (evt, value, enable) => {
        client.write(`4 ${value} ${enable ? 1 : 0}`);
    });

    ipcRenderer.on('backgroundColor', (evt, color, alpha, type, enable) => {
        client.write(`5 ${color} ${alpha} ${type} ${enable ? 1 : 0}`);
    });

    const install = document.querySelector('.download');
    const uninstall = document.getElementById('uninstall');

    let installfunc = async () => {
        document.querySelector('.log').innerText = '';
        await log('MicaDiscord - By GregVido and Arbitro\n');

        const discordOpened = await discordIsOpen();

        if (discordOpened) {
            await log('> Killing discord');
            await progress(0);

            await killDiscord();
        }

        try {
            await log('> Installing Mica-Electron');

            let found = false;
            let prevFolder = ['..'];

            while (!found) {
                if (fs.existsSync(path.join(__dirname, ...prevFolder, 'data'))) {
                    await fs.copy(path.join(__dirname, ...prevFolder, 'data'), discord);
                    found = true;
                }

                else
                    prevFolder.push('..');

            }

            await progress(50);

            await log('> Launching Discord');
            await launchDiscord();

            fs.writeFileSync(micadiscordInfo, JSON.stringify({ lastUpdate: GlobalProperties.VERSION }));

            document.querySelector('alert').style.display = "none";

            await log('\n-- Successfull install --');
            await progress(100);
        }
        catch (e) {
            console.log(__dirname);
            console.log(e);
            installfunc();
        }
    }

    install.addEventListener('click', installfunc);

    uninstall.addEventListener('click', async () => {
        let uninstallSuccess = false;

        document.querySelector('.log').innerText = '';
        document.querySelector('span').click();

        await log('> Check app folder');
        await progress(0);

        if (fs.existsSync(discord)) {
            if (fs.existsSync(discord + "main.js")) {
                fs.unlinkSync(discord + "main.js");
                uninstallSuccess = true;
                await log('> Delete main.js');
                await progress(25);
            }

            if (fs.existsSync(discord + "injector.js")) {
                fs.unlinkSync(discord + "injector.js");
                await log('> Delete injector.js');
                await progress(50);
            }

            if (fs.existsSync(discord + "index.js")) {
                fs.unlinkSync(discord + "package.json");
                fs.writeFileSync(discord + "package.json", '{"name":"discord_desktop_core","version":"0.0.0","private":"true","main":"index.js"}');
                await log('> Restore betterdiscord package.json');
                await progress(75);
            } else {
                if (fs.existsSync(discord + "package.json")) {
                    fs.unlinkSync(discord + "package.json");
                    uninstallSuccess = true;
                    await log('> Delete package.json');
                    await progress(75);
                }
            }

            if (uninstallSuccess) {
                const discordOpened = await discordIsOpen();

                if (discordOpened) {
                    await progress(90);
                    await log('> Discord relaunch');

                    await killDiscord();
                    await launchDiscord();
                }
            }
        } else
            await log('> Not found!');

        await progress(100);


    })

    if (fs.existsSync(micadiscord)) {
        const settingsMD = JSON.parse(fs.readFileSync(micadiscord).toString());
        settingsMD.editor = settingsMD.editor ?? true;

        setTimeout(() => {
            document.querySelectorAll('input[name="theme"]')[settingsMD.theme].checked = true;
        }, 100);

        if (!settingsMD.editor)
            editor.innerText = "Désactiver l'editeur";
    }

    if (fs.existsSync(micadiscordInfo)) {
        const infoMD = JSON.parse(fs.readFileSync(micadiscordInfo).toString());

        if (infoMD.lastUpdate >= GlobalProperties.VERSION)
            document.querySelector('alert').style.display = "none";
    }

    const thmes = micadiscordData + 'themes\\';
    const themeSetting = require(micadiscordThemes);

    let inputArray = new Object();

    let createFileInArray = (file) => {
        let theme = document.createElement('div');

        let radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.id = file;
        radioInput.name = "theme";
        radioInput.value = file;

        theme.appendChild(radioInput);

        let labelInput = document.createElement('label');
        labelInput.setAttribute('for', file);
        labelInput.innerText = file;

        theme.appendChild(labelInput);

        let cross = document.createElement('i');
        cross.classList.add('fa', 'fa-times');
        cross.style.float = 'right';

        cross.addEventListener('click', () => {
            fs.unlinkSync(thmes + file);
        });

        theme.appendChild(cross);

        document.getElementById('theme-list').appendChild(theme);
        inputArray[file] = theme;

        if (themeSetting.theme == file.split('.')[0])
            radioInput.checked = true;
    }

    fs.readdir(thmes, (err, files) => {
        files.forEach(file => {
            createFileInArray(file);
        });
    });

    setInterval(async () => {

        let getList = async () => {
            return new Promise((res, rej) => {
                let list = new Array();

                fs.readdir(thmes, (err, files) => {
                    files.forEach(file => {
                        if (!(file in inputArray) || !inputArray[file])
                            createFileInArray(file);

                        list.push(file);
                    });
                    res(list);
                });
            });
        }

        let list = await getList();


        Object.keys(inputArray).map((file, i) => {
            if (!list.includes(file)) {
                const obj = inputArray[file];

                if (obj) {
                    let checked = obj.querySelector('input').checked;

                    document.getElementById('theme-list').removeChild(obj);
                    delete inputArray[file];

                    const keyList = Object.keys(inputArray);

                    if (keyList.length && checked)
                        inputArray[keyList[0]].checked = true;
                }
            }
        });
    }, 1000);

    document.getElementById('applyTheme').addEventListener('click', () => {
        const input = document.querySelector('#theme-list input[type="radio"]:checked');

        if (!connected)
            ipcRenderer.send('apply', false);

        else {
            client.write(`2 ${fs.readFileSync(micadiscordData + 'themes\\' + input.value).toString()}`);
            themeSetting.theme = input.value.split('.')[0];
            fs.writeFileSync(micadiscordThemes, JSON.stringify(themeSetting, null, 4));
        }

    });

    document.getElementById('add-theme').addEventListener('click', () => {
        let input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        input.setAttribute('accept', 'text/css');
        input.click();

        input.onchange = e => {
            const file = e.target.files[0];
            const path = file.path;
            const name = file.name.split('.')[0];

            fs.copyFileSync(path, micadiscordData + 'themes\\' + name + '.css')
        }
    });

    async function log(e) {
        document.querySelector('.log').innerText += `${e}\n`;
        document.querySelector(".log").scrollTop = document.querySelector(".log").scrollHeight;
    }

    async function progress(e) {
        document.querySelector('progress').value = e;
    }

    async function killDiscord() {
        return new Promise((res, err) => {
            exec('taskkill /f /im discord.exe', () => {
                res(true);
            });
        });
    }

    async function launchDiscord() {
        return new Promise((res, err) => {
            exec(process.env.LOCALAPPDATA + '\\Discord\\Update.exe --processStart Discord.exe', () => {
                res(true);
            });
        });
    }

    document.getElementById('version').innerText = `Version ${GlobalProperties.VERSION}`;
}