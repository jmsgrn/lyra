/**
 * Phase-0 spike renderer — runs entirely in Chromium (contextIsolation on,
 * nodeIntegration off). Proves the Lyra thesis end to end with ZERO headless
 * shims:
 *
 *   - superdough on the browser's NATIVE Web Audio API (no node-web-audio-api,
 *     no webaudio-shim, no fetch-file, no idempotent start/stop patch)
 *   - Strudel's real pattern engine + Cyclist scheduler (the same `core.repl`
 *     wiring as src/strudel/repl.ts)
 *   - a CodeMirror 6 editor (the target editor)
 *   - a WebGL fragment-shader visualizer driven by the hap event stream,
 *     frame-locked to the audio clock (ctx.currentTime) — the architecture's
 *     "audio-reactive visual" claim, on the GPU
 *
 * Note how short the bring-up is compared to src/audio/engine.ts: in a real
 * browser context, superdough is just a normal import.
 */
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import { transpiler } from '@strudel/transpiler';
import * as sd from 'superdough';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { keymap } from '@codemirror/view';

// superdough/strudel expose loose, partly-untyped exports — same defensive
// casts the production code uses.
const sdAny = sd as unknown as {
  setAudioContext?: (c: unknown) => void;
  setDefaultAudioContext?: (c: unknown) => void;
  initAudio: (o?: { disableWorklets?: boolean }) => Promise<void>;
  registerSynthSounds: () => void;
  superdough: (value: unknown, deadline: number, duration: number, cps?: number) => unknown;
};
const coreAny = core as unknown as {
  evalScope: (...mods: unknown[]) => Promise<void>;
  setStringParser?: (p: unknown) => void;
  repl: (cfg: Record<string, unknown>) => LyraRepl;
};

interface LyraRepl {
  evaluate(code: string, autostart?: boolean): Promise<unknown>;
  start(): void;
  stop(): void;
  setCps(cps: number): void;
  scheduler: { now?: () => number; cps?: number };
  state: { started?: boolean };
}

// Synth-only so the spike needs no sample packs (sample loading is already
// proven in the TUI). All voices are superdough's built-in oscillators.
const DEFAULT_CODE = `stack(
  note("c2 [eb2 g2] c2 g1").s("sine").gain(.55).release(.12),
  note("<c4 eb4 g4 c5>").s("triangle").gain(.35).slow(2).release(.2),
  note("<[c3,eb3,g3] [g2,bb2,d3]>").s("sawtooth").gain(.12).slow(2).cutoff(800).release(.5)
)`;

// ---------- tiny DOM logger (also goes to console so Electron main forwards it) ----------
const logEl = document.getElementById('log') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const badgeEl = document.getElementById('badge') as HTMLElement;
type Kind = 'head' | 'info' | 'pass' | 'fail';
function log(kind: Kind, msg: string): void {
  const line = document.createElement('div');
  line.className = kind;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
  console.log(`[spike:${kind}] ${msg}`);
}
function setStatus(s: string): void {
  statusEl.textContent = s;
}

// ---------- audio-reactive energy, fed by the hap stream ----------
let energy = 0; // 0..1, bumped on each hap, decays each frame
let hapCount = 0;
let lastHapTime = 0;
function onHap(value: { gain?: number } | undefined, when: number): void {
  hapCount++;
  lastHapTime = when;
  const g = typeof value?.gain === 'number' ? value.gain : 0.5;
  energy = Math.min(1, energy + 0.35 * g + 0.15);
}

// ============================================================================
// Engine bring-up — native browser Web Audio, no shims.
// ============================================================================
let ctx: AudioContext;
let repl: LyraRepl;

async function boot(): Promise<void> {
  setStatus('initialising audio…');
  // NATIVE browser AudioContext. No latencyHint workaround needed (that was a
  // node-web-audio-api/ALSA quirk); Chromium opens the device on resume().
  ctx = new AudioContext();
  sdAny.setAudioContext?.(ctx);
  sdAny.setDefaultAudioContext?.(ctx);

  let worklets = true;
  try {
    await sdAny.initAudio(); // worklets load the normal browser way
  } catch (err) {
    worklets = false;
    log('fail', `initAudio with worklets failed, retrying without: ${String(err)}`);
    await sdAny.initAudio({ disableWorklets: true });
  }
  sdAny.registerSynthSounds();

  await coreAny.evalScope(core, mini);
  coreAny.setStringParser?.(mini.mini);

  repl = coreAny.repl({
    defaultOutput: (
      hap: { value?: Record<string, unknown> } | Record<string, unknown>,
      deadline: number,
      duration: number,
      cps = 1,
      targetTime?: number,
    ) => {
      const value = (hap as { value?: Record<string, unknown> }).value ?? (hap as Record<string, unknown>);
      const when = targetTime ?? ctx.currentTime + deadline;
      // superdough returns a promise that REJECTS for unknown sounds; the
      // production engine.ts only try/catches the sync throw, so those become
      // uncaught rejections. Catching here keeps one bad hap from spamming —
      // a real finding for the migration (mirror this in core's trigger).
      try {
        void Promise.resolve(sdAny.superdough(value, when, duration, cps)).catch((e) =>
          log('fail', `trigger: ${String(e)}`),
        );
      } catch (e) {
        log('fail', `trigger error: ${String(e)}`);
      }
      onHap(value as { gain?: number }, when); // the visualizer tap
    },
    getTime: () => ctx.currentTime,
    transpiler,
    onEvalError: (e: unknown) => log('fail', `eval error: ${String(e)}`),
  });
  repl.setCps(0.5);

  log('head', 'engine ready (NATIVE Web Audio — zero shims)');
  log('info', `sampleRate=${ctx.sampleRate}  baseLatency=${(ctx.baseLatency ?? 0).toFixed(4)}s  worklets=${worklets}`);
  log('info', `ctx.state=${ctx.state} (suspended until resume — browser autoplay policy)`);
  setStatus('ready');
}

async function resume(): Promise<void> {
  if (ctx.state !== 'running') await ctx.resume();
}

async function evalCode(): Promise<void> {
  await resume();
  await repl.evaluate(editor.state.doc.toString());
  log('info', 'evaluated + started; ctx.state=' + ctx.state);
  setStatus('playing');
}

// ============================================================================
// CodeMirror 6 editor (the target editor) with Ctrl+E = eval.
// ============================================================================
const editor = new EditorView({
  doc: DEFAULT_CODE,
  parent: document.getElementById('editor') as HTMLElement,
  extensions: [
    basicSetup,
    javascript(),
    keymap.of([{ key: 'Ctrl-e', run: () => { void evalCode(); return true; } }]),
    EditorView.theme({
      '&': { fontSize: '13px', backgroundColor: '#0b0b10', color: '#cdd0d6' },
      '.cm-gutters': { backgroundColor: '#0b0b10', borderRight: '1px solid #23232e' },
    }, { dark: true }),
  ],
});

document.getElementById('eval')!.addEventListener('click', () => void evalCode());
document.getElementById('play')!.addEventListener('click', () => void evalCode());
document.getElementById('stop')!.addEventListener('click', () => {
  repl?.stop();
  setStatus('stopped');
});

// ============================================================================
// WebGL fragment-shader visualizer (GPU) — proves the visual half + clock sync.
// A fullscreen plasma whose intensity tracks `energy` (driven by haps) and
// whose phase is the audio clock (ctx.currentTime), so it is frame-locked to
// the sound, not to wall-clock time.
// ============================================================================
const canvas = document.getElementById('viz') as HTMLCanvasElement;
const gl = canvas.getContext('webgl');
let glOk = false;
if (gl) {
  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const fs = `
    precision highp float;
    uniform vec2 uRes; uniform float uTime; uniform float uEnergy;
    void main(){
      vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
      float r = length(uv);
      float rings = sin(r*18.0 - uTime*3.0) * 0.5 + 0.5;
      float ang = atan(uv.y, uv.x);
      float petals = sin(ang*6.0 + uTime*1.5) * 0.5 + 0.5;
      float v = mix(rings, rings*petals, uEnergy);
      vec3 cool = vec3(0.08, 0.10, 0.18);
      vec3 hot  = vec3(0.85, 0.45, 0.30); // lyra warm
      vec3 col = mix(cool, hot, v * (0.25 + 0.75*uEnergy));
      col += uEnergy * 0.15 * exp(-r*3.0);
      gl_FragColor = vec4(col, 1.0);
    }`;
  const compile = (type: number, src: string): WebGLShader => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  try {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uEnergy = gl.getUniformLocation(prog, 'uEnergy');
    glOk = true;
    log('head', 'WebGL visualizer compiled (GPU shader path works)');

    const frame = (): void => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
      energy *= 0.94; // decay
      // PHASE comes from the AUDIO clock, not Date.now — frame-locked to sound.
      const t = ctx ? ctx.currentTime : performance.now() / 1000;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uEnergy, energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      badgeEl.textContent = `haps ${hapCount} · energy ${energy.toFixed(2)} · clk ${t.toFixed(1)}s`;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  } catch (e) {
    log('fail', `WebGL setup failed: ${String(e)}`);
  }
} else {
  log('fail', 'no WebGL context available');
}

// ============================================================================
// Boot + optional automated self-test (?autotest=1) so the spike can be
// validated headlessly: it starts audio, counts haps over ~2s, prints a
// verdict, and closes the window.
// ============================================================================
async function main(): Promise<void> {
  try {
    await boot();
  } catch (e) {
    log('fail', `BOOT FAILED: ${String(e)}`);
    setStatus('boot failed');
    return;
  }

  if (new URLSearchParams(location.search).has('autotest')) {
    log('head', '--- automated self-test ---');
    await evalCode();
    await new Promise((r) => setTimeout(r, 2200));
    const ctxRunning = ctx.state === 'running';
    const sawHaps = hapCount > 0;
    const clockAdvanced = lastHapTime > 0;
    log('info', `ctx.state=${ctx.state}  hapCount=${hapCount}  glOk=${glOk}  lastHapClock=${lastHapTime.toFixed(2)}`);
    const pass = ctxRunning && sawHaps && clockAdvanced && glOk;
    log(pass ? 'pass' : 'fail',
      pass
        ? 'SELF-TEST: PASS — native Web Audio produced scheduled haps + GPU visual, no shims'
        : `SELF-TEST: FAIL — running=${ctxRunning} haps=${sawHaps} glOk=${glOk}`);
    // signal the verdict in a machine-readable way for the launcher, then close
    console.log(`SPIKE_RESULT=${pass ? 'PASS' : 'FAIL'} haps=${hapCount} state=${ctx.state} glOk=${glOk}`);
    setTimeout(() => window.close(), 600);
  }
}

void main();
