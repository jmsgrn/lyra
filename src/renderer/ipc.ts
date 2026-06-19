/**
 * Typed wrapper over the `window.lyra` preload bridge (see src/main/preload.cjs).
 * All calls are async, non-realtime IPC to the Electron main process.
 */
export interface SamplePack {
  map: Record<string, string[]>;
  baseUrl: string;
}

export interface InitialState {
  filePath?: string;
  code?: string;
  rawSettings: unknown;
  settingsPath: string;
  version: string;
}

export interface LyraBridge {
  getInitial(): Promise<InitialState>;
  readFile(path: string): Promise<{ content?: string; error?: string }>;
  writeFile(path: string, content: string): Promise<{ error?: string }>;
  /** deep-merge a patch into settings.json (e.g. { theme: 'midnight' }) */
  updateSettings(patch: Record<string, unknown>): Promise<{ error?: string }>;
  scanSamples(): Promise<SamplePack[]>;
  saveRecording(
    name: string,
    bytes: Uint8Array,
  ): Promise<{ baseUrl?: string; file?: string; error?: string }>;
}

declare global {
  interface Window {
    lyra: LyraBridge;
  }
}

export const lyra: LyraBridge = window.lyra;
