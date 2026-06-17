# 🎶 lyra

**Strudel, but fully local and in a slick TUI.**

[lyra] is a terminal-native live-coding music environment. It runs
[Strudel]'s pattern language and its full synth/sampler/FX engine
([superdough]) entirely on your machine — no browser, no server — driven from a
keyboard-first terminal UI.

> Status: **early.** The audio + pattern engine works end to end (you can
> evaluate live-coding code and hear it). The TUI and audio sampling are in
> progress. See [Roadmap](#roadmap).

## Why

[Strudel] is a wonderful, browser-based port of [TidalCycles]. lyra keeps
Strudel's exact language and instruments but moves the whole thing into a local
terminal app, so live coding feels like working in a fast TUI rather than a web
page.

## How it works

lyra reuses Strudel's real pattern engine and synth engine, and makes them run
headless under Node:

```
your code
   │  @strudel/transpiler  (turns source into a Pattern)
   ▼
@strudel/core + @strudel/mini   (TidalCycles-style pattern algebra)
   │  Cyclist scheduler (look-ahead clock)
   ▼
superdough            (Strudel's synth / sampler / FX engine)
   │
node-web-audio-api    (Rust-backed Web Audio API for Node)
   ▼
your speakers
```

Everything we author is **pure TypeScript** (strict, ESM); the upstream Strudel
packages are consumed through typed wrappers.

## Requirements

- Node ≥ 22 (developed on Node 24)
- Linux audio: works with ALSA/PipeWire. node-web-audio-api needs the
  `playback` latency hint to open the device (handled for you); `pw-jack` is
  supported for lower latency.

## Getting started

```bash
npm install        # postinstall patches a mis-packaged transitive dep
npm run dev        # launch the TUI — Ctrl+E to play, Ctrl+. hush, Ctrl+Q quit
```

Put it on your PATH so you can just type `lyra`:

```bash
ln -s "$PWD/bin/lyra.mjs" ~/.local/bin/lyra   # or: npm link
lyra
```

Other smoke tests:

| Script | What it proves |
| --- | --- |
| `npm run spike` | raw node-web-audio-api output (offline-verified + realtime) |
| `npm run spike:superdough` | superdough synths run headless |
| `npm run spike:strudel` | a Strudel pattern's haps drive superdough |
| `npm run spike:repl` | the full live-eval + scheduler + audio loop |
| `npm run typecheck` | strict TypeScript, no emit |

## Roadmap

- [x] Headless audio: superdough on node-web-audio-api
- [x] Strudel pattern engine + Cyclist scheduler wired to audio
- [x] Ink TUI: editor pane, eval/transport keybindings, live status
- [ ] Default sound library (drum machines + sample packs)
- [ ] Audio sampling: load sample folders + record from mic/line input
- [ ] Latency/buffer tuning (eliminate xruns)

## Credits

Built on the work of the [Strudel] and [TidalCycles] communities. lyra is just a
local TUI shell around their engines.

[lyra]: https://github.com/jmsgrn/lyra
[Strudel]: https://strudel.cc
[superdough]: https://www.npmjs.com/package/superdough
[TidalCycles]: https://tidalcycles.org
[node-web-audio-api]: https://github.com/ircam-ismm/node-web-audio-api
