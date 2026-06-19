/**
 * Platform-agnostic Lyra engine.
 *
 * Wires Strudel's own `repl()` (which owns the look-ahead Cyclist scheduler and
 * the transpile→eval loop) to superdough, driving sound through an *injected*
 * `AudioContext`. Because the context is injected, the same engine runs:
 *   - headless under Node (via src/platform/node.ts → node-web-audio-api), and
 *   - in a browser/Electron renderer (via a native AudioContext), unchanged.
 *
 * This module imports superdough, which expects the Web Audio globals to exist.
 * The host is therefore responsible for installing them BEFORE importing this
 * module (the node platform does so via webaudio-shim; a browser has them
 * natively). Do not import this module directly from code that runs before that
 * setup — go through the platform entry point.
 */
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import { transpiler } from '@strudel/transpiler';
import * as sd from 'superdough';
import type { AudioContextLike, EngineEvent, ReplState, SoundParams } from './types.js';

// superdough/strudel expose loose, partly-untyped runtime APIs; type them narrowly.
const sdAny = sd as unknown as {
  setAudioContext?: (c: unknown) => void;
  setDefaultAudioContext?: (c: unknown) => void;
  initAudio: (opts?: { disableWorklets?: boolean }) => Promise<void>;
  registerSynthSounds: () => void;
  samples: (map: unknown, baseUrl?: string) => Promise<void>;
  resetGlobalEffects?: () => void;
  superdough: (value: unknown, deadline: number, duration: number, cps?: number) => unknown;
  getSuperdoughAudioController?: () => { output?: { destinationGain?: AudioNode } } | undefined;
};

interface StrudelRepl {
  evaluate(code: string, autostart?: boolean): Promise<unknown>;
  start(): void;
  stop(): void;
  toggle(): void;
  setCps(cps: number): void;
  scheduler: { now(): number; setCps(cps: number): void; [k: string]: unknown };
  state: ReplState;
}

export interface Engine {
  /** Transpile + evaluate user code and hot-swap the running pattern. */
  evaluate(code: string, autostart?: boolean): Promise<unknown>;
  start(): void;
  stop(): void;
  toggle(): void;
  /** Set tempo in cycles per second. */
  setCps(cps: number): void;
  /** Current audio-clock time in seconds — the scheduler's time base. */
  now(): number;
  isReady(): boolean;
  hasWorklets(): boolean;
  getContext(): AudioContextLike;
  /**
   * Subscribe to scheduled sound events — the tap visualizers/analysis use.
   * Returns an unsubscribe function.
   */
  onEvent(listener: (event: EngineEvent) => void): () => void;
  /**
   * An AnalyserNode tapping superdough's master output (for scope/spectrum
   * visuals), or undefined if the output graph isn't up yet. Lazily created and
   * reconnected if superdough rebuilds its output.
   */
  getAnalyser(): AnalyserNode | undefined;
  /**
   * The currently-evaluated Strudel pattern (queryable via `.queryArc(a, b)`
   * for pianoroll/highlight visuals), or undefined before the first eval.
   */
  getPattern(): unknown;
  /** Current transport position in CYCLES — the pianoroll/highlight time base. */
  nowCycles(): number;
  /** Register a superdough sample map (`{ name: ['file.wav'] }` or a json URL). */
  loadSamples(map: Record<string, unknown> | string, baseUrl?: string): Promise<void>;
  /** Silence sustained global effects (panic / hush helper). */
  resetEffects(): void;
  close(): Promise<void>;
  readonly scheduler: { now(): number; setCps(cps: number): void; [k: string]: unknown };
  readonly state: ReplState;
}

export interface CreateEngineOptions {
  /** The AudioContext to drive (node-web-audio-api or browser-native). */
  context: AudioContextLike;
  /** Enable superdough's AudioWorklet DSP; falls back to native nodes on failure. */
  worklets?: boolean;
  onError?: (error: unknown) => void;
  onUpdate?: (state: ReplState) => void;
}

// Strudel's eval scope is a process-global registration, so guard it once.
let scopeReady = false;
async function ensureScope(): Promise<void> {
  if (scopeReady) return;
  await (core as unknown as { evalScope: (...mods: unknown[]) => Promise<void> }).evalScope(core, mini);
  // Make bare double-quoted strings parse as mini-notation even outside the
  // transpiler path (e.g. note("c2 e2 g2")).
  (core as unknown as { setStringParser: (p: unknown) => void }).setStringParser(mini.mini);
  scopeReady = true;
}

