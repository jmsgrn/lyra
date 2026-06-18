/**
 * Settings schema, defaults, and merge — pure and host-neutral (NO fs, NO
 * Node). Shared by the node loader (src/config/settings.ts) and the Electron
 * renderer (which receives the raw settings.json over IPC and merges it here),
 * so the defaults live in exactly one place.
 */

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
   * "" leaves it to the system. (Headless/node path only.)
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

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recursively merge `override` onto `base` (arrays and scalars replace). */
export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : (override as T);
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = base[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return out as T;
}
