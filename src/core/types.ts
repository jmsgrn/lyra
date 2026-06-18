/**
 * Core engine types — pure type declarations, NO runtime imports.
 *
 * Importing this module must never pull in superdough (which expects the Web
 * Audio globals to already exist). Keeping it import-free lets any layer —
 * including the headless node platform that installs those globals first —
 * reference these types safely.
 */

/** A subset of the control params superdough understands; open-ended on purpose. */
export interface SoundParams {
  s?: string;
  note?: string | number;
  n?: number;
  gain?: number;
  cutoff?: number;
  [param: string]: unknown;
}

/** Mirror of Strudel's internal repl state we care about for the UI. */
export interface ReplState {
  code?: string;
  activeCode?: string;
  started?: boolean;
  pending?: boolean;
  isDirty?: boolean;
  error?: unknown;
  evalError?: unknown;
  schedulerError?: unknown;
  pattern?: unknown;
  [key: string]: unknown;
}

/**
 * A scheduled sound event, emitted by the engine as it triggers each hap. This
 * is the tap visualizers/analysis subscribe to via `Engine.onEvent`; `timeSec`
 * is absolute audio-clock time, so visuals can be frame-locked to the sound.
 */
export interface EngineEvent {
  value: SoundParams;
  timeSec: number;
  durationSec: number;
  cps: number;
}

/**
 * The slice of an `AudioContext` the platform-agnostic core uses. Both
 * `node-web-audio-api`'s AudioContext and the browser's native AudioContext
 * satisfy this structurally, which is what lets one engine run in either host.
 */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly sampleRate: number;
  resume(): Promise<void>;
  close(): Promise<void>;
}
