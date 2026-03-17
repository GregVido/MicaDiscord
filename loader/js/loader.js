const { ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dataDir = path.join(process.env.APPDATA, 'MicaDiscordData');
const themesDir = path.join(dataDir, 'themes');
const themesFile = path.join(dataDir, 'themes.json');
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

    await delay(300);

    return major >= 10 && build >= 22000;
}

async function extractData() {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(themesDir, { recursive: true });

    copyDirectoryRecursive(bundledThemesDir, themesDir);

    if (!fs.existsSync(themesFile)) {
        const defaultTheme = getDefaultThemeName();

        fs.writeFileSync(
            themesFile,
            JSON.stringify(
                { theme: defaultTheme || 'ClearVision-v7' },
                null,
                2
            ),
            'utf8'
        );
    }

    await delay(300);
}

async function update() {
    setStatus('Checking for updates...');
    const result = await ipcRenderer.invoke('check-for-updates');

    if (!result || result.error) {
        console.error('Update check failed:', result?.error);
        return false;
    }

    if (!result.available) {
        return false;
    }

    setStatus(`Downloading update ${result.version}...`);

    const downloadResult = await ipcRenderer.invoke('download-update');

    if (!downloadResult.ok) {
        console.error('Update download failed:', downloadResult.error);
        return false;
    }

    setStatus('Installing update...');
    await delay(700);
    await ipcRenderer.invoke('quit-and-install-update');
    return true;
}

ipcRenderer.on('update-progress', (_event, data) => {
    const percent = Math.round(data.percent || 0);
    setStatus(`Downloading update... ${percent}%`);
});

window.addEventListener('DOMContentLoaded', async () => {
    try {
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

        setStatus('Waiting for Discord...');
        await delay(300);

        ipcRenderer.send('getController');
    } catch (error) {
        console.error('Loader error:', error);
        setStatus('An error occurred...');
        ipcRenderer.send('error');
    }
});