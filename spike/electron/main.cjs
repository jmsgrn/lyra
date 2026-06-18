/**
 * Phase-0 spike — Electron main process.
 *
 * Creates a single window with a pure web renderer (contextIsolation on,
 * nodeIntegration off) so the spike proves audio works in a *browser* context,
 * not via Node. Forwards renderer console output to stdout so the spike can be
 * validated from a terminal. The renderer URL (Vite dev server) is argv[2].
 */
const { app, BrowserWindow } = require('electron');

// Allow audio to start without a literal mouse click so the automated
// self-test (?autotest=1) can validate end to end. A real app keeps the
// browser's gesture requirement; the Play button satisfies it interactively.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const url = process.argv[2] || 'http://localhost:5180';

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    backgroundColor: '#0b0b10',
    title: 'lyra · Phase-0 spike',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  win.webContents.on('console-message', (_event, _level, message) => {
    process.stdout.write(`[renderer] ${message}\n`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    process.stdout.write(`[main] render-process-gone: ${JSON.stringify(details)}\n`);
  });

  win.loadURL(url);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
