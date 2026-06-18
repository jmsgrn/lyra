/**
 * lyra entry point — render the Ink TUI.
 *
 * Run via `npm run dev` / `npm start`, which launch through scripts/run.mjs so
 * the process uses PipeWire's JACK backend (clean, low-latency audio) when
 * available.
 */
import './silence.js'; // must be first: patches console before noisy imports load
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render } from 'ink';
import { App } from './tui/App.js';

// `lyra [file]` opens that file in the editor (a missing path = a new file).
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('-'));
let filePath: string | undefined;
let initialCode: string | undefined;
if (fileArg) {
  filePath = resolve(fileArg);
  initialCode = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

// Use the terminal's alternate screen buffer (like vim/htop) so a full-height
// layout fills the screen cleanly instead of overflowing the scrollback.
// Enter clears + homes so every launch starts from a clean slate (otherwise a
// re-launch can paint into a stale alt screen and the first frame is missing).
const ALT_ENTER = '\x1b[?1049h\x1b[2J\x1b[H'; // alt screen, clear, cursor home
const ALT_LEAVE = '\x1b[?1049l\x1b[?25h'; // normal screen, restore cursor

let restored = false;
const restore = (): void => {
  if (restored) return;
  restored = true;
  process.stdout.write(ALT_LEAVE);
};

process.stdout.write(ALT_ENTER);
process.on('exit', restore);
process.on('SIGTERM', () => {
  restore();
  process.exit(0);
});

const { waitUntilExit } = render(<App filePath={filePath} initialCode={initialCode} />);
await waitUntilExit();
restore();
// node-web-audio-api keeps a native audio thread alive, so the event loop
// won't drain on its own — force a clean exit so the shell prompt returns
// immediately (the unmount already triggered engine teardown).
process.exit(0);
