/**
 * The palette — the right-hand, tabbed, resizable pane (the third focus region
 * alongside the editor and the command line). Tabs: Sounds (the searchable,
 * keyboard-navigable library browser) and Visualizer (pianoroll/punchcard/…).
 * The visualizer canvas is the element the useVisuals loop draws to; it only
 * mounts while its tab is active.
 */
import { type ReactElement, type RefObject } from 'react';
import { SoundsPanel } from './SoundsPanel.js';
import type { SoundInfo } from './sounds.js';

export type PaletteTab = 'sounds' | 'visualizer';

export interface PaletteProps {
  tab: PaletteTab;
  onTab: (tab: PaletteTab) => void;
  width: number;
  vizCanvasRef: RefObject<HTMLCanvasElement | null>;
  vizId: string;
  onCycleViz: () => void;
  onInsertSound: (text: string) => void;
  onPreviewSound: (s: SoundInfo) => void;
  onEscape: () => void;
  /** bump to focus the sounds search (Ctrl+L) */
  soundsFocusToken: number;
}

const TABS: PaletteTab[] = ['sounds', 'visualizer'];

export function Palette({
  tab,
  onTab,
  width,
  vizCanvasRef,
  vizId,
  onCycleViz,
  onInsertSound,
  onPreviewSound,
  onEscape,
  soundsFocusToken,
}: PaletteProps): ReactElement {
  return (
    <div className="palette" style={{ width }}>
      <div className="rp-tabs">
        {TABS.map((t) => (
          <button key={t} className={`rp-tab${tab === t ? ' active' : ''}`} onClick={() => onTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="rp-body">
        {tab === 'sounds' ? (
          <SoundsPanel
            onInsert={onInsertSound}
            onPreview={onPreviewSound}
            onEscape={onEscape}
            focusToken={soundsFocusToken}
          />
        ) : (
          <div className="viz-wrap">
            <canvas ref={vizCanvasRef} className="viz-canvas" />
            <span className="viz-label" onClick={onCycleViz} title="cycle visualizer">
              {vizId} ▸
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
