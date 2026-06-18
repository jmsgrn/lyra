/**
 * Phase-0 spike launcher.
 *
 * Boots a Vite dev server for the renderer, then launches Electron pointed at
 * it. `--autotest` runs the renderer's automated self-test and exits with the
 * verdict (0 = PASS) so the spike is CI/terminal-checkable; without it, the
 * window stays open for interactive listening/playing.
 *
 *   node spike/electron/run.mjs            # interactive window
 *   node spike/electron/run.mjs --autotest # headless-ish self-test + verdict
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import electronPath from 'electron';

const here = dirname(fileURLToPath(import.meta.url));
const autotest = process.argv.includes('--autotest');

const server = await createServer({ configFile: join(here, 'vite.config.ts') });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5180/';
console.log(`[spike] vite dev server: ${url}`);

const target = url.replace(/\/$/, '') + (autotest ? '/?autotest=1' : '/');
let verdict = 'UNKNOWN';

const child = spawn(electronPath, [join(here, 'main.cjs'), target], {
  stdio: ['inherit', 'pipe', 'inherit'],
  env: process.env,
});

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const m = text.match(/SPIKE_RESULT=(PASS|FAIL)/);
  if (m) verdict = m[1];
});

child.on('exit', async (code) => {
  await server.close();
  if (autotest) {
    console.log(`[spike] verdict: ${verdict}`);
    process.exit(verdict === 'PASS' ? 0 : 1);
  }
  process.exit(code ?? 0);
});
