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

const { ipcRenderer } = require('electron')
const path = require('path');
const os = require('os');
const fs = require('fs');

const GlobalProperties = require('../GlobalProperties.js');
const micadiscordThemes = process.env.APPDATA + '\\MicaDiscordData\\themes.json';

async function getValidVersion() {
    return new Promise((res, err) => {
        const data = os.release().split('.');
        const version = parseInt(data[0]);
        const minor = parseInt(data[2]);

        const hasError = !(version >= 10 && minor >= 22000);

        setTimeout(res, 1000, hasError ? "error" : "");
    })
}

async function extractData() {
    return new Promise((res, err) => {

        const dir = process.env.APPDATA + "\\MicaDiscordData\\";

        if (!fs.existsSync(dir))
            fs.mkdirSync(dir);

        if (!fs.existsSync(micadiscordThemes))
            fs.writeFileSync(micadiscordThemes, JSON.stringify({ theme: 'ClearVision_v6' }));

        if (!fs.existsSync(dir + 'themes\\'))
            fs.mkdirSync(dir + 'themes\\');

        fs.copyFileSync(path.join(__dirname, '..', 'ClearVision_v6.css'), dir + 'themes\\ClearVision_v6.css');

        setTimeout(res, 500, true);
    })
}

async function update() {
    return new Promise((res, err) => {
        const UPDATE_URL = 'https://www.micadiscord.com/api/update.json';
        const VERSION = GlobalProperties.VERSION;


        fetch(UPDATE_URL).then((r) => {
            r.text().then((d) => {
                let params = JSON.parse(d);
                
                ipcRenderer.on('res', () => {
                    res(false);
                });

                if (params.version == VERSION)
                    res(false);
                else 
                    ipcRenderer.send('update');
            })
        });
    });
}

window.onload = async () => {

    const infoTxt = document.querySelector('span');

    const hasUdpate = await update();

    if (!hasUdpate) {

        infoTxt.innerText = "Operating system detection ...";

        const isWin11 = await getValidVersion();

        if (isWin11 == "error")
            ipcRenderer.send('error');

        else {
            infoTxt.innerText = "Extracting resources ...";

            await extractData();

            ipcRenderer.send('getController');
        }
    }


}