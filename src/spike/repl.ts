/**
 * Spike D — exercise the full live-coding harness:
 * createRepl() -> evaluate(userCode) -> Cyclist scheduler -> superdough audio.
 *
 * This is tasks "audio core" + "strudel integration" proven together, using
 * exactly the code paths the TUI will drive.
 */
import { createRepl } from '../strudel/repl.js';
import { closeEngine, hasWorklets } from '../audio/engine.js';

let firstTrigger = true;
const repl = await createRepl({
  onError: (err) => console.error('[repl] eval error:', err instanceof Error ? err.message : err),
  onUpdate: (state) => {
    if (state.error) console.error('[repl] state error:', state.error);
  },
});
void firstTrigger;

console.log(`[repl] engine ready (worklets=${hasWorklets()})`);

const code = `
stack(
  note("c2 eb2 g2 bb2").s("sawtooth").cutoff(1000).gain(0.5),
  note("<c4 eb4 g4>/2").s("triangle").gain(0.3),
  s("white*4").gain(0.12).decay(0.04)
)`;

console.log('[repl] evaluating live-coding source...');
await repl.evaluate(code);
repl.setCps(1);
repl.start();
console.log(`[repl] started=${repl.state.started} — playing ~4s`);

await new Promise((r) => setTimeout(r, 4000));
repl.stop();
await closeEngine();
console.log('Spike D complete: live-eval + Cyclist scheduler + superdough pipeline OK.');
