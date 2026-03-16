/*
Copyright 2026 GregVido

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
*/

let content = THEME_CONTENT;

const THEME_STYLE_ID = 'MicaTheme';
const THEME_SWAP_STYLE_ID = 'MicaThemeSwapFix';
const THEME_ATTR = 'data-mica-theme';

function createSwapFixStyle() {
    let style = document.getElementById(THEME_SWAP_STYLE_ID);

    if (!style) {
        style = document.createElement('style');
        style.id = THEME_SWAP_STYLE_ID;
        style.textContent = `
            * {
                transition: none !important;
                animation: none !important;
            }
        `;
    }

    return style;
}

function enableSwapFix() {
    const style = createSwapFixStyle();
    if (!style.parentNode) {
        document.head.appendChild(style);
    }
}

function disableSwapFix() {
    const style = document.getElementById(THEME_SWAP_STYLE_ID);
    if (style?.parentNode) {
        style.parentNode.removeChild(style);
    }
}

function removeAllThemeStyles() {
    const styles = document.querySelectorAll(
        `style#${THEME_STYLE_ID}, style[${THEME_ATTR}="true"]`
    );

    for (const style of styles) {
        style.remove();
    }
}

function createThemeStyle(cssText) {
    const style = document.createElement('style');
    style.id = THEME_STYLE_ID;
    style.setAttribute(THEME_ATTR, 'true');
    style.textContent = cssText;
    return style;
}

function getCurrentThemeStyle() {
    return document.getElementById(THEME_STYLE_ID);
}

function applyTheme(cssText = content) {
    if (!document.head) return false;

    const current = getCurrentThemeStyle();

    if (current && current.textContent === cssText) {
        return true;
    }

    enableSwapFix();

    const newStyle = createThemeStyle(cssText);

    if (current?.parentNode) {
        current.parentNode.insertBefore(newStyle, current.nextSibling);
        current.remove();
    } else {
        removeAllThemeStyles();
        document.head.appendChild(newStyle);
    }

    content = cssText;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            disableSwapFix();
        });
    });

    return true;
}

function waitForAppMountAndApply() {
    const tryApply = () => {
        const app = document.getElementById('app-mount');
        if (!app || !document.head) return false;

        removeAllThemeStyles();
        return applyTheme(content);
    };

    if (tryApply()) return;

    const observer = new MutationObserver(() => {
        if (tryApply()) {
            observer.disconnect();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
}

function setTheme(data) {
    if (typeof data !== 'string') return;
    applyTheme(data);
}

function clearTheme() {
    removeAllThemeStyles();
}

window.setTheme = setTheme;
window.clearTheme = clearTheme;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForAppMountAndApply, { once: true });
} else {
    waitForAppMountAndApply();
}