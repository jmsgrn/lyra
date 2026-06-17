/**
 * Ambient type declarations for the JS-only upstream dependencies (Strudel
 * packages + superdough). They ship no `.d.ts`, so we declare the surface we
 * actually use. Keeps our own code fully typed while the vendor boundary stays
 * deliberately loose.
 */

declare module 'superdough' {
  export function initAudio(options?: { disableWorklets?: boolean; maxPolyphony?: number }): Promise<void>;
  export function registerSynthSounds(): void;
  export function setAudioContext(ctx: unknown): unknown;
  export function setDefaultAudioContext(ctx: unknown): unknown;
  export function getAudioContext(): unknown;
  export function getAudioContextCurrentTime(): number;
  export function resetGlobalEffects(): void;
  export function samples(map: unknown, baseUrl?: string, options?: unknown): Promise<unknown>;
  export function superdough(value: unknown, deadline: number, duration: number, cps?: number): unknown;
  // Anything else superdough exports is reachable but untyped.
  const _superdough: Record<string, unknown>;
  export default _superdough;
}

declare module '@strudel/core' {
  // Pattern factories / controls (return Strudel Patterns; typed as `any` so
  // the fluent control chain `note(...).s(...).gain(...)` works freely).
  export function note(...args: unknown[]): any;
  export function n(...args: unknown[]): any;
  export function s(...args: unknown[]): any;
  export function sound(...args: unknown[]): any;
  export function stack(...args: unknown[]): any;
  export function seq(...args: unknown[]): any;
  export function cat(...args: unknown[]): any;
  export const controls: Record<string, unknown>;
  export const silence: any;

  // Eval scope + live-coding harness.
  export function evalScope(...modules: unknown[]): Promise<unknown>;
  export function setStringParser(parser: unknown): void;
  export function repl(config: Record<string, unknown>): any;
  export class Cyclist {
    constructor(config: Record<string, unknown>);
  }
  export function getTime(): number;
  export function setTime(fn: () => number): void;
}

declare module '@strudel/mini' {
  export function mini(...strings: string[]): any;
  export function h(...args: unknown[]): any;
}

declare module '@strudel/transpiler' {
  export function transpiler(code: string, options?: Record<string, unknown>): unknown;
  export function evaluate(code: string, options?: Record<string, unknown>): Promise<unknown>;
}
