/**
 * Lyra desktop — Electron main process (CommonJS; the Electron binary loads
 * this directly, so it stays plain Node with no TS/ESM imports).
 *
 * Responsibilities (all NON-realtime — the audio/visual realtime path lives
 * entirely in the renderer):
 *   - create the window and load the renderer (Vite dev server in dev)
 *   - filesystem IPC: read/write project files, read settings.json
 *   - scan sample folders and serve their files via a lyra-sample:// protocol
 *     so superdough can fetch() local samples from the sandboxed renderer
 */
const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const { readFileSync, readdirSync, writeFileSync, mkdirSync } = require('node:fs');
const { homedir } = require('node:os');
const { basename, dirname, extname, join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

// --- well-known locations (mirror src/config/paths.ts & settings.ts) ---
const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
const SETTINGS_PATH = join(configHome, 'lyra', 'settings.json');
const RECORDINGS_DIR = join(dataHome, 'lyra', 'samples');

const AUDIO_EXTS = new Set(['.wav', '.flac', '.ogg', '.mp3', '.aif', '.aiff', '.m4a']);

// The renderer URL: Vite dev server in dev, built index.html otherwise.
const RENDERER_URL = process.env.LYRA_RENDERER_URL;
const AUTOTEST = !!process.env.LYRA_AUTOTEST;

// Escape hatch for headless/VM/flaky-GPU environments where Chromium's GPU
// process can't launch ("GPU process isn't usable"). Off by default so the
// desktop app gets hardware-accelerated WebGL visuals.
if (process.env.LYRA_DISABLE_GPU) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('in-process-gpu');
}
// Only for the automated self-test: let audio start without a real gesture.
if (AUTOTEST) app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// `lyra [file]` — first non-flag arg opens that file.
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('-'));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(base[k]) && isPlainObject(v) ? deepMerge(base[k], v) : v;
  }
  return out;
}

function readRawSettings() {
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return null; // missing/invalid — renderer falls back to shared defaults
  }
}

/** Scan one dir into a superdough sample map served over lyra-sample://. */
function scanDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const map = {};
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!AUDIO_EXTS.has(ext)) continue;
    const name = basename(entry.name, ext);
    (map[name] ??= []).push(entry.name);
  }
  if (Object.keys(map).length === 0) return null;
  // file:///abs/dir/ -> lyra-sample:///abs/dir/ (keeps proper percent-encoding)
  const baseUrl = pathToFileURL(join(dir, '/')).href.replace(/^file:\/\//, 'lyra-sample://');
  return { map, baseUrl };
}

function expandHome(p) {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

// lyra-sample:// must be registered as a privileged, fetchable scheme BEFORE
// app-ready so the renderer can fetch() decoded sample files.
protocol.registerSchemesAsPrivileged([
  { scheme: 'lyra-sample', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function registerSampleProtocol() {
  protocol.handle('lyra-sample', (request) => {
    const filePath = decodeURIComponent(new URL(request.url).pathname);
    return net.fetch(pathToFileURL(filePath).href);
  });
}

function setupIpc() {
  ipcMain.handle('lyra:getInitial', () => {
    let filePath;
    let code;
    if (fileArg) {
      filePath = resolve(fileArg);
      try {
        code = readFileSync(filePath, 'utf8');
      } catch {
        code = ''; // missing path => new file
      }
    }
    let version = '0.0.0';
    try {
      version = require(join(__dirname, '..', '..', 'package.json')).version;
    } catch {
      /* ignore */
    }
    return { filePath, code, rawSettings: readRawSettings(), settingsPath: SETTINGS_PATH, version };
  });

  ipcMain.handle('lyra:readFile', (_e, path) => {
    try {
      return { content: readFileSync(resolve(path), 'utf8') };
    } catch (err) {
      if (err && err.code === 'ENOENT') return { content: '' }; // open-new
      return { error: String((err && err.message) || err) };
    }
  });

  ipcMain.handle('lyra:writeFile', (_e, path, content) => {
    try {
      const target = resolve(path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
      return {};
    } catch (err) {
      return { error: String((err && err.message) || err) };
    }
  });

  ipcMain.handle('lyra:updateSettings', (_e, patch) => {
    try {
      const current = isPlainObject(readRawSettings()) ? readRawSettings() : {};
      const merged = deepMerge(current, patch);
      mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
      writeFileSync(SETTINGS_PATH, `${JSON.stringify(merged, null, 2)}\n`);
      return {};
    } catch (err) {
      return { error: String((err && err.message) || err) };
    }
  });

  ipcMain.handle('lyra:scanSamples', () => {
    const settings = readRawSettings();
    const dirs = [...(Array.isArray(settings?.samples) ? settings.samples : []), RECORDINGS_DIR];
    const packs = [];
    for (const src of dirs) {
      const pack = scanDir(resolve(expandHome(String(src))));
      if (pack) packs.push(pack);
    }
    return packs;
  });

  // record a captured WAV (sent as bytes from the renderer) into the
  // recordings dir, return the base URL so the renderer can register it.
  ipcMain.handle('lyra:saveRecording', (_e, name, bytes) => {
    try {
      mkdirSync(RECORDINGS_DIR, { recursive: true });
      writeFileSync(join(RECORDINGS_DIR, `${name}.wav`), Buffer.from(bytes));
      const baseUrl = pathToFileURL(join(RECORDINGS_DIR, '/')).href.replace(/^file:\/\//, 'lyra-sample://');
      return { baseUrl, file: `${name}.wav` };
    } catch (err) {
      return { error: String((err && err.message) || err) };
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    backgroundColor: '#0b0b10',
    title: 'lyra',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, 'preload.cjs'),
    },
  });
  // Filter benign dev noise so the launcher terminal stays readable. The
  // superdough deprecation is its own internal node.onended usage (harmless in
  // Chromium); the Electron warning is a dev-only CSP nag (we need unsafe-eval
  // to eval live-coding source); the rest are framework chatter.
  const NOISE = /\[superdough\] Deprecation warning|Electron Security Warning|Download the React DevTools/i;
  win.webContents.on('console-message', (_e, _lvl, message) => {
    if (NOISE.test(message)) return;
    process.stdout.write(`[renderer] ${message}\n`);
  });
  if (RENDERER_URL) {
    win.loadURL(RENDERER_URL + (AUTOTEST ? '?autotest=1' : ''));
  } else {
    win.loadFile(join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  registerSampleProtocol();
  setupIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => app.quit());
