/**
 * lyra entry point — render the Ink TUI.
 *
 * Run via `npm run dev` / `npm start`, which launch through scripts/run.mjs so
 * the process uses PipeWire's JACK backend (clean, low-latency audio) when
 * available.
 */
import './silence.js'; // must be first: patches console before noisy imports load
import React from 'react';
import { render } from 'ink';
import { App } from './tui/App.js';

// Use the terminal's alternate screen buffer (like vim/htop) so a full-height
// layout fills the screen cleanly instead of overflowing the scrollback.
const ALT_ENTER = '\x1b[?1049h';
const ALT_LEAVE = '\x1b[?1049l';

let restored = false;
const restore = (): void => {
  if (restored) return;
  restored = true;
  process.stdout.write(ALT_LEAVE);
};

process.stdout.write(ALT_ENTER);
process.on('exit', restore);

const { waitUntilExit } = render(<App />);
await waitUntilExit();
restore();
