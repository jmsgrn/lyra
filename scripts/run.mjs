/**
 * Launcher: run the given command under `pw-jack` when it's available so
 * node-web-audio-api connects to PipeWire's JACK backend (clean, low-latency,
 * no ALSA fallback noise). Falls back to running the command directly on
 * systems without pipewire-jack.
 *
 *   node scripts/run.mjs tsx watch src/main.tsx
 */
import { spawnSync, execSync } from 'node:child_process';

const target = process.argv.slice(2);
if (target.length === 0) {
  console.error('usage: node scripts/run.mjs <command> [args...]');
  process.exit(2);
}

let hasPwJack = false;
try {
  execSync('command -v pw-jack', { stdio: 'ignore' });
  hasPwJack = true;
} catch {
  hasPwJack = false;
}

const [cmd, ...rest] = hasPwJack ? ['pw-jack', ...target] : target;
const result = spawnSync(cmd, rest, { stdio: 'inherit' });
process.exit(result.status ?? 1);
