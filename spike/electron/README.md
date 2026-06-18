# Phase-0 spike — Electron + native Web Audio

Throwaway spike that de-risks the [approved direction](../../docs/ARCHITECTURE.md):
moving Lyra to an Electron desktop app with a web frontend.

## Run it

```bash
npm run spike:electron        # interactive: a window with editor + visualizer
npm run spike:electron:test   # automated self-test, exits 0 on PASS
```

`spike:electron` opens a window: edit the pattern, **Ctrl+E** or **▶ Play** to
hear it, watch the GPU shader pulse with the audio. `spike:electron:test`
auto-starts audio, counts scheduled haps over ~2s, and prints a verdict.

## What it proves (all ✓, on Linux / PipeWire, Electron 42 / Chromium)

| Thesis claim | Result |
|---|---|
| superdough runs on **native browser Web Audio** | ✓ `engine ready (NATIVE Web Audio — zero shims)` |
| **AudioWorklets** work in the renderer (the Tauri/WebKitGTK risk) | ✓ `[superdough] AudioWorklets loaded`, `worklets=true` |
| Low-latency native device, no `latencyHint` workaround | ✓ `sampleRate=48000 baseLatency=0.0107s`, `ctx.state=running` |
| Strudel's Cyclist scheduler drives superdough | ✓ `hapCount>0` over 2s |
| **CodeMirror 6** editor with Ctrl+E eval | ✓ (the editor pane) |
| **WebGL** GPU shader, audio-reactive, frame-locked to `ctx.currentTime` | ✓ `WebGL visualizer compiled` |
| Bundler (Vite) resolves the `@kabelsalat` ESM oddity | ✓ no `fix-deps.mjs` needed in the renderer |

### Shims that DISAPPEAR vs the headless TUI path
`node-web-audio-api`, `webaudio-shim.ts` (globals + idempotent start/stop),
`fetch-file.ts`, the `'playback'` latencyHint requirement, `pw-jack` /
`PIPEWIRE_LATENCY` wrangling, `silence.ts`. None are needed here — Chromium is
the runtime superdough was written for.

### Findings to carry into the migration
- **superdough's `superdough()` returns a promise that rejects for unknown
  sounds.** `src/audio/engine.ts`'s `trigger` only `try/catch`es the sync
  throw, so unknown-sound rejections become uncaught. `core`'s trigger should
  `.catch()` the returned promise (done here for reference).
- Browser autoplay policy keeps the `AudioContext` suspended until a user
  gesture; the real app resumes on first eval/Play. The self-test uses
  `--autoplay-policy=no-user-gesture-required` only to run unattended.
- `ScriptProcessor`/`onended` deprecation warnings from superdough are benign
  in Chromium (they were process-crashing only under node-web-audio-api).

## Layout
- `index.html` — renderer shell (editor | visualizer, log footer)
- `renderer.ts` — engine bring-up, CodeMirror, WebGL visualizer, self-test
- `main.cjs` — Electron main (pure web renderer; forwards console to stdout)
- `vite.config.ts` — renderer dev server / dep resolution
- `run.mjs` — boots Vite then Electron; `--autotest` = verdict + exit code
