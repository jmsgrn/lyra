/**
 * Audio engine — superdough (Strudel's synth/sampler/FX engine) brought up
 * headless on node-web-audio-api.
 *
 * Importing the shim first is load-bearing: it installs the Web Audio globals
 * superdough expects and makes scheduled source nodes idempotent (see
 * webaudio-shim.ts).
 */
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import './webaudio-shim.js';
import './fetch-file.js'; // enable file:// fetch so superdough can load local samples
import { AudioContext, type NodeAudioContext } from './webaudio-shim.js';
import * as sd from 'superdough';
import { settings } from '../config/settings.js';

/** A subset of the control params superdough understands; open-ended on purpose. */
export interface SoundParams {
  s?: string;
  note?: string | number;
  n?: number;
  gain?: number;
  cutoff?: number;
  [param: string]: unknown;
}

export interface EngineOptions {
  /**
   * node-web-audio-api needs 'playback' on Linux to actually open the output
   * device (the default 'interactive' leaves the context suspended). See
   * webaudio-shim notes.
   */
  latencyHint?: 'interactive' | 'playback' | 'balanced' | number;
}

let ctx: NodeAudioContext | undefined;
let ready = false;
let workletsEnabled = false;

// superdough exposes context injectors as loose exports; type them narrowly.
const sdAny = sd as unknown as {
  setAudioContext?: (c: unknown) => void;
  setDefaultAudioContext?: (c: unknown) => void;
  resetGlobalEffects?: () => void;
  superdough: (value: unknown, deadline: number, duration: number, cps?: number) => unknown;
};

/** Initialise the audio engine. Idempotent. */
export async function initEngine(opts: EngineOptions = {}): Promise<void> {
  if (ready) return;
  ctx = new AudioContext({ latencyHint: opts.latencyHint ?? settings.audio.latencyHint });

  // Make superdough use our context instead of lazily constructing its own
  // (which would omit latencyHint and fail to open the device).
  sdAny.setAudioContext?.(ctx);
  sdAny.setDefaultAudioContext?.(ctx);

  try {
    await sd.initAudio();
    workletsEnabled = true;
  } catch {
    await sd.initAudio({ disableWorklets: true } as Parameters<typeof sd.initAudio>[0]);
    workletsEnabled = false;
  }

  sd.registerSynthSounds();

  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => undefined);
  }
  ready = true;
}

export function isReady(): boolean {
  return ready;
}

export function hasWorklets(): boolean {
  return workletsEnabled;
}

export function getContext(): NodeAudioContext {
  if (!ctx) throw new Error('audio engine not initialised — call initEngine() first');
  return ctx;
}

/**
 * Current audio-clock time, in seconds — the time base the scheduler uses.
 *
 * Deliberately does NOT throw: the Strudel Cyclist calls this from a timer, and
 * a tick can fire during teardown after the context is gone. Returning 0 there
 * is harmless and avoids crashing the process on exit.
 */
export function now(): number {
  return ctx ? ctx.currentTime : 0;
}

/**
 * Trigger a single audio event. Shaped as a Strudel scheduler output:
 * `(hap, deadline, duration, cps, targetTime)`.
 *
 * Strudel's Cyclist passes the deadline RELATIVE to now (arg 2) and the
 * ABSOLUTE target time on the audio clock as arg 5. superdough schedules
 * against absolute audio time, so we use `targetTime` (falling back to
 * `now() + deadline` for callers that don't supply it). A bad hap (e.g. an
 * unknown sound name) is logged but never throws, so one mistake can't kill
 * the whole stream.
 */
export function trigger(
  hap: { value: SoundParams } | SoundParams,
  deadline: number,
  duration: number,
  cps = 1,
  targetTime?: number,
): void {
  if (!ctx) return; // engine torn down (e.g. during exit); drop the event
  const value = (hap as { value?: SoundParams }).value ?? (hap as SoundParams);
  const when = targetTime ?? now() + deadline;
  try {
    sdAny.superdough(value, when, duration, cps);
  } catch (err) {
    console.error('[engine] trigger error:', err instanceof Error ? err.message : String(err));
  }
}

/** Silence any sustained global effects (panic / hush helper). */
export function resetEffects(): void {
  sdAny.resetGlobalEffects?.();
}

/**
 * Register a superdough sample map so `s("name")` can play it. `map` is either
 * a `{ name: ['file.wav', ...] }` object (with `baseUrl` prepended) or a URL to
 * a strudel.json sample map. Local packs use file:// URLs (see fetch-file).
 * Samples are fetched/decoded lazily on first trigger.
 */
export async function loadSamples(
  map: Record<string, unknown> | string,
  baseUrl?: string,
): Promise<void> {
  if (!ready) await initEngine();
  await sd.samples(map, baseUrl);
}

const AUDIO_EXTENSIONS = new Set(['.wav', '.flac', '.ogg', '.mp3', '.aif', '.aiff', '.m4a']);

/**
 * Load a sample source by path/URL. A directory becomes a sample map (each
 * audio file's basename is a sound name); a `.json` file/URL or an http(s) URL
 * is loaded as a strudel.json sample map. Returns the sound names registered.
 */
export async function loadSampleSource(source: string): Promise<string[]> {
  const expanded = source.startsWith('~') ? join(homedir(), source.slice(1)) : source;
  if (/^https?:\/\//.test(expanded) || expanded.endsWith('.json')) {
    const url = /^[a-z]+:\/\//i.test(expanded) ? expanded : pathToFileURL(resolve(expanded)).href;
    await loadSamples(url);
    return [];
  }

  const dir = resolve(expanded);
  const baseUrl = pathToFileURL(join(dir, '/')).href;
  const map: Record<string, string[]> = {};
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return []; // directory doesn't exist / unreadable — nothing to load
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;
    const name = basename(entry.name, ext);
    (map[name] ??= []).push(entry.name);
  }
  const names = Object.keys(map);
  if (names.length > 0) await loadSamples(map, baseUrl);
  return names;
}

export async function closeEngine(): Promise<void> {
  await ctx?.close().catch(() => undefined);
  ctx = undefined;
  ready = false;
}
