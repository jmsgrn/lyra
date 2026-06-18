/**
 * React hook bridging the Ink UI to the lyra audio/Strudel engine.
 *
 * Owns the LyraRepl instance, exposes evaluate/play/stop transport actions, and
 * surfaces engine state + a human-readable status line for the UI.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRepl, type LyraRepl, type ReplState } from '../strudel/repl.js';
import { closeEngine } from '../audio/engine.js';

const msg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export type Phase = 'starting' | 'ready' | 'failed';

export interface ReplApi {
  phase: Phase;
  status: string;
  state: ReplState;
  /** cycles per second of the running clock (best-effort) */
  cps: number;
  /** current cycle position (best-effort) */
  cycle: number;
  evaluate: (code: string) => void;
  /** start/stop the transport */
  toggle: () => void;
  play: () => void;
  stop: () => void;
  setCps: (cps: number) => void;
}

export function useRepl(): ReplApi {
  const replRef = useRef<LyraRepl | null>(null);
  // Whether a pattern has been evaluated at least once. The scheduler throws
  // ("no pattern set") if started before that, so play/toggle guard on it.
  const patternSetRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('starting');
  const [status, setStatus] = useState('starting audio engine…');
  const [state, setState] = useState<ReplState>({});
  const [cps, setCpsState] = useState(0.5);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    let mounted = true;
    createRepl({
      onUpdate: (s) => mounted && setState({ ...s }),
      onError: (err) => mounted && setStatus(`eval error: ${msg(err)}`),
    })
      .then((repl) => {
        if (!mounted) return;
        replRef.current = repl;
        setPhase('ready');
        setStatus('ready');
      })
      .catch((err) => {
        if (!mounted) return;
        setPhase('failed');
        setStatus(`engine failed: ${msg(err)}`);
      });
    return () => {
      mounted = false;
      // Stop the Cyclist timer before tearing down the audio context so a
      // pending tick can't call into a closed engine.
      try {
        replRef.current?.stop();
      } catch {
        /* ignore */
      }
      void closeEngine();
    };
  }, []);

  // best-effort clock readout for the header
  useEffect(() => {
    const id = setInterval(() => {
      const scheduler = replRef.current?.scheduler as
        | { now?: () => number; cps?: number }
        | undefined;
      if (!scheduler) return;
      if (typeof scheduler.cps === 'number') setCpsState(scheduler.cps);
      try {
        const n = scheduler.now?.();
        if (typeof n === 'number' && Number.isFinite(n)) setCycle(n);
      } catch {
        /* scheduler not running yet */
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  const evaluate = useCallback((code: string) => {
    const repl = replRef.current;
    if (!repl) return;
    Promise.resolve(repl.evaluate(code))
      .then(() => {
        patternSetRef.current = true;
        setStatus('playing');
      })
      .catch((err) => setStatus(`eval error: ${msg(err)}`));
  }, []);

  // Start the transport, guarding against the scheduler's "no pattern set"
  // throw (which surfaces as an async rejection) before anything is evaluated.
  const startSafely = useCallback(() => {
    const repl = replRef.current;
    if (!repl) return;
    if (!patternSetRef.current) {
      setStatus('nothing to play yet — press Ctrl+E to evaluate');
      return;
    }
    Promise.resolve(repl.start())
      .then(() => setStatus('playing'))
      .catch((err) => setStatus(`play error: ${msg(err)}`));
  }, []);

  const toggle = useCallback(() => {
    const repl = replRef.current;
    if (!repl) return;
    if (repl.state?.started === true) {
      repl.stop();
      setStatus('stopped');
    } else {
      startSafely();
    }
  }, [startSafely]);

  const play = useCallback(() => {
    startSafely();
  }, [startSafely]);

  const stop = useCallback(() => {
    replRef.current?.stop();
    setStatus('stopped');
  }, []);

  const setCps = useCallback((value: number) => {
    replRef.current?.setCps(value);
    setCpsState(value);
  }, []);

  return { phase, status, state, cps, cycle, evaluate, toggle, play, stop, setCps };
}
