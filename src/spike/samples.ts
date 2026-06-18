/**
 * Spike E — prove local sample loading + playback:
 * generate a local sample pack -> loadSamples(file:// baseUrl) -> s("...") via
 * the repl -> superdough fetches/decodes the local files on trigger.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createNodeEngine, loadSamples, closeNodeEngine } from '../platform/node.js';
import { encodeWav, sineChannel } from '../audio/wav.js';

// --- generate a tiny local sample pack ---
const dir = join(tmpdir(), 'lyra-spike-samples');
mkdirSync(dir, { recursive: true });
const sr = 44100;
writeFileSync(join(dir, 'bleep.wav'), encodeWav([sineChannel(880, 0.18, sr)], sr));
writeFileSync(join(dir, 'boop.wav'), encodeWav([sineChannel(330, 0.28, sr)], sr));
const baseUrl = pathToFileURL(join(dir, '/')).href; // file:///.../lyra-spike-samples/
console.log('[samples] pack at', baseUrl);

// --- bring up the repl and register the local pack ---
const repl = await createNodeEngine({
  onError: (err) => console.error('[repl] eval error:', err instanceof Error ? err.message : err),
});
await loadSamples({ bleep: ['bleep.wav'], boop: ['boop.wav'] }, baseUrl);
console.log('[samples] registered: bleep, boop');

// --- play a pattern using the local samples ---
await repl.evaluate('s("bleep boop bleep [boop boop]")');
repl.setCps(1);
repl.start();
console.log('[samples] playing s("bleep boop ...") for ~4s');

await new Promise((r) => setTimeout(r, 4000));
repl.stop();
await closeNodeEngine();
console.log('Spike E complete: local sample loading + playback works.');
