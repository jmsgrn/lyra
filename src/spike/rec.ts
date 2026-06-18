/**
 * Spike F — prove the recording pipeline: mic -> capture -> WAV -> register ->
 * play back via s("..."). Needs a working mic; if getUserMedia is unavailable
 * (e.g. a headless sandbox) it exits gracefully.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRepl } from '../strudel/repl.js';
import { closeEngine, loadSamples } from '../audio/engine.js';
import { encodeWav } from '../audio/wav.js';
import * as recorder from '../audio/recorder.js';

const repl = await createRepl({
  onError: (err) => console.error('[repl] eval error:', err instanceof Error ? err.message : err),
});

console.log('[rec] recording ~1.5s from the mic (make some noise)...');
try {
  await recorder.startRecording();
} catch (err) {
  console.log('[rec] mic unavailable here:', (err as Error).message, '(expected in a headless env)');
  await closeEngine();
  process.exit(0);
}

await new Promise((r) => setTimeout(r, 1500));
const rec = recorder.stopRecording();
if (!rec) {
  console.log('[rec] no audio captured');
  await closeEngine();
  process.exit(0);
}
console.log(`[rec] captured ${rec.durationSeconds.toFixed(2)}s @ ${rec.sampleRate}Hz`);

const dir = join(tmpdir(), 'lyra-rec');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'rectest.wav'), encodeWav(rec.channels, rec.sampleRate));
await loadSamples({ rectest: ['rectest.wav'] }, pathToFileURL(join(dir, '/')).href);
console.log('[rec] saved + registered; playing back s("rectest rectest")');

await repl.evaluate('s("rectest rectest")');
repl.setCps(1);
repl.start();
await new Promise((r) => setTimeout(r, 2500));
repl.stop();
await closeEngine();
console.log('Spike F complete: record -> save -> register -> playback works.');
