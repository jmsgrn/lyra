/**
 * Visualizer registry. Each visualizer is a pure draw(frame) over a Canvas2D
 * context. The Strudel-native ones (pianoroll, punchcard) reuse @strudel/draw
 * over the haps queried from the running pattern; scope/spectrum read the
 * master analyser. All are frame-locked to the audio clock.
 */
import { drawPianoroll } from '@strudel/draw';
import type { Theme } from '../shared/themes.js';

/** A queried Strudel hap (loosely typed at the vendor boundary). */
export interface StrudelHap {
  value: Record<string, unknown>;
  whole?: { begin: number; end: number };
  isActive?: (time: number) => boolean;
  context?: { locations?: Array<{ start: number; end: number }> };
}

export interface VizFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  theme: Theme;
  /** transport position in cycles (pianoroll/punchcard time base) */
  cycle: number;
  /** audio-clock seconds (scope phase) */
  time: number;
  analyser?: AnalyserNode;
  timeData: Float32Array;
  freqData: Uint8Array;
  /** haps queried over the visible window */
  haps: StrudelHap[];
}

export interface Visualizer {
  id: string;
  label: string;
  draw(frame: VizFrame): void;
}

// ---------- helpers ----------
function clear(f: VizFrame): void {
  f.ctx.fillStyle = f.theme.editor.background;
  f.ctx.fillRect(0, 0, f.width, f.height);
}
function hint(f: VizFrame, text: string): void {
  f.ctx.fillStyle = f.theme.accents.muted;
  f.ctx.font = '12px ui-monospace, monospace';
  f.ctx.textAlign = 'center';
  f.ctx.fillText(text, f.width / 2, f.height / 2);
  f.ctx.textAlign = 'left';
}

// ---------- Strudel-native visualizers ----------
const CYCLES = 4; // visible window width, in cycles
const PLAYHEAD = 0.5; // playhead position 0..1

/** Cycles to query behind / ahead of `now` to fill the visible window. */
export const VIZ_BACK = CYCLES * PLAYHEAD;
export const VIZ_FWD = CYCLES * (1 - PLAYHEAD);

function strudelDraw(f: VizFrame, extra: Record<string, unknown>): void {
  clear(f);
  try {
    drawPianoroll({
      ctx: f.ctx,
      haps: f.haps,
      time: f.cycle,
      cycles: CYCLES,
      playhead: PLAYHEAD,
      background: f.theme.editor.background,
      active: f.theme.accents.editorActive,
      inactive: f.theme.accents.muted,
      playheadColor: f.theme.accents.header,
      ...extra,
    });
  } catch {
    hint(f, 'press Ctrl+E to play');
  }
  if (f.haps.length === 0) hint(f, 'press Ctrl+E to play');
}

const pianoroll: Visualizer = {
  id: 'pianoroll',
  label: 'pianoroll',
  draw: (f) => strudelDraw(f, { fold: 0 }),
};

const punchcard: Visualizer = {
  id: 'punchcard',
  label: 'punchcard',
  draw: (f) => strudelDraw(f, { fold: 1, labels: true }),
};

// ---------- analyser visualizers (extras) ----------
const scope: Visualizer = {
  id: 'scope',
  label: 'scope',
  draw(f) {
    clear(f);
    if (!f.analyser) return hint(f, 'press Ctrl+E to play — scope');
    const n = f.timeData.length;
    const mid = f.height / 2;
    const amp = f.height * 0.42;
    f.ctx.lineWidth = 1.5;
    f.ctx.strokeStyle = f.theme.accents.editorActive;
    f.ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * f.width;
      const y = mid - (f.timeData[i] ?? 0) * amp;
      if (i === 0) f.ctx.moveTo(x, y);
      else f.ctx.lineTo(x, y);
    }
    f.ctx.stroke();
  },
};

const spectrum: Visualizer = {
  id: 'spectrum',
  label: 'spectrum',
  draw(f) {
    clear(f);
    if (!f.analyser) return hint(f, 'press Ctrl+E to play — spectrum');
    const bins = Math.floor(f.freqData.length * 0.55);
    const barW = f.width / bins;
    for (let i = 0; i < bins; i++) {
      const v = (f.freqData[i] ?? 0) / 255;
      const bh = v * f.height;
      const hue = 200 - 200 * (i / bins);
      f.ctx.fillStyle = `hsla(${hue}, 70%, ${30 + v * 35}%, ${0.35 + v * 0.65})`;
      f.ctx.fillRect(i * barW, f.height - bh, Math.max(1, barW - 1), bh);
    }
  },
};

export const VISUALIZERS: Visualizer[] = [pianoroll, punchcard, scope, spectrum];

export const vizNames = (): string[] => VISUALIZERS.map((v) => v.id);

export function getVisualizer(id: string): Visualizer {
  return VISUALIZERS.find((v) => v.id === id) ?? pianoroll;
}
