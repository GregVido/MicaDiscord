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

let content = THEME_CONTENT;

function applyTheme() {
    const style = document.createElement('style');
    style.textContent = content;
    style.id = 'MicaTheme';
    document.head.appendChild(style);
}

let interval = setInterval(() => {

    const theme = document.getElementById('MicaTheme');
    const app = document.getElementById('app-mount');

    if (app) {
        if (theme) {
            if (content.length != theme.textContent.length) {
                document.head.removeChild(theme);
                applyTheme();
                clearInterval(interval);
            }
        }
        else
            applyTheme();
    }

}, 60);


function setTheme(data) {
    content = data;

    const theme = document.getElementById('MicaTheme');

    if (theme) {
        if (content.length != theme.textContent.length) {
            document.head.removeChild(theme);
            applyTheme();
        }
    }
    else
        applyTheme();
};