/**
 * Node settings loader (TUI / headless host). Loads ~/.config/lyra/settings.json
 * (respecting $XDG_CONFIG_HOME) once at startup and deep-merges it over the
 * shared defaults. Missing file = defaults (and writes one); a malformed file
 * falls back to defaults and records `settingsError` for the UI to surface.
 *
 * The schema, defaults, and merge live in src/shared/settings.ts so the Electron
 * renderer can reuse them; this module only adds the filesystem I/O.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { DEFAULT_SETTINGS, deepMerge, type Settings } from '../shared/settings.js';

export type {
  Settings,
  ThemeSettings,
  AudioSettings,
} from '../shared/settings.js';
export { DEFAULT_SETTINGS } from '../shared/settings.js';

const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
export const settingsPath = join(configHome, 'lyra', 'settings.json');

export let settingsError: string | undefined;

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
