/**
 * lyra entry point — render the Ink TUI.
 *
 * Run via `npm run dev` / `npm start`, which launch through scripts/run.mjs so
 * the process uses PipeWire's JACK backend (clean, low-latency audio) when
 * available.
 */
import React from 'react';
import { render } from 'ink';
import { App } from './tui/App.js';

const { waitUntilExit } = render(<App />);
await waitUntilExit();
