/*
Copyright 2026 GregVido

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
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

    const borderPreview = document.getElementById('borderPreview');
    const backgroundPreview = document.getElementById('backgroundPreview');
    const borderColorValue = document.getElementById('borderColorValue');
    const backgroundColorValue = document.getElementById('backgroundColorValue');

    const micadiscord = process.env.APPDATA + '\\MicaDiscordData\\settings.json';

    function updateColorPreview(input, preview, label) {
        preview.style.background = input.value;
        label.textContent = input.value.toUpperCase();
    }

    function updateAlphaLabel() {
        textAlpha.innerText = parseInt(alpha.value * 100, 10) + '%';
    }

    if (fs.existsSync(micadiscord)) {
        const data = require(micadiscord);

        for (const option of borderOptions) {
            option.checked = false;

            if (parseInt(option.value, 10) === data.corner) {
                option.checked = true;
            }
        }

        if (data.borderColor) {
            borderColor.value = data.borderColor;
        }

        if (data.customEffect) {
            if (data.customEffect.alpha !== undefined) {
                alpha.value = data.customEffect.alpha;
            }

            if (data.customEffect.color) {
                backgroundColor.value = data.customEffect.color;
            }

            if (data.customEffect.type) {
                document.getElementById('transparent').checked = false;
                document.getElementById('acrylic').checked = false;

                if (data.customEffect.type === 2) {
                    document.getElementById('transparent').checked = true;
                } else if (data.customEffect.type === 4) {
                    document.getElementById('acrylic').checked = true;
                }
            }
        }
    }

    updateColorPreview(borderColor, borderPreview, borderColorValue);
    updateColorPreview(backgroundColor, backgroundPreview, backgroundColorValue);
    updateAlphaLabel();

    border.addEventListener('click', () => {
        const value = document.querySelector('input[name="borderRadius"]:checked').value;
        ipcRenderer.send('corner', value);
    });

    const changeBorderColor = (event) => {
        updateColorPreview(borderColor, borderPreview, borderColorValue);
        ipcRenderer.send('borderColor', event.target.value, true);
    };

    borderColor.addEventListener('input', changeBorderColor, false);
    borderColor.addEventListener('change', changeBorderColor, false);

    disableBorder.addEventListener('click', () => {
        ipcRenderer.send('borderColor', '#000', false);
    });

    const sendData = () => {
        updateColorPreview(backgroundColor, backgroundPreview, backgroundColorValue);
        const value = document.querySelector('input[name="backgroundType"]:checked').value;
        ipcRenderer.send('backgroundColor', backgroundColor.value, alpha.value, value, true);
    };

    const onAlphaChanged = () => {
        updateAlphaLabel();
        sendData();
    };

    alpha.addEventListener('change', onAlphaChanged);
    alpha.addEventListener('input', onAlphaChanged);

    backgroundColor.addEventListener('input', sendData, false);
    backgroundColor.addEventListener('change', sendData, false);

    document.getElementById('transparent').addEventListener('click', sendData);
    document.getElementById('acrylic').addEventListener('click', sendData);

    document.getElementById('disableBackground').addEventListener('click', () => {
        const value = document.querySelector('input[name="backgroundType"]:checked').value;
        ipcRenderer.send('backgroundColor', backgroundColor.value, alpha.value, value, false);
    });
};