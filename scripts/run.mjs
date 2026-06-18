/**
 * Run a command under `pw-jack` when it's available so node-web-audio-api
 * connects to PipeWire's JACK backend (clean, low-latency, no ALSA fallback
 * noise). Falls back to running the command directly otherwise.
 *
 * Also pins PIPEWIRE_LATENCY (the buffer quantum) so PipeWire doesn't run the
 * graph at a tiny buffer, which causes crackly/crunchy audio. Order: existing
 * env > settings.json (audio.pipewireLatency) > default.
 *
 * Usable two ways:
 *   - CLI:    node scripts/run.mjs tsx watch src/main.tsx
 *   - import: import { run } from './run.mjs'; run(['tsx', 'src/main.tsx'])
 */
import { spawnSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PIPEWIRE_LATENCY = '1024/48000';

export function hasPwJack() {
  try {
    execSync('command -v pw-jack', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function pipewireLatency() {
  if (process.env.PIPEWIRE_LATENCY) return process.env.PIPEWIRE_LATENCY;
  try {
    const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
    const settings = JSON.parse(readFileSync(join(configHome, 'lyra', 'settings.json'), 'utf8'));
    const value = settings?.audio?.pipewireLatency;
    if (typeof value === 'string') return value; // "" = leave to the system
  } catch {
    /* no/invalid settings file — use default */
  }
  return DEFAULT_PIPEWIRE_LATENCY;
}

/**
 * Run `[command, ...args]`, prefixed with pw-jack when available.
 * Inherits stdio by default so interactive TUIs keep their TTY.
 */
export function run(target, opts = {}) {
  if (!Array.isArray(target) || target.length === 0) {
    throw new Error('run() requires a non-empty [command, ...args] array');
  }
  const latency = pipewireLatency();
  const env = latency ? { ...process.env, PIPEWIRE_LATENCY: latency } : { ...process.env };
  const [cmd, ...rest] = hasPwJack() ? ['pw-jack', ...target] : target;
  return spawnSync(cmd, rest, { stdio: 'inherit', env, ...opts });
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
