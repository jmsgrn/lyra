/**
 * User settings, VSCode/Claude style. Loaded once at startup from
 * ~/.config/lyra/settings.json (respecting $XDG_CONFIG_HOME) and deep-merged
 * over the defaults. Missing file = defaults; a malformed file falls back to
 * defaults and records `settingsError` for the UI to surface.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface ThemeSettings {
  header: string;
  editorActive: string;
  command: string;
  borderInactive: string;
  muted: string;
  key: string;
  playing: string;
  stopped: string;
  error: string;
}

export interface AudioSettings {
  /** node-web-audio-api latency hint (ALSA backend). 'playback' avoids crunch. */
  latencyHint: 'interactive' | 'balanced' | 'playback' | number;
  /**
   * PipeWire buffer hint for the launcher, e.g. "1024/48000". Pins lyra's
   * quantum so PipeWire doesn't run the graph at a tiny buffer (= crackle).
   * Bigger = cleaner but more latency. "" leaves it to the system.
   */
  pipewireLatency: string;
  /**
   * Enable superdough's AudioWorklet DSP. Worklets add some FX but run JS per
   * audio block; if that causes crackle, set false to use native nodes only.
   */
  worklets: boolean;
}

export interface Settings {
  theme: ThemeSettings;
  /** transport defaults */
  tempo: { cps: number };
  audio: AudioSettings;
  /** sample sources to auto-load on startup: directories, or strudel.json paths/URLs */
  samples: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: {
    header: 'magenta',
    editorActive: 'cyan',
    command: 'yellow',
    borderInactive: 'gray',
    muted: 'gray',
    key: 'cyan',
    playing: 'green',
    stopped: 'gray',
    error: 'red',
  },
  tempo: { cps: 0.5 },
  audio: { latencyHint: 'playback', pipewireLatency: '1024/48000', worklets: true },
  samples: [],
};

const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
export const settingsPath = join(configHome, 'lyra', 'settings.json');

export let settingsError: string | undefined;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recursively merge `override` onto `base` (arrays and scalars replace). */
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : (override as T));
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = base[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return out as T;
}

function load(): Settings {
  try {
    const parsed: unknown = JSON.parse(readFileSync(settingsPath, 'utf8'));
    return deepMerge(DEFAULT_SETTINGS, parsed);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      // First run: write a defaults file so it's discoverable and editable.
      try {
        mkdirSync(dirname(settingsPath), { recursive: true });
        writeFileSync(settingsPath, `${JSON.stringify(DEFAULT_SETTINGS, null, 2)}\n`);
      } catch {
        /* read-only home etc. — fall back to in-memory defaults */
      }
    } else {
      settingsError = `settings.json: ${e.message}`;
    }
    return DEFAULT_SETTINGS;
  }
}

export const settings: Settings = load();
