/**
 * Spike: validate each inline-visual method registers a painter without
 * throwing. Pass a dummy `ctx` so the draw methods skip getDrawContext() (which
 * needs a browser); the custom ._scope() needs no ctx.
 */
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import '../renderer/inlineViz.js';

await (core as unknown as { evalScope: (...m: unknown[]) => Promise<void> }).evalScope(core, mini);

const base = (core as unknown as { note: (s: string) => any }).note('c3 e3 g3 b3').s('piano');

for (const m of ['_pianoroll', '_punchcard', '_spiral', '_wordfall', '_pitchwheel', '_scope']) {
  try {
    const opts = m === '_scope' ? {} : { ctx: {} };
    const p = base[m](opts);
    const painters = p.getPainters();
    console.log(`${m}: OK painters=${painters.length}`);
  } catch (e) {
    console.log(`${m}: FAIL ${e instanceof Error ? e.message : String(e)}`);
  }
}

process.exit(0);
