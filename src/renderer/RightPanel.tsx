/**
 * Right panel — Strudel-style tabbed sidebar. Starts with Sounds (the library
 * browser) and Visualizer (pianoroll/punchcard/scope/…). The visualizer canvas
 * is the same element the useVisuals loop draws to; it only mounts while its tab
 * is active (the loop skips drawing when it's absent).
 */
import { type ReactElement, type RefObject } from 'react';
import { SoundsPanel } from './SoundsPanel.js';

export type RightTab = 'sounds' | 'visualizer';

export interface RightPanelProps {
  tab: RightTab;
  onTab: (tab: RightTab) => void;
  width: number;
  vizCanvasRef: RefObject<HTMLCanvasElement | null>;
  vizId: string;
  onCycleViz: () => void;
  onInsertSound: (text: string) => void;
}

const TABS: RightTab[] = ['sounds', 'visualizer'];

export function RightPanel({
  tab,
  onTab,
  width,
  vizCanvasRef,
  vizId,
  onCycleViz,
  onInsertSound,
}: RightPanelProps): ReactElement {
  return (
    <div className="rightpanel" style={{ width }}>
      <div className="rp-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`rp-tab${tab === t ? ' active' : ''}`}
            onClick={() => onTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="rp-body">
        {tab === 'sounds' ? (
          <SoundsPanel onInsert={onInsertSound} />
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
