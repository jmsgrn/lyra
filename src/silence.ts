/**
 * Silence library console noise so it can't corrupt the TUI.
 *
 * Must be imported FIRST in the entry point, before any module that logs at
 * import time — @strudel/core prints a "🌀 @strudel/core loaded 🌀" banner,
 * @kabelsalat/web warns "cannot use window", and Strudel's scheduler logs
 * "[cyclist] start" etc. on its own. All of these go through console.* and
 * would scribble over the Ink render.
 *
 * Set LYRA_LOG=<path> to capture the suppressed output to a file for debugging.
 */
import { appendFileSync } from 'node:fs';

const logPath = process.env.LYRA_LOG;

const sink =
  (level: string) =>
  (...args: unknown[]): void => {
    if (!logPath) return;
    try {
      appendFileSync(logPath, `[${level}] ${args.map((a) => String(a)).join(' ')}\n`);
    } catch {
      /* never let logging break the app */
    }
  };

console.log = sink('log');
console.info = sink('info');
console.debug = sink('debug');
console.warn = sink('warn');
console.error = sink('error');
