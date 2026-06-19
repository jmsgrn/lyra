/**
 * Inline (Strudel-style) visuals: pattern methods like `.pianoroll()`,
 * `.punchcard()`, `.spiral()` and `.scope()` that draw behind the editor.
 *
 * Importing @strudel/draw adds pianoroll/punchcard/spiral/onPaint/getPainters
 * to the Pattern prototype. The painters draw to the `#test-canvas` element
 * (getDrawContext's default), which we place behind the editor; a loop in
 * useVisuals calls `pattern.getPainters()` each frame. We additionally register
 * `_`-prefixed aliases (the form Strudel users reach for) and a custom
 * `.scope()` (an analyser oscilloscope — @strudel/draw doesn't ship one).
 */
import '@strudel/draw';
import { drawPianoroll } from '@strudel/draw';
import * as core from '@strudel/core';

type Painter = (ctx: CanvasRenderingContext2D, time: number, haps: unknown[], drawTime: number[]) => void;
interface PatternProto {
  pianoroll?: (...a: unknown[]) => unknown;
  punchcard?: (...a: unknown[]) => unknown;
  spiral?: (...a: unknown[]) => unknown;
  scope?: (...a: unknown[]) => unknown;
  onPaint?: (fn: Painter) => unknown;
  [k: string]: unknown;
}

// analyser for the custom scope painter (set by the engine when audio is up)
let analyser: AnalyserNode | undefined;
export function setInlineAnalyser(a: AnalyserNode | undefined): void {
  analyser = a;
}

const silence = (core as unknown as { silence?: unknown }).silence;
const proto = (silence ? Object.getPrototypeOf(silence) : undefined) as PatternProto | undefined;

if (proto && typeof proto.onPaint === 'function') {
  // pianoroll's built-in method uses .draw() (a self-animating loop we don't
  // drive); redefine it as an onPaint painter (via the exported drawPianoroll)
  // so getPainters() catches it and our useVisuals loop renders it — consistent
  // with punchcard/spiral/etc.
  const pianoroll = function (this: { onPaint: (fn: Painter) => unknown }, opts: Record<string, unknown> = {}): unknown {
    return this.onPaint((ctx, time, haps, drawTime) =>
      drawPianoroll({ ctx, time, haps, drawTime, cycles: 4, playhead: 0.5, ...opts }),
    );
  };
  proto.pianoroll = pianoroll as unknown as PatternProto['pianoroll'];
  proto._pianoroll = pianoroll as unknown as PatternProto['pianoroll'];

  // underscore aliases for the remaining (already onPaint-based) draw methods
  for (const name of ['punchcard', 'spiral', 'wordfall', 'pitchwheel']) {
    const alias = `_${name}`;
    if (typeof proto[name] === 'function' && !proto[alias]) proto[alias] = proto[name];
  }

  // custom oscilloscope (master analyser) — registered as .scope()/._scope()
  if (!proto.scope) {
    const scope = function (this: { onPaint: (fn: Painter) => unknown }, opts: { color?: string } = {}): unknown {
      return this.onPaint((ctx) => drawScope(ctx, opts));
    };
    proto.scope = scope as unknown as PatternProto['scope'];
    proto._scope = scope as unknown as PatternProto['scope'];
  }
}

let scopeBuf = new Float32Array(2048);
function drawScope(ctx: CanvasRenderingContext2D, opts: { color?: string }): void {
  if (!analyser || !ctx?.canvas) return;
  if (scopeBuf.length !== analyser.fftSize) scopeBuf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(scopeBuf);
  const { width: w, height: h } = ctx.canvas;
  const mid = h / 2;
  ctx.lineWidth = 2;
  ctx.strokeStyle = opts.color ?? '#7bd97b';
  ctx.beginPath();
  for (let i = 0; i < scopeBuf.length; i++) {
    const x = (i / (scopeBuf.length - 1)) * w;
    const y = mid - (scopeBuf[i] ?? 0) * h * 0.4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Collect the painters registered on a pattern via .pianoroll()/.scope()/etc. */
export function getPainters(pattern: unknown): Painter[] {
  const p = pattern as { getPainters?: () => Painter[] } | undefined;
  try {
    return typeof p?.getPainters === 'function' ? p.getPainters() : [];
  } catch {
    return [];
  }
}
