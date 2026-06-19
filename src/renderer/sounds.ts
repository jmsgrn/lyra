/**
 * Registered-sound enumeration for the Sounds browser. Reads superdough's
 * `soundMap` (a nanostores map) and subscribes to it so the browser updates as
 * sample packs finish loading.
 */
import { soundMap } from 'superdough';

export interface SoundInfo {
  name: string;
  /** 'synth' | 'sample' | 'wavetable' (best-effort) */
  type: string;
  /** number of variations (samples) under this name, if known */
  count: number;
}

function countOf(samples: unknown): number {
  if (Array.isArray(samples)) return samples.length;
  if (samples && typeof samples === 'object') return Object.keys(samples).length;
  return 0;
}

export function listSounds(): SoundInfo[] {
  const map = soundMap.get() ?? {};
  return Object.entries(map)
    .map(([name, entry]) => {
      const data = entry?.data ?? {};
      return {
        name,
        type: typeof data.type === 'string' ? data.type : 'sample',
        count: countOf(data.samples),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Subscribe to sound-map changes; returns an unsubscribe fn. */
export function subscribeSounds(cb: () => void): () => void {
  return soundMap.subscribe(() => cb());
}

/** The snippet inserted when a sound is clicked. */
export function soundSnippet(s: SoundInfo): string {
  return s.type === 'synth' || s.type === 'wavetable'
    ? `note("c3 e3 g3").s("${s.name}")`
    : `s("${s.name}")`;
}

/** The superdough value used to audition a sound (palette preview). */
export function previewValue(s: SoundInfo): Record<string, unknown> {
  return s.type === 'synth' || s.type === 'wavetable'
    ? { s: s.name, note: 'c3' }
    : { s: s.name };
}
