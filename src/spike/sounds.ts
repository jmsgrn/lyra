/**
 * Spike: do Strudel's default sample sources actually fetch + register sounds?
 * (Same superdough.samples() path the desktop app uses.)
 */
import { createNodeEngine, closeNodeEngine } from '../platform/node.js';
import { soundMap } from 'superdough';

const repl = await createNodeEngine({});
const before = Object.keys(soundMap.get()).length;
console.log('registered sounds before:', before);

const url = 'https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json';
console.log('loading', url);
await repl.loadSamples(url);

const names = Object.keys(soundMap.get());
console.log(`registered sounds after: ${names.length} (+${names.length - before})`);
console.log('drum-ish names:', names.filter((n) => /tr8|tr9|roland|^bd|^sd|^hh/i.test(n)).slice(0, 12));

await closeNodeEngine();
process.exit(0);
