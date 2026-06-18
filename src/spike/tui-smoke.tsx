/**
 * Headless render smoke test for the TUI. Mounts <App/> with
 * ink-testing-library (no TTY / raw mode needed), asserts the chrome renders,
 * and exits. Catches render-time/JSX/Ink-API errors that a typecheck won't.
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../tui/App.js';

const { lastFrame, unmount } = render(<App />);
await new Promise((r) => setTimeout(r, 200));
const frame = lastFrame() ?? '';

console.log('--- rendered frame ---');
console.log(frame);
console.log('----------------------');

const checks: Record<string, boolean> = {
  header: frame.includes('lyra') && frame.includes('v0.0.0'),
  transport: frame.includes('stopped') || frame.includes('playing'),
  clock: frame.includes('cps') && frame.includes('bpm') && frame.includes('cycle'),
  gutter: frame.includes(' 1 '),
  defaultCode: frame.includes('sawtooth'),
  commandBar: frame.includes('❯') && frame.includes('Tab for commands'),
  hints: frame.includes('eval') && frame.includes('play/stop') && frame.includes('command'),
};
console.log('checks:', JSON.stringify(checks));

unmount();
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'TUI smoke PASS' : 'TUI smoke FAIL');
process.exit(ok ? 0 : 1);
