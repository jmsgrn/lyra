/**
 * Spike B — prove superdough (Strudel's synth/sampler/FX engine) runs headless.
 *
 * Strategy:
 *  - Inject a node-web-audio-api AudioContext created with latencyHint
 *    'playback' (the only mode that opens the device on PipeWire/ALSA here).
 *  - initAudio(), trying worklets first; fall back to disableWorklets if the
 *    data:-URL worklet modules can't be loaded under Node.
 *  - registerSynthSounds(), then trigger a little arpeggio of the built-in
 *    oscillator instruments + a noise burst.
 */
import { AudioContext } from '../audio/webaudio-shim.js';
import * as sd from 'superdough';

const ctx = new AudioContext({ latencyHint: 'playback' });
console.log(`[superdough] injected ctx state=${ctx.state} sampleRate=${ctx.sampleRate}`);

// Make superdough use our context rather than lazily constructing its own
// (which would omit the latencyHint and fail to open the device).
const inject = sd as unknown as Record<string, (c: unknown) => void>;
inject.setAudioContext?.(ctx);
inject.setDefaultAudioContext?.(ctx);

let workletsEnabled = true;
try {
  await sd.initAudio();
  console.log('[superdough] initAudio() OK (worklets enabled)');
} catch (err) {
  workletsEnabled = false;
  console.warn('[superdough] initAudio() with worklets failed:', (err as Error).message);
  await sd.initAudio({ disableWorklets: true } as Parameters<typeof sd.initAudio>[0]);
  console.log('[superdough] initAudio({ disableWorklets: true }) OK');
}

sd.registerSynthSounds();
console.log('[superdough] registered synth sounds');

const t0 = ctx.currentTime + 0.15;
type Hit = { at: number; value: Record<string, unknown>; dur: number };
const sequence: Hit[] = [
  { at: 0.0, value: { s: 'sawtooth', note: 'c3', gain: 0.8, cutoff: 1200 }, dur: 0.35 },
  { at: 0.4, value: { s: 'square', note: 'e3', gain: 0.6, cutoff: 1500 }, dur: 0.35 },
  { at: 0.8, value: { s: 'triangle', note: 'g3', gain: 0.7 }, dur: 0.35 },
  { at: 1.2, value: { s: 'sine', note: 'c4', gain: 0.7 }, dur: 0.6 },
  { at: 1.2, value: { s: 'white', gain: 0.4 }, dur: 0.08 },
];

let triggered = 0;
for (const hit of sequence) {
  try {
    // superdough(value, deadlineSeconds, durationSeconds)
    (sd.superdough as (v: unknown, t: number, d: number) => unknown)(hit.value, t0 + hit.at, hit.dur);
    triggered++;
  } catch (err) {
    console.error(`[superdough] trigger failed for ${JSON.stringify(hit.value)}:`, (err as Error).message);
  }
}
console.log(`[superdough] scheduled ${triggered}/${sequence.length} events`);

// let realtime playback run, then shut down
await new Promise((r) => setTimeout(r, 2500));
await ctx.close();
console.log(
  `Spike B complete: superdough initialized (worklets=${workletsEnabled}) and triggered events on node-web-audio-api.`,
);
