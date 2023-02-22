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

const { ipcRenderer } = require('electron');
const fs = require('fs');

window.onload = () => {
    const border = document.getElementById('border');
    const borderOptions = Object.values(document.getElementsByName('borderRadius'));

    const borderColor = document.getElementById('borderColor');
    const disableBorder = document.getElementById('disableBorder');

    const backgroundColor = document.getElementById('backgroundColor');

    const alpha = document.getElementById('alpha');
    const textAlpha = document.getElementById('textAlpha');

    const micadiscord = process.env.APPDATA + '\\MicaDiscordData\\settings.json';

    if (fs.existsSync(micadiscord)) {
        const data = require(micadiscord);

        for (let option of borderOptions) {
            option.checked = false;

            if (parseInt(option.value) == data.corner)
                option.checked = true;
        }

        if (data.borderColor)
            borderColor.value = data.borderColor;

        if (data.customEffect) {
            if (data.customEffect.alpha) {
                alpha.value = data.customEffect.alpha;
                textAlpha.innerText = parseInt(alpha.value * 100) + '%';
            }

            if (data.customEffect.color)
                backgroundColor.value = data.customEffect.color;

            if (data.customEffect.type) {
                document.getElementById('transparent').checked = false;
                document.getElementById('acrylic').checked = false;

                if (data.customEffect.type == 2)
                    document.getElementById('transparent').checked = true;

                else if (data.customEffect.type == 4)
                    document.getElementById('acrylic').checked = true;
            }
        }
    }

    border.addEventListener('click', () => {
        const value = document.querySelector('input[name="borderRadius"]:checked').value;

        ipcRenderer.send('corner', value);
    });


    const changeCationColor = (evt) => {
        ipcRenderer.send('borderColor', evt.target.value, true);
    }

    borderColor.addEventListener("input", changeCationColor, false);
    borderColor.addEventListener("change", changeCationColor, false);

    disableBorder.addEventListener('click', () => {
        ipcRenderer.send('borderColor', '#000', false);
    })

    const sendData = () => {
        const value = document.querySelector('input[name="backgroundType"]:checked').value;
        ipcRenderer.send('backgroundColor', backgroundColor.value, alpha.value, value, true);
    }

    const onAlphaChanged = () => {
        textAlpha.innerText = parseInt(alpha.value * 100) + '%';
        sendData();
    }

    alpha.addEventListener('change', onAlphaChanged);
    alpha.addEventListener('input', onAlphaChanged);


    backgroundColor.addEventListener("input", sendData, false);
    backgroundColor.addEventListener("change", sendData, false);

    document.getElementById('transparent').addEventListener('click', sendData);
    document.getElementById('acrylic').addEventListener('click', sendData);

    document.getElementById('disableBackground').addEventListener('click', () => {
        const value = document.querySelector('input[name="backgroundType"]:checked').value;
        ipcRenderer.send('backgroundColor', backgroundColor.value, alpha.value, value, false);
    });
}