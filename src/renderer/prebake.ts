/**
 * Default sound library — the same set strudel.cc loads on startup, fetched
 * from felixroos/dough-samples (the host Strudel itself uses). Gives drum
 * machines, the classic Dirt samples (bd/sd/hh/…), piano, EmuSP12, VCSL
 * instruments and mridangam, so `s("bd")`, `.bank("RolandTR909")`, etc. work
 * out of the box.
 *
 * Best-effort + non-blocking: offline just means no default samples (the
 * built-in synths still work). Samples themselves are fetched lazily on first
 * trigger; these calls only register the maps. TODO(local-first): cache packs
 * to disk so this works offline.
 */
import { registerZZFXSounds } from 'superdough';

const DOUGH = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';

export const DEFAULT_SOUND_SOURCES = [
  `${DOUGH}/tidal-drum-machines.json`,
  `${DOUGH}/piano.json`,
  `${DOUGH}/Dirt-Samples.json`,
  `${DOUGH}/EmuSP12.json`,
  `${DOUGH}/vcsl.json`,
  `${DOUGH}/mridangam.json`,
];

/** Register the extra ZZFX synths + load the default remote sample packs. */
export async function loadDefaultSounds(
  loadSamples: (src: string) => Promise<unknown>,
): Promise<void> {
  try {
    registerZZFXSounds();
  } catch {
    /* optional */
  }
  await Promise.allSettled(DEFAULT_SOUND_SOURCES.map((url) => loadSamples(url)));
}
