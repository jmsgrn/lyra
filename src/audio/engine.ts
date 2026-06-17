/**
 * Audio engine — superdough (Strudel's synth/sampler/FX engine) brought up
 * headless on node-web-audio-api.
 *
 * Importing the shim first is load-bearing: it installs the Web Audio globals
 * superdough expects and makes scheduled source nodes idempotent (see
 * webaudio-shim.ts).
 */
import './webaudio-shim.js';
import { AudioContext, type NodeAudioContext } from './webaudio-shim.js';
import * as sd from 'superdough';

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
  ctx = new AudioContext({ latencyHint: opts.latencyHint ?? 'playback' });

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

export async function closeEngine(): Promise<void> {
  await ctx?.close().catch(() => undefined);
  ctx = undefined;
  ready = false;
}
