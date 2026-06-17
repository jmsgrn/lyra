/**
 * Run a command under `pw-jack` when it's available so node-web-audio-api
 * connects to PipeWire's JACK backend (clean, low-latency, no ALSA fallback
 * noise). Falls back to running the command directly otherwise.
 *
 * Usable two ways:
 *   - CLI:    node scripts/run.mjs tsx watch src/main.tsx
 *   - import: import { run } from './run.mjs'; run(['tsx', 'src/main.tsx'])
 */
import { spawnSync, execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function hasPwJack() {
  try {
    execSync('command -v pw-jack', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run `[command, ...args]`, prefixed with pw-jack when available.
 * Inherits stdio by default so interactive TUIs keep their TTY.
 */
export function run(target, opts = {}) {
  if (!Array.isArray(target) || target.length === 0) {
    throw new Error('run() requires a non-empty [command, ...args] array');
  }
  const [cmd, ...rest] = hasPwJack() ? ['pw-jack', ...target] : target;
  return spawnSync(cmd, rest, { stdio: 'inherit', ...opts });
}

// CLI entry: node scripts/run.mjs <command> [args...]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv.slice(2);
  if (target.length === 0) {
    console.error('usage: node scripts/run.mjs <command> [args...]');
    process.exit(2);
  }
  process.exit(run(target).status ?? 1);
}
