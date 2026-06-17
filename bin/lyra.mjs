#!/usr/bin/env node
/**
 * `lyra` launcher — start the TUI from source, under pw-jack when available.
 *
 * Installed on PATH as a symlink (e.g. ~/.local/bin/lyra -> this file). Node
 * follows the symlink to this real path, so the project root and the local tsx
 * binary are always resolved relative to the repo regardless of where `lyra`
 * is invoked from.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../scripts/run.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(
    [
      'lyra — local TUI live-coding music environment',
      '',
      'usage: lyra',
      '',
      '  Ctrl+E      evaluate / update     Ctrl+Space  play / stop',
      '  Ctrl+Q      quit                  arrows      move cursor',
    ].join('\n'),
  );
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  console.log(`lyra ${pkg.version}`);
  process.exit(0);
}

const tsx = join(root, 'node_modules', '.bin', 'tsx');
const entry = join(root, 'src', 'main.tsx');
process.exit(run([tsx, entry, ...args], { cwd: root }).status ?? 1);
