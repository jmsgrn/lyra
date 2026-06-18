/**
 * Browser/Electron-renderer platform binding for the Lyra engine.
 *
 * The mirror image of platform/node.ts: instead of installing Web Audio shims
 * and a node-web-audio-api context, it uses the renderer's NATIVE AudioContext
 * and hands it to the same platform-agnostic core. No shims, no fetch patch,
 * no latencyHint workaround — Chromium is the host superdough was written for.
 *
 * The context starts suspended (browser autoplay policy); call `resume()` from
 * a user gesture (the first eval / Play) before expecting sound.
 */
import { createEngine, type Engine } from '../core/engine.js';
import type { ReplState } from '../core/types.js';

export interface BrowserEngineOptions {
  worklets?: boolean;
  onError?: (error: unknown) => void;
  onUpdate?: (state: ReplState) => void;
}

export interface BrowserEngine extends Engine {
  /** Resume the AudioContext (needs a user gesture the first time). */
  resume(): Promise<void>;
}

export async function createBrowserEngine(opts: BrowserEngineOptions = {}): Promise<BrowserEngine> {
  const context = new AudioContext();
  const engine = await createEngine({
    context,
    worklets: opts.worklets ?? true,
    onError: opts.onError,
    onUpdate: opts.onUpdate,
  });
  return Object.assign(engine, {
    resume: () => context.resume(),
  });
}
