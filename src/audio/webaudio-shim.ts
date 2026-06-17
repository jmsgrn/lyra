/**
 * Web Audio API shim for headless Node.
 *
 * Libraries like `superdough` are written against the browser's global Web
 * Audio API (`new AudioContext()`, `new GainNode()`, `new AudioWorkletNode()`,
 * ...). `node-web-audio-api` provides a spec-compliant Rust implementation of
 * those same classes, but as module exports rather than globals. This module
 * installs them onto `globalThis` so that browser-targeted audio code "just
 * works" under Node.
 *
 * Import this module for its side effects BEFORE importing `superdough`:
 *   import './audio/webaudio-shim.js';
 */
import * as nwa from 'node-web-audio-api';

const globals = globalThis as unknown as Record<string, unknown>;

// `default` is the namespace re-export; everything else is a Web Audio class
// (AudioContext, GainNode, OscillatorNode, AudioWorkletNode, ...) or helper
// object (mediaDevices). Install any that aren't already present.
for (const [name, value] of Object.entries(nwa)) {
  if (name === 'default') continue;
  if (globals[name] === undefined) {
    globals[name] = value;
  }
}

/**
 * Make `start()` / `stop()` on scheduled source nodes idempotent.
 *
 * Browsers tolerate redundant `stop()` (and silently no-op a `start()` on an
 * already-finished node); node-web-audio-api throws instead. superdough's
 * `releaseAudioNode` cleanup relies on the browser behaviour — when a source
 * node ends and its `onended` handler calls `stop()`, the throw triggers a
 * `catch` that calls `start()` again ("Cannot call start twice"), and because
 * this runs inside an event callback the exception crashes the process.
 *
 * Wrapping the prototypes to swallow these benign races restores browser
 * semantics for any browser-targeted audio code, not just superdough.
 */
const PATCHED = Symbol.for('lyra.idempotentSourceNode');
function makeSourceNodeIdempotent(ctor: unknown): void {
  const proto = (ctor as { prototype?: Record<string | symbol, unknown> } | undefined)?.prototype;
  if (!proto || proto[PATCHED]) return;
  for (const method of ['start', 'stop'] as const) {
    const original = proto[method];
    if (typeof original !== 'function') continue;
    proto[method] = function patched(this: unknown, ...args: unknown[]): unknown {
      try {
        return (original as (...a: unknown[]) => unknown).apply(this, args);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/start twice|already|stop|invalidstate/i.test(message)) return undefined;
        throw err;
      }
    };
  }
  proto[PATCHED] = true;
}
for (const ctor of [
  nwa.AudioScheduledSourceNode,
  nwa.OscillatorNode,
  nwa.AudioBufferSourceNode,
  nwa.ConstantSourceNode,
]) {
  makeSourceNodeIdempotent(ctor);
}

export const { AudioContext, OfflineAudioContext } = nwa;
export type NodeAudioContext = InstanceType<typeof nwa.AudioContext>;
