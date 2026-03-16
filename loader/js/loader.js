const { ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const GlobalProperties = require('../GlobalProperties.js');

const dataDir = path.join(process.env.APPDATA, 'MicaDiscordData');
const themesDir = path.join(dataDir, 'themes');
const themesFile = path.join(dataDir, 'themes.json');

/* Bundled themes folder */
const bundledThemesDir = path.join(__dirname, '..', 'themes');

const statusEl = document.getElementById('status');

function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function copyDirectoryRecursive(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`Bundled themes directory not found: ${sourceDir}`);
    }

    fs.mkdirSync(targetDir, { recursive: true });

    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            copyDirectoryRecursive(sourcePath, targetPath);
        } else if (entry.isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

function getDefaultThemeName() {
    if (!fs.existsSync(bundledThemesDir)) {
        return null;
    }

    const entries = fs
        .readdirSync(bundledThemesDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.css'))
        .map(entry => entry.name);

    if (entries.length === 0) {
        return null;
    }

    return path.basename(entries[0], '.css');
}

async function getValidVersion() {
    const release = os.release().split('.');
    const major = Number.parseInt(release[0], 10);
    const build = Number.parseInt(release[2], 10);

    await delay(700);

    return major >= 10 && build >= 22000;
}

async function extractData() {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(themesDir, { recursive: true });

    /* Copy every bundled theme file/folder into the user themes directory */
    copyDirectoryRecursive(bundledThemesDir, themesDir);

    /* Create themes.json only if it does not exist yet */
    if (!fs.existsSync(themesFile)) {
        const defaultTheme = getDefaultThemeName();

        fs.writeFileSync(
            themesFile,
            JSON.stringify(
                { theme: defaultTheme || null },
                null,
                2
            ),
            'utf8'
        );
    }

    await delay(500);
}

async function update() {
    const UPDATE_URL = `https://www.micadiscord.com/api/update.json?time=${Date.now()}`;
    const VERSION = GlobalProperties.VERSION;

    try {
        const response = await fetch(UPDATE_URL);
        const params = await response.json();

        if (params.version === VERSION) {
            return false;
        }

        return await new Promise((resolve) => {
            ipcRenderer.once('res', () => resolve(false));
            ipcRenderer.send('update');
        });
    } catch (error) {
        console.error('Update check failed:', error);
        return false;
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        setStatus('Checking for updates...');
        const hasUpdate = await update();

        if (hasUpdate) return;

        setStatus('Checking operating system compatibility...');
        const isWin11 = await getValidVersion();

        if (!isWin11) {
            ipcRenderer.send('error');
            return;
        }

        setStatus('Preparing resources...');
        await extractData();

        setStatus('Launching MicaDiscord...');
        await delay(300);

        ipcRenderer.send('getController');
    } catch (error) {
        console.error('Loader error:', error);
        setStatus('An error occurred...');
        ipcRenderer.send('error');
    }
});