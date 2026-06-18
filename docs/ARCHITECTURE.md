# Lyra — Architecture & Direction

> Status: **approved direction**, pre-migration. This document is the durable
> record of the architecture assessment and the plan we're executing from.
> Decision date: 2026-06-18.

## TL;DR

Lyra is evolving from a terminal live-coding *music* tool into an **audiovisual
live-coding instrument** (live-coded audio **+** audio-reactive GPU visuals +
recording + AV export, local-first). The terminal medium hard-caps that
roadmap. We are pivoting to:

> **An Electron desktop app with a web frontend** — CodeMirror 6 editor,
> WebGL/Canvas visualizers, and **native browser Web Audio** running superdough
> — built on a reusable, platform-agnostic `@lyra/core`. The existing
> `node-web-audio-api` path is preserved as a headless `lyra render` CLI.

The pivotal insight: **superdough is Web Audio API code.** `node-web-audio-api`
+ our shims exist only because Node isn't a browser. An Electron renderer *is*
Chromium, so the move **deletes our most fragile code** (the headless shims,
`start/stop` idempotency hack, `file://` fetch shim, `pw-jack` wrangling,
console-silencing) **while unlocking the entire visual half of the roadmap**,
using the exact libraries strudel.cc already runs in production.

## Why not the alternatives

| Option | Verdict | Reason |
|---|---|---|
| Continue TUI-first | ✗ | Terminal can't render shaders/spectrograms/waveforms/video — caps >½ the roadmap. |
| TUI + external viz window | ✗ | Two runtimes + IPC to sync the audio clock to a separate GPU process; AV sync is the domain's hardest problem. Worst of both. |
| **Tauri** | ✗ | Renderer = **system WebView** (WebKitGTK/WebView2/WKWebView) with inconsistent AudioWorklet + WebGL/Web Audio support — worst on our Linux/WebKitGTK platform. Betting the core on the least-supported surface. |
| Native Rust UI | ✗ | Throws away the crown jewel (superdough + the Strudel language are JS). Reimplement or embed JS anyway. |
| **Electron + reusable core** | ✓ | One engine everywhere (Chromium): best-in-class Web Audio, AudioWorklets, WebGL/WebGPU. Reuses the proven Strudel stack; shims vanish; AV sync solved by construction. |
| Pure web / PWA | ~ | Same Chromium goodness, but local-first sample/file access is clunky; good as a *bonus* distribution of the same renderer, not primary. |

Cost accepted: ~150 MB binaries / higher RAM — normal for a creative desktop
instrument (VS Code, Ableton, Resolume). VS Code *is* Electron.

## The clean seam (why this is cheap, not a rewrite)

The current code already separates engine from UI:
`src/strudel/repl.ts` + `src/audio/engine.ts` is a tidy API, and the TUI only
touches it through `src/tui/useRepl.ts`. The engine is **already
context-injectable** (`setAudioContext(ctx)`), which is exactly what lets the
same core bind to browser Web Audio *and* `node-web-audio-api`. The only true
rewrite is the rendering layer (Ink → React-DOM + CodeMirror + canvas).

## Component disposition

| Component | Verdict |
|---|---|
| Strudel chain (`repl.ts`: `core.repl`, Cyclist, transpiler) | **KEEP** — crown jewel; runs unchanged in its native habitat |
| Audio engine API (`engine.ts`) | **KEEP/REFINE** — split Web-Audio-interface logic from the node binding |
| `webaudio-shim.ts`, `fetch-file.ts`, `silence.ts` | **REMOVE in GUI / KEEP for CLI** — pure not-a-browser compensation |
| `run.mjs` / pw-jack / `PIPEWIRE_LATENCY` | **DEMOTE** to the headless CLI |
| `scripts/fix-deps.mjs` (@kabelsalat) | **REFINE/REMOVE** — bundlers (Vite) sidestep it; verify in spike |
| Ink TUI (`App/Editor/CommandBar`) | **REPLACE** — logic ports, rendering primitives don't |
| `editorBuffer.ts` + `Editor.tsx` | **REPLACE** — superseded by CodeMirror 6 |
| `commands.ts` | **KEEP/REFINE** — reuse as command-palette backend |
| `useRepl.ts` | **REFINE/PORT** — framework-agnostic; clock poll → frame/event subscription |
| `settings.ts` / `paths.ts` | **KEEP/REFINE** — keep schema+merge; file I/O → main process |
| `recorder.ts` | **REFINE** — `ScriptProcessor` → AudioWorklet/`MediaRecorder` |
| `wav.ts` | **KEEP** |
| `node-web-audio-api` dep | **DEMOTE** — audio backend for `lyra render` CLI |
| `src/spike/*` | **KEEP** as smoke tests |

## Target architecture

```
┌─────────────────────────── MAIN PROCESS (Node) ───────────────────────────┐
│  ProjectIO (.lyra docs)   SampleLibrary (fs)   Settings (schema+merge, fs) │
│  Exporter (ffmpeg a+v mux)   native menus · global shortcuts · MIDI bridge │
│            ▲   async IPC — NON-realtime only (open/save/list/export)        │
└────────────┼───────────────────────────────────────────────────────────── ┘
             ▼
┌──────────────────────── RENDERER PROCESS (Chromium) ──────────────────────┐
│  @lyra/core:  transpiler → Pattern → Cyclist → superdough                  │
│      │  getTime: ctx.currentTime      ▲                                     │
│      ▼ trigger(hap) ── tap ──► event bus (hap ring + timestamps)            │
│      ▼                              │            ┌───────────────┐          │
│  native Web Audio graph             ▼            │ CodeMirror 6  │          │
│  (worklets, FX) ─► AnalyserNode ─► Visualizers   │ editor (eval) │          │
│      │                             (WebGL/Canvas:│ palette,      │          │
│      ▼                              scope, spec-  │ transport)    │          │
│   speakers                          trogram,      └───────────────┘          │
│                                     pianoroll,  SessionStore (zustand):     │
│                                     shader/Hydra) transport/cps/code/dirty  │
└─────────────────────────────────────────────────────────────────────────── ┘

Headless CLI (REUSES @lyra/core):
  lyra render set.lyra out.wav  →  core + node-web-audio-api (existing shims)
```

**Golden rule:** the audio clock and realtime audio↔visual data **never cross
IPC**. They live together in the renderer, sharing one `AudioContext`, so
audio-reactive visuals are frame-locked by construction. IPC is async,
non-realtime only.

### Audio pipeline
`source → @strudel/transpiler → Pattern → Cyclist (look-ahead) → haps →
superdough → Web Audio graph → master → destination`. Master also feeds an
`AnalyserNode` (visuals) and, for export, a `MediaRecorder` / `OfflineAudioContext`.

### Visualization pipeline
`requestAnimationFrame loop → read AnalyserNode (FFT/waveform) + hap ring buffer
→ draw`. Canvas2D for scope/spectrogram/pianoroll; WebGL/WebGPU for shader /
audio-reactive visuals. **Visualizers are the primary extension point** (a
registry of modules implementing a `Visualizer` interface).

### Recording / export pipeline
Mic/master → AudioWorklet capture → `wav.ts` encode → IPC → samples dir →
re-register. Sessions/clips via `MediaRecorder`; video via canvas capture +
ffmpeg mux in main.

### Proposed package layout
```
packages/
  core/      reused engine: strudel bridge, context-injectable audio engine,
             transport, event bus. NO DOM, NO Electron, NO node-audio assumptions.
  shared/    types, commands.ts, settings schema+merge, wav.ts
  renderer/  React app: CodeMirror, visualizers, transport, command palette
  main/      Electron main: ProjectIO, SampleLibrary, Settings I/O, Exporter, IPC
  cli/       `lyra render` headless: core + node-web-audio-api + existing shims
```

### Key interface contracts
```ts
interface Engine {              // bound to browser Web Audio OR node-web-audio-api
  evaluate(code: string): Promise<void>;
  start(): void; stop(): void; setCps(n: number): void;
  now(): number;                                  // audio clock
  onEvent(cb: (hap: Hap) => void): Unsubscribe;   // the visualizer tap
  loadSampleSource(src: string): Promise<string[]>;
}
interface Visualizer { id: string; render(frame: VizFrame): void; }
interface ProjectIO { load(path): Promise<Project>; save(path, p): Promise<void>; }
interface Exporter  { audio(opts): Promise<Buffer>; video(opts): Promise<Buffer>; }
```

### State, editor, errors, performance
- **State:** one `SessionStore` (Zustand) drives an imperative engine singleton
  (today's `useRepl` logic, relocated). Project = plain JSON via main.
- **Editor:** CodeMirror 6 (Strudel's editor) — highlight, undo, multi-cursor,
  eval-flash, configurable keymaps (Ctrl+E), optional vim.
- **Errors:** keep "one bad hap never kills the stream"; eval errors → inline CM
  diagnostics; init failure → recoverable screen; IPC failure → toast+retry.
- **Performance:** realtime path off-IPC; look-ahead scheduling; viz on rAF
  reading analyser + hap ring; heavy DSP in AudioWorklets; profile on Linux/PipeWire early.

## Migration plan (incremental — no flag day)

The TUI keeps working until the GUI reaches parity, then retires. ~10–12 weeks solo.

| Phase | Goal | Complexity | Success criteria |
|---|---|---|---|
| **0. Spike** | superdough in an Electron renderer (native Web Audio, worklets) + CodeMirror + one WebGL/Canvas visual, on Linux | S (~2–4d) | Sound from a pattern **and** a live visual, **zero shims** |
| **1. Extract core** | Lift `repl.ts`+`engine.ts` into `packages/core` behind `Engine`; move `commands`/`settings`/`wav` to `shared` | M (~1w) | TUI runs unchanged on the new core; spikes green |
| **2. Electron shell + parity** | Electron main (ProjectIO/Settings/IPC) + renderer (CM, transport, palette); port `useRepl`+`App` logic; bind core to native Web Audio | L (~2–3w) | Everything the TUI does, in a window, shims removed. Retire/optionalize TUI here |
| **3. Visual layer** | AnalyserNode + hap bus; scope/spectrogram/pianoroll; WebGL shader/Hydra canvas; `Visualizer` registry | L (~2–3w) | Frame-locked audio-reactive visuals |
| **4. Content & export** | Sample browser, project explorer; AudioWorklet recording; audio export; video export | M–L (~2–3w) | Import/record/save/load + AV export |
| **5. Perf mode + packaging** | Fullscreen viz + code overlay; electron-builder; Win/Mac/Linux; keep `lyra render` | M (~1–2w) | Cross-platform packaged build |

**Reuse scorecard:** scheduler/pattern engine **100%** · engine logic **~90%** ·
`commands`/`settings`/`wav` **100%** · `useRepl` logic **~80%** · `App`
orchestration **~60%** · editor/buffer **0%** (replaced by CodeMirror).

## UX principles (keyboard-first preserved)
Dark/minimal, no mouse-hunting, eval is one chord, everything reachable from a
command palette (Ctrl+P/Ctrl+K — the generalization of today's Tab→command bar).
Workspaces: Main (editor + viz + transport), Performance (fullscreen viz, code
overlay), Recording, Sample Browser, Project Explorer, Visualizer Workspace.
The "terminal feel" was a *means* (keyboard-first, zero chrome, flow) — fully
achievable in a focused Electron app (Zed/VS Code/Warp prove it). Keep the
values; change the medium.
