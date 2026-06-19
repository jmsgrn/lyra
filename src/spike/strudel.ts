/**
 * Spike C — prove the full product loop end to end:
 *   Strudel mini-notation source -> Pattern -> queried haps -> superdough audio.
 *
 * This is the actual runtime loop the app will use (minus the live editor and a
 * proper look-ahead clock). If this makes a coherent musical phrase, the
 * architecture is validated.
 */
import { AudioContext } from '../audio/webaudio-shim.js';
import * as sd from 'superdough';
import { note, stack } from '@strudel/core';
import { mini } from '@strudel/mini';

// --- audio engine bring-up (same as spike B) ---
const ctx = new AudioContext({ latencyHint: 'playback' });
const inject = sd as unknown as Record<string, (c: unknown) => void>;
inject.setAudioContext?.(ctx);
inject.setDefaultAudioContext?.(ctx);
await sd.initAudio();
sd.registerSynthSounds();
console.log(`[strudel] engine ready, ctx state=${ctx.state}`);

// --- build a pattern with Strudel's real API ---
// a bass arp + a chord stab layered together
const pattern = stack(
  note(mini('c2 c2 g2 c3')).s('sawtooth').gain(0.55),
  note(mini('[c3,e3,g3] ~ [f3,a3,c4] ~')).s('triangle').gain(0.4),
);

// --- query haps and inspect structure ---
type Frac = { valueOf(): number };
type Hap = {
  whole?: { begin: Frac; end: Frac };
  part: { begin: Frac; end: Frac };
  value: Record<string, unknown>;
  hasOnset?: () => boolean;
};

const cycles = 2;
const haps = (pattern.queryArc(0, cycles) as Hap[]).filter(
  (h) => h.hasOnset?.() ?? h.whole != null,
);
console.log(`[strudel] queried ${haps.length} onset haps over ${cycles} cycles. sample:`);
for (const h of haps.slice(0, 4)) {
  console.log('   ', JSON.stringify(h.value), `@${h.whole!.begin.valueOf().toFixed(3)}`);
}

// --- schedule haps into superdough ---
const cps = 1; // cycles per second
const cycleDur = 1 / cps;
const base = ctx.currentTime + 0.2;
let scheduled = 0;
for (const h of haps) {
  const span = h.whole ?? h.part;
  const begin = span.begin.valueOf();
  const end = span.end.valueOf();
  const when = base + begin * cycleDur;
  const dur = (end - begin) * cycleDur;
  (sd.superdough as (v: unknown, t: number, d: number) => unknown)(h.value, when, dur);
  scheduled++;
}
console.log(`[strudel] scheduled ${scheduled} events`);

await new Promise((r) => setTimeout(r, cycles * cycleDur * 1000 + 600));
await ctx.close();
console.log('Spike C complete: Strudel pattern -> superdough pipeline works.');
process.exit(0); // node-web-audio-api keeps the audio thread alive; force exit
