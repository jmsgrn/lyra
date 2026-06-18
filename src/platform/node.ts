/**
 * Node platform binding for the Lyra engine.
 *
 * Installs the Web Audio globals (webaudio-shim) and file:// fetch support
 * BEFORE the core engine — and therefore superdough — is imported, then builds
 * a node-web-audio-api AudioContext and hands it to the platform-agnostic core.
 * This is the headless host used by the TUI and the smoke-test spikes (and,
 * later, the `lyra render` CLI).
 *
 * Import order is load-bearing: the two side-effect imports must precede the
 * core import so superdough sees the globals.
 */
import '../audio/webaudio-shim.js';
import '../audio/fetch-file.js';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AudioContext, type NodeAudioContext } from '../audio/webaudio-shim.js';
import { createEngine, type Engine } from '../core/engine.js';
import type { ReplState } from '../core/types.js';
import { settings } from '../config/settings.js';

export interface NodeEngineOptions {
  /**
   * node-web-audio-api needs 'playback' on Linux to actually open the output
   * device (the default 'interactive' leaves the context suspended).
   */
  latencyHint?: 'interactive' | 'playback' | 'balanced' | number;
  worklets?: boolean;
  onError?: (error: unknown) => void;
  onUpdate?: (state: ReplState) => void;
}

/** The core Engine plus node-only conveniences (filesystem sample loading). */
export interface NodeEngine extends Engine {
  /**
   * Load a sample source by path/URL. A directory becomes a sample map (each
   * audio file's basename is a sound name); a `.json` file/URL or an http(s)
   * URL is loaded as a strudel.json sample map. Returns the names registered.
   */
  loadSampleSource(source: string): Promise<string[]>;
  /** The underlying node-web-audio-api context (full API, for the recorder). */
  getNodeContext(): NodeAudioContext;
}

const AUDIO_EXTENSIONS = new Set(['.wav', '.flac', '.ogg', '.mp3', '.aif', '.aiff', '.m4a']);

async function loadSampleSourceImpl(engine: Engine, source: string): Promise<string[]> {
  const expanded = source.startsWith('~') ? join(homedir(), source.slice(1)) : source;
  if (/^https?:\/\//.test(expanded) || expanded.endsWith('.json')) {
    const url = /^[a-z]+:\/\//i.test(expanded) ? expanded : pathToFileURL(resolve(expanded)).href;
    await engine.loadSamples(url);
    return [];
  }

  const dir = resolve(expanded);
  const baseUrl = pathToFileURL(join(dir, '/')).href;
  const map: Record<string, string[]> = {};
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return []; // directory doesn't exist / unreadable — nothing to load
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;
    const name = basename(entry.name, ext);
    (map[name] ??= []).push(entry.name);
  }
  const names = Object.keys(map);
  if (names.length > 0) await engine.loadSamples(map, baseUrl);
  return names;
}

// Single active node engine. The headless host genuinely runs one engine per
// process, so a module-level handle lets the TUI/recorder/spikes reach it
// through the thin facade below without threading it everywhere. The core
// itself stays instance-based and singleton-free.
let active: NodeEngine | undefined;

export async function createNodeEngine(opts: NodeEngineOptions = {}): Promise<NodeEngine> {
  const context = new AudioContext({ latencyHint: opts.latencyHint ?? settings.audio.latencyHint });
  const engine = await createEngine({
    context,
    worklets: opts.worklets ?? settings.audio.worklets,
    onError: opts.onError,
    onUpdate: opts.onUpdate,
  });

  const nodeEngine: NodeEngine = Object.assign(engine, {
    loadSampleSource: (source: string) => loadSampleSourceImpl(engine, source),
    getNodeContext: () => context,
  });
  active = nodeEngine;
  return nodeEngine;
}

function requireActive(): NodeEngine {
  if (!active) throw new Error('node engine not initialised — call createNodeEngine() first');
  return active;
}

// --- thin facade over the active engine (back-compat call sites) ---
export const loadSamples = (map: Record<string, unknown> | string, baseUrl?: string): Promise<void> =>
  requireActive().loadSamples(map, baseUrl);
export const loadSampleSource = (source: string): Promise<string[]> =>
  requireActive().loadSampleSource(source);
export const getNodeContext = (): NodeAudioContext => requireActive().getNodeContext();
export const hasWorklets = (): boolean => active?.hasWorklets() ?? false;
export async function closeNodeEngine(): Promise<void> {
  await active?.close();
  active = undefined;
}
