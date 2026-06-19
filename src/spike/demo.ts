/**
 * Spike: validate a candidate default demo pattern actually evaluates in our
 * scope (functions like .bank/.lpf/.room exist) and produces haps.
 */
import { createNodeEngine, closeNodeEngine } from '../platform/node.js';

const CANDIDATES: Record<string, string> = {
  drums: `s("bd*2, ~ sd, hh*8").bank("RolandTR909").gain(0.9)`,
  effects: `note("c2 eb2 g2").s("sawtooth").lpf(800).room(0.4).delay(0.3).release(0.12)`,
  piano: `note("<[c4,eb4,g4] [bb3,d4,f4]>").s("piano").slow(2).gain(0.5)`,
  full: `stack(
  s("bd*2, ~ sd, hh*8").bank("RolandTR909").gain(0.9),
  s("~ cp").bank("RolandTR808").room(0.3).gain(0.6),
  note("c2 [eb2 g2] c2 <g1 bb1>").s("sawtooth").lpf(800).gain(0.55).release(0.12),
  note("<[c4,eb4,g4] [bb3,d4,f4]>").s("piano").slow(2).gain(0.5).room(0.4)
)`,
  FINAL: `stack(
  s("bd*2, ~ sd, hh*8").bank("RolandTR909").gain(0.9),
  s("~ cp, oh(3,8)").bank("RolandTR808").gain(0.45).room(0.3),
  note("c2 [eb2 g2] c2 <g1 bb1>").s("sawtooth").lpf(sine.range(400, 1400).slow(8)).gain(0.55).release(0.12),
  note("<[c4,eb4,g4] [bb3,d4,f4] [ab3,c4,eb4] [g3,bb3,d4]>").s("piano").slow(2).gain(0.5).room(0.5).delay(0.25)
)`,
};

const repl = await createNodeEngine({});

for (const [name, code] of Object.entries(CANDIDATES)) {
  try {
    await repl.evaluate(code);
    const pat = (repl.state.pattern ??
      (repl.scheduler as unknown as { pattern?: unknown }).pattern) as
      | { queryArc(a: number, b: number): unknown[] }
      | undefined;
    const haps = pat?.queryArc(0, 1) ?? [];
    console.log(`OK   ${name}: ${haps.length} haps`);
  } catch (err) {
    console.log(`FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

await closeNodeEngine();
process.exit(0);
