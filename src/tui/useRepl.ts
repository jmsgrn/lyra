/**
 * React hook bridging the Ink UI to the lyra audio/Strudel engine.
 *
 * Owns the LyraRepl instance, exposes evaluate/hush transport actions, and
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
  hush: () => void;
  setCps: (cps: number) => void;
}

export function useRepl(): ReplApi {
  const replRef = useRef<LyraRepl | null>(null);
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
        setStatus('ready — Ctrl+E to play');
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
      .then(() => setStatus('playing'))
      .catch((err) => setStatus(`eval error: ${msg(err)}`));
  }, []);

  const toggle = useCallback(() => {
    const repl = replRef.current;
    if (!repl) return;
    repl.toggle();
    const started = repl.state?.started === true;
    setStatus(started ? 'playing' : 'stopped');
  }, []);

  const hush = useCallback(() => {
    replRef.current?.stop();
    setStatus('stopped');
  }, []);

  const setCps = useCallback((value: number) => {
    replRef.current?.setCps(value);
    setCpsState(value);
  }, []);

  return { phase, status, state, cps, cycle, evaluate, toggle, hush, setCps };
}
