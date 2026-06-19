/**
 * React hook bridging the renderer UI to the Lyra engine — the browser-side
 * sibling of the TUI's useRepl. Owns the BrowserEngine instance, exposes
 * evaluate/play/stop transport, and surfaces engine state + a status line.
 *
 * Difference from the headless path: the AudioContext starts suspended
 * (browser autoplay policy), so transport actions resume it first — that first
 * call happens inside a real user gesture (Ctrl+E / Play).
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { createBrowserEngine, type BrowserEngine } from '../platform/browser.js';
import type { EngineEvent, ReplState } from '../core/types.js';
import { lyra } from './ipc.js';
import { loadDefaultSounds } from './prebake.js';

const MAX_HAPS = 256; // recent events kept for visualizers

const msg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export type Phase = 'starting' | 'ready' | 'failed';

export interface EngineApi {
  phase: Phase;
  status: string;
  state: ReplState;
  cps: number;
  cycle: number;
  evaluate: (code: string) => void;
  toggle: () => void;
  play: () => void;
  stop: () => void;
  setCps: (cps: number) => void;
  setStatus: (s: string) => void;
  /** master analyser tap for visualizers (undefined until audio is up) */
  getAnalyser: () => AnalyserNode | undefined;
  /** audio-clock time, seconds */
  now: () => number;
  /** audition a sound one-shot (palette preview), independent of the transport */
  preview: (value: Record<string, unknown>) => void;
  /** the running pattern, queryable for pianoroll/highlight visuals */
  getPattern: () => unknown;
  /** transport position in cycles (pianoroll/highlight time base) */
  nowCycles: () => number;
  /** recent scheduled events for visualizers (oldest→newest) */
  hapsRef: MutableRefObject<EngineEvent[]>;
}

export function useEngine(initialCps: number): EngineApi {
  const ref = useRef<BrowserEngine | null>(null);
  // A pattern must be evaluated before the scheduler can start, else it throws.
  const patternSetRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('starting');
  const [status, setStatus] = useState('starting audio engine…');
  const [state, setState] = useState<ReplState>({});
  const [cps, setCpsState] = useState(initialCps);
  const [cycle, setCycle] = useState(0);
  const hapsRef = useRef<EngineEvent[]>([]);

  useEffect(() => {
    let mounted = true;
    createBrowserEngine({
      onUpdate: (s) => mounted && setState({ ...s }),
      onError: (err) => mounted && setStatus(`eval error: ${msg(err)}`),
    })
      .then(async (engine) => {
        if (!mounted) {
          void engine.close();
          return;
        }
        ref.current = engine;
        engine.setCps(initialCps);
        // feed the visualizer hap ring buffer
        engine.onEvent((e) => {
          const haps = hapsRef.current;
          haps.push(e);
          if (haps.length > MAX_HAPS) haps.splice(0, haps.length - MAX_HAPS);
        });
        setPhase('ready');
        setStatus('ready');
        // default sound library (drum machines, dirt samples, …) — best-effort,
        // non-blocking (offline just means synths only).
        void loadDefaultSounds((url) => engine.loadSamples(url));
        // best-effort: auto-load configured sample folders + recordings
        try {
          for (const pack of await lyra.scanSamples()) {
            await engine.loadSamples(pack.map, pack.baseUrl);
          }
        } catch (err) {
          if (mounted) setStatus(`samples: ${msg(err)}`);
        }
        // automated end-to-end self-test (?autotest=1): prove the full app path
        // makes scheduled sound, then report a verdict and close.
        if (new URLSearchParams(location.search).has('autotest')) {
          let haps = 0;
          engine.onEvent(() => {
            haps += 1;
          });
          await engine.resume();
          await engine.evaluate('note("c2 e2 g2 c3").s("sine").gain(.4)');
          await new Promise((r) => setTimeout(r, 2200));
          const ctxState = engine.getContext().state;
          const pass = haps > 0 && ctxState === 'running';
          console.log(`SPIKE_RESULT=${pass ? 'PASS' : 'FAIL'} haps=${haps} state=${ctxState}`);
          setTimeout(() => window.close(), 300);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setPhase('failed');
        setStatus(`engine failed: ${msg(err)}`);
      });
    return () => {
      mounted = false;
      try {
        ref.current?.stop();
      } catch {
        /* ignore */
      }
      void ref.current?.close();
    };
    // initialCps only seeds the first render; engine cps is reapplied via setCps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // best-effort clock readout for the header (once per cycle to limit renders)
  useEffect(() => {
    const id = setInterval(() => {
      const scheduler = ref.current?.scheduler as { now?: () => number; cps?: number } | undefined;
      if (!scheduler) return;
      if (typeof scheduler.cps === 'number') setCpsState(scheduler.cps);
      try {
        const n = scheduler.now?.();
        if (typeof n === 'number' && Number.isFinite(n)) setCycle(Math.floor(n));
      } catch {
        /* scheduler not running yet */
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  const evaluate = useCallback((code: string) => {
    const engine = ref.current;
    if (!engine) return;
    void engine.resume(); // first eval is a user gesture → unlocks audio
    Promise.resolve(engine.evaluate(code))
      .then(() => {
        patternSetRef.current = true;
        setStatus('playing');
      })
      .catch((err) => setStatus(`eval error: ${msg(err)}`));
  }, []);

  const startSafely = useCallback(() => {
    const engine = ref.current;
    if (!engine) return;
    if (!patternSetRef.current) {
      setStatus('nothing to play yet — press Ctrl+E to evaluate');
      return;
    }
    void engine.resume();
    Promise.resolve(engine.start())
      .then(() => setStatus('playing'))
      .catch((err) => setStatus(`play error: ${msg(err)}`));
  }, []);

  const toggle = useCallback(() => {
    const engine = ref.current;
    if (!engine) return;
    if (engine.state?.started === true) {
      engine.stop();
      setStatus('stopped');
    } else {
      startSafely();
    }
  }, [startSafely]);

  const play = useCallback(() => startSafely(), [startSafely]);

  const stop = useCallback(() => {
    ref.current?.stop();
    setStatus('stopped');
  }, []);

  const setCps = useCallback((value: number) => {
    ref.current?.setCps(value);
    setCpsState(value);
  }, []);

  const getAnalyser = useCallback(() => ref.current?.getAnalyser(), []);
  const now = useCallback(() => ref.current?.now() ?? 0, []);
  const getPattern = useCallback(() => ref.current?.getPattern(), []);
  const nowCycles = useCallback(() => ref.current?.nowCycles() ?? 0, []);
  const preview = useCallback((value: Record<string, unknown>) => {
    const engine = ref.current;
    if (!engine) return;
    void engine.resume(); // audition is a user gesture → unlock audio
    engine.preview(value);
  }, []);

  return {
    phase,
    status,
    state,
    cps,
    cycle,
    evaluate,
    toggle,
    play,
    stop,
    setCps,
    setStatus,
    getAnalyser,
    now,
    preview,
    getPattern,
    nowCycles,
    hapsRef,
  };
}
