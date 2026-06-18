/**
 * User settings, VSCode/Claude style. Loaded once at startup from
 * ~/.config/lyra/settings.json (respecting $XDG_CONFIG_HOME) and deep-merged
 * over the defaults. Missing file = defaults; a malformed file falls back to
 * defaults and records `settingsError` for the UI to surface.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

export interface Settings {
  theme: ThemeSettings;
  /** transport defaults */
  tempo: { cps: number };
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
    if (e.code !== 'ENOENT') settingsError = `settings.json: ${e.message}`;
    return DEFAULT_SETTINGS;
  }
}

export const settings: Settings = load();
