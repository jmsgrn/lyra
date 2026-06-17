/**
 * Strudel live-coding harness.
 *
 * Wires Strudel's own `repl()` (which owns the look-ahead Cyclist scheduler and
 * the transpile→eval loop) to our superdough-backed audio engine. The result is
 * the core of the app: evaluate user source, hot-swap the running pattern, and
 * drive the transport.
 */
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import { transpiler } from '@strudel/transpiler';
import { initEngine, now, trigger } from '../audio/engine.js';

/** Mirror of Strudel's internal repl state we care about for the UI. */
export interface ReplState {
  code?: string;
  activeCode?: string;
  started?: boolean;
  pending?: boolean;
  isDirty?: boolean;
  error?: unknown;
  evalError?: unknown;
  schedulerError?: unknown;
  pattern?: unknown;
  [key: string]: unknown;
}

export interface LyraRepl {
  /** Transpile + evaluate user code and hot-swap the running pattern. */
  evaluate(code: string, autostart?: boolean): Promise<unknown>;
  start(): void;
  stop(): void;
  toggle(): void;
  /** Set tempo in cycles per second. */
  setCps(cps: number): void;
  scheduler: { now(): number; setCps(cps: number): void; [k: string]: unknown };
  state: ReplState;
}

export interface CreateReplOptions {
  onError?: (error: unknown) => void;
  onUpdate?: (state: ReplState) => void;
  latencyHint?: 'interactive' | 'playback' | 'balanced' | number;
}

let scopeReady = false;

/** Register all Strudel pattern functions/controls into the eval scope (once). */
async function ensureScope(): Promise<void> {
  if (scopeReady) return;
  await core.evalScope(core, mini);
  // Make bare double-quoted strings parse as mini-notation even outside the
  // transpiler path (e.g. note("c2 e2 g2")).
  (core as unknown as { setStringParser: (p: unknown) => void }).setStringParser(mini.mini);
  scopeReady = true;
}

export async function createRepl(options: CreateReplOptions = {}): Promise<LyraRepl> {
  await initEngine({ latencyHint: options.latencyHint });
  await ensureScope();

  const repl = (core as unknown as { repl: (cfg: Record<string, unknown>) => LyraRepl }).repl({
    defaultOutput: trigger,
    getTime: now,
    transpiler,
    onEvalError: (err: unknown) => options.onError?.(err),
    onUpdateState: (state: ReplState) => options.onUpdate?.(state),
  });

  return repl;
}