export async function createEngine(opts: CreateEngineOptions): Promise<Engine> {
  const ctx = opts.context;

  // Make superdough use our context instead of lazily constructing its own.
  sdAny.setAudioContext?.(ctx);
  sdAny.setDefaultAudioContext?.(ctx);

  let workletsEnabled = opts.worklets ?? true;
  try {
    await sdAny.initAudio({ disableWorklets: !workletsEnabled });
  } catch {
    await sdAny.initAudio({ disableWorklets: true });
    workletsEnabled = false;
  }
  sdAny.registerSynthSounds();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);

  await ensureScope();

  const listeners = new Set<(event: EngineEvent) => void>();

  /**
   * Audio-clock time. Deliberately never throws: the Cyclist calls this from a
   * timer and a tick can fire during teardown after the context is closed —
   * returning 0 there is harmless and avoids crashing the process on exit.
   */
  const now = (): number => {
    try {
      return ctx.currentTime;
    } catch {
      return 0;
    }
  };

  /**
   * Trigger one audio event, shaped as a Strudel scheduler output. The Cyclist
   * passes the deadline relative to now (arg 2) and the absolute target time on
   * the audio clock as arg 5; superdough schedules against absolute time.
   *
   * superdough() can both throw synchronously and return a promise that REJECTS
   * (e.g. an unknown sound name); we swallow both so one bad hap can neither
   * kill the stream nor spew uncaught rejections. Every triggered event is also
   * fanned out to `onEvent` listeners (the visualizer tap).
   */
  const trigger = (
    hap: { value?: SoundParams } | SoundParams,
    deadline: number,
    duration: number,
    cps = 1,
    targetTime?: number,
  ): void => {
    const value = (hap as { value?: SoundParams }).value ?? (hap as SoundParams);
    const when = targetTime ?? now() + deadline;
    try {
      void Promise.resolve(sdAny.superdough(value, when, duration, cps)).catch((err) =>
        opts.onError?.(err),
      );
    } catch (err) {
      opts.onError?.(err);
    }
    if (listeners.size > 0) {
      const event: EngineEvent = { value, timeSec: when, durationSec: duration, cps };
      for (const listener of listeners) listener(event);
    }
  };

  // Master-output analyser tap for visualizers. Reuses one AnalyserNode and
  // (re)connects it if superdough rebuilds its output (reset).
  let analyser: AnalyserNode | undefined;
  let tappedMaster: AudioNode | undefined;
  const getAnalyser = (): AnalyserNode | undefined => {
    try {
      const master = sdAny.getSuperdoughAudioController?.()?.output?.destinationGain;
      if (!master) return analyser;
      if (!analyser) {
        analyser = (ctx as unknown as { createAnalyser(): AnalyserNode }).createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.7;
      }
      if (tappedMaster !== master) {
        master.connect(analyser as unknown as AudioNode);
        tappedMaster = master;
      }
      return analyser;
    } catch {
      return analyser;
    }
  };

  const repl = (core as unknown as { repl: (cfg: Record<string, unknown>) => StrudelRepl }).repl({
    defaultOutput: trigger,
    getTime: now,
    transpiler,
    onEvalError: (err: unknown) => opts.onError?.(err),
    onUpdateState: (state: ReplState) => opts.onUpdate?.(state),
  });

  return {
    evaluate: (code, autostart) => repl.evaluate(code, autostart),
    start: () => repl.start(),
    stop: () => repl.stop(),
    toggle: () => repl.toggle(),
    setCps: (cps) => repl.setCps(cps),
    now,
    isReady: () => true,
    hasWorklets: () => workletsEnabled,
    getContext: () => ctx,
    onEvent: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getAnalyser,
    getPattern: () =>
      repl.state.pattern ?? (repl.scheduler as unknown as { pattern?: unknown }).pattern,
    nowCycles: () => {
      try {
        const n = repl.scheduler.now();
        return Number.isFinite(n) ? n : 0;
      } catch {
        return 0;
      }
    },
    loadSamples: (map, baseUrl) => sdAny.samples(map, baseUrl),
    resetEffects: () => sdAny.resetGlobalEffects?.(),
    close: async () => {
      await ctx.close().catch(() => undefined);
    },
    get scheduler() {
      return repl.scheduler;
    },
    get state() {
      return repl.state;
    },
  };
}
