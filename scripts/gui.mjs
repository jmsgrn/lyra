/**
 * lyra desktop launcher (dev): boot the Vite renderer dev server, then launch
 * Electron pointed at it. The renderer uses Chromium's native audio, so there's
 * no pw-jack / PIPEWIRE_LATENCY wrangling here (that's the headless node path).
 *
 *   node scripts/gui.mjs [file]   # open [file] in the editor
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import electronPath from 'electron';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptsDir, '..');
const rendererDir = join(repoRoot, 'src', 'renderer');
const autotest = process.argv.includes('--autotest');
const fileArgs = process.argv.slice(2).filter((a) => a !== '--autotest');

const server = await createServer({ configFile: join(rendererDir, 'vite.config.ts') });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5190/';
console.log(`[lyra] renderer dev server: ${url}`);

const env = { ...process.env, LYRA_RENDERER_URL: url };
if (autotest) env.LYRA_AUTOTEST = '1';

const child = spawn(electronPath, [join(repoRoot, 'src', 'main', 'main.cjs'), ...fileArgs], {
  stdio: autotest ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  env,
});

let verdict = 'UNKNOWN';
if (autotest) {
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    const m = text.match(/SPIKE_RESULT=(PASS|FAIL)/);
    if (m) verdict = m[1];
  });
}

child.on('exit', async (code) => {
  await server.close();
  if (autotest) {
    console.log(`[lyra] verdict: ${verdict}`);
    process.exit(verdict === 'PASS' ? 0 : 1);
  }
  process.exit(code ?? 0);
});
