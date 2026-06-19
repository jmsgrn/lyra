/**
 * Renderer app shell — header (transport/clock/file), CodeMirror editor, and a
 * command/status bar. Ports the TUI App's orchestration (file open/save, dirty
 * tracking, slash-command dispatch via the shared runCommand) to the desktop.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { runCommand, type CommandContext } from '../shared/commands.js';
import type { Settings } from '../shared/settings.js';
import { resolveTheme, themeNames, type Theme } from '../shared/themes.js';
import { Editor, type EditorHandle } from './Editor.js';
import { CommandBar } from './CommandBar.js';
import { useVisuals } from './useVisuals.js';
import { vizNames } from './visualizers.js';
import { Palette, type PaletteTab } from './Palette.js';
import { previewValue, type SoundInfo } from './sounds.js';
import { useEngine } from './useEngine.js';
import { lyra, type InitialState } from './ipc.js';

const BEATS_PER_CYCLE = 4;
const cpsToBpm = (cps: number): number => cps * 60 * BEATS_PER_CYCLE;
const bpmToCps = (bpm: number): number => bpm / (60 * BEATS_PER_CYCLE);
const baseName = (p: string): string => p.split('/').pop() || p;

const DEFAULT_CODE = `// lyra demo — same sound packs as strudel.cc (paste into strudel to compare)
stack(
  // TR-909 kit
  s("bd*2, ~ sd, hh*8").bank("RolandTR909").gain(0.9),
  // TR-808 clap + euclidean open hat, roomy
  s("~ cp, oh(3,8)").bank("RolandTR808").gain(0.45).room(0.3),
  // filtered saw bass with a slow LFO sweep
  note("c2 [eb2 g2] c2 <g1 bb1>").s("sawtooth").lpf(sine.range(400, 1400).slow(8)).gain(0.55).release(0.12),
  // drifting piano chords
  note("<[c4,eb4,g4] [bb3,d4,f4] [ab3,c4,eb4] [g3,bb3,d4]>").s("piano").slow(2).gain(0.5).room(0.5).delay(0.25)
)`;

export interface AppProps {
  initial: InitialState;
  settings: Settings;
}

export function App({ initial, settings }: AppProps): ReactElement {
  const engine = useEngine(settings.tempo.cps);
  const [theme, setThemeState] = useState<Theme>(() => resolveTheme(settings.theme));

  // drive the whole UI's CSS variables from the active theme
  useEffect(() => {
    const root = document.documentElement;
    const set = (k: string, v: string): void => root.style.setProperty(k, v);
    const { accents: a, editor: e } = theme;
    set('--bg', e.background);
    set('--text', e.foreground);
    set('--header', a.header);
    set('--command', a.command);
    set('--playing', a.playing);
    set('--stopped', a.stopped);
    set('--error', a.error);
    set('--key', a.key);
    set('--muted', a.muted);
    set('--border', a.borderInactive);
    set('--border-active', a.editorActive);
    // translucent highlight from the accent (hex + alpha)
    set('--hl', `${a.editorActive}55`);
  }, [theme]);

  const applyTheme = useCallback(
    (name: string): string => {
      const names = themeNames();
      if (!name) return `themes: ${names.join(', ')} · current: ${theme.name}`;
      if (!names.includes(name)) return `unknown theme "${name}" — try: ${names.join(', ')}`;
      setThemeState(resolveTheme(name));
      void lyra.updateSettings({ theme: name });
      return `theme: ${name}`;
    },
    [theme.name],
  );

  // --- palette: tabs (sounds | visualizer), resizable + collapsible ---
  const [vizId, setVizId] = useState('pianoroll');
  const [paletteTab, setPaletteTab] = useState<PaletteTab>('sounds');
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(380);
  const [soundsFocusToken, setSoundsFocusToken] = useState(0);
  const vizCanvasRef = useRef<HTMLCanvasElement>(null);

  // focus the palette (Ctrl+P): open it, show sounds, focus the search box
  const focusPalette = useCallback(() => {
    setPanelOpen(true);
    setPaletteTab('sounds');
    setSoundsFocusToken((t) => t + 1);
  }, []);

  const applyViz = useCallback(
    (arg: string): string => {
      const names = vizNames();
      const name = arg.toLowerCase();
      if (!name) return `viz: ${names.join(', ')} · current: ${vizId}`;
      if (name === 'off' || name === 'hide' || name === 'none') {
        setPanelOpen(false);
        return 'panel: hidden';
      }
      if (!['on', 'show'].includes(name) && !names.includes(name)) {
        return `unknown viz "${name}" — try: ${names.join(', ')}, off`;
      }
      if (names.includes(name)) setVizId(name);
      setPanelOpen(true);
      setPaletteTab('visualizer');
      return `viz: ${names.includes(name) ? name : vizId}`;
    },
    [vizId],
  );

  const cycleViz = useCallback(() => {
    const names = vizNames();
    setPanelOpen(true);
    setPaletteTab('visualizer');
    setVizId((cur) => names[(names.indexOf(cur) + 1) % names.length] ?? cur);
  }, []);

  const togglePanel = useCallback(() => setPanelOpen((o) => !o), []);

  // --- file / editor buffer state ---
  const [filePath, setFilePath] = useState<string | undefined>(initial.filePath);
  const [seedDoc, setSeedDoc] = useState<string>(initial.code || DEFAULT_CODE);
  const [docKey, setDocKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const codeRef = useRef(seedDoc);
  const savedRef = useRef(seedDoc);

  const [commandResult, setCommandResult] = useState('');
  const [commandActive, setCommandActive] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<EditorHandle>(null);

  const onChange = useCallback((text: string) => {
    codeRef.current = text;
    setDirty(text !== savedRef.current);
  }, []);

  const openFile = useCallback(async (path: string): Promise<void> => {
    const res = await lyra.readFile(path);
    if (res.error) {
      setCommandResult(`open failed: ${res.error}`);
      return;
    }
    const content = res.content ?? '';
    setSeedDoc(content);
    codeRef.current = content;
    savedRef.current = content;
    setFilePath(path);
    setDirty(false);
    setDocKey((k) => k + 1);
    setCommandResult(`opened ${baseName(path)}`);
  }, []);

  const saveFile = useCallback(
    async (path?: string): Promise<void> => {
      const target = path ?? filePath;
      if (!target) {
        setCommandResult('no file — use /save <path>');
        return;
      }
      const res = await lyra.writeFile(target, codeRef.current);
      if (res.error) {
        setCommandResult(`save failed: ${res.error}`);
        return;
      }
      savedRef.current = codeRef.current;
      setFilePath(target);
      setDirty(false);
      setCommandResult(`saved ${baseName(target)}`);
    },
    [filePath],
  );

  // focus the command bar (Ctrl+M); the input's onFocus flips `active`
  const focusCommand = useCallback(() => {
    requestAnimationFrame(() => commandInputRef.current?.focus());
  }, []);
  // hand focus back to the editor (Esc in the command bar)
  const focusEditor = useCallback(() => editorRef.current?.focus(), []);

  // insert a sound snippet at the cursor; audition a sound (palette)
  const insertSound = useCallback((text: string) => editorRef.current?.insert(text), []);
  const previewSound = useCallback((s: SoundInfo) => engine.preview(previewValue(s)), [engine]);

  // drag the splitter to resize the right panel
  const startResize = useCallback(
    (e: ReactMouseEvent): void => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = panelWidth;
      const onMove = (ev: MouseEvent): void =>
        setPanelWidth(Math.max(220, Math.min(760, startW + (startX - ev.clientX))));
      const onUp = (): void => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [panelWidth],
  );

  // Global app chords — work regardless of which pane has focus, and
  // preventDefault beats Chromium's own Ctrl+P (print) / Ctrl+S (save page).
  // Latest callbacks via ref so we subscribe once.
  const chords = useRef({ evaluate: engine.evaluate, save: saveFile, focusCommand, focusPalette, cycleViz, togglePanel });
  chords.current = { evaluate: engine.evaluate, save: saveFile, focusCommand, focusPalette, cycleViz, togglePanel };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'q') {
        e.preventDefault();
        window.close();
      } else if (k === 'e' || k === 'enter') {
        e.preventDefault();
        chords.current.evaluate(codeRef.current);
      } else if (k === 's') {
        e.preventDefault();
        void chords.current.save();
      } else if (k === 'm') {
        e.preventDefault();
        chords.current.focusCommand();
      } else if (k === 'p') {
        e.preventDefault();
        chords.current.focusPalette();
      } else if (k === 'g') {
        e.preventDefault();
        chords.current.cycleViz();
      } else if (k === 'b') {
        e.preventDefault();
        chords.current.togglePanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // single rAF loop: query the pattern → highlight active notes + draw the viz
  useVisuals({
    engine,
    canvasRef: vizCanvasRef,
    editorRef,
    vizId,
    showViz: panelOpen && paletteTab === 'visualizer',
    highlight: true,
    playing: engine.state.started === true,
    theme,
  });

  const ctx: CommandContext = {
    play: engine.play,
    stop: engine.stop,
    toggle: engine.toggle,
    setCps: engine.setCps,
    setBpm: (bpm) => engine.setCps(bpmToCps(bpm)),
    open: (path) => {
      void openFile(path);
      return `opening ${baseName(path)}…`;
    },
    save: (path) => {
      void saveFile(path);
      return 'saving…';
    },
    openSettings: () => {
      void openFile(initial.settingsPath);
      return 'opening settings…';
    },
    record: () => 'recording lands in a later phase (Phase 4)',
    setTheme: applyTheme,
    setViz: applyViz,
    quit: () => window.close(),
  };

  const execute = (text: string): void => setCommandResult(runCommand(text, ctx));

  const started = engine.state.started === true;
  const error = engine.state.error;
  const errText = error ? (error instanceof Error ? error.message : String(error)) : undefined;
  const message = errText ?? (commandResult || engine.status);
  const bpm = Math.round(cpsToBpm(engine.cps));

  return (
    <div className="app">
      <div className="header">
        <span className="title">
          lyra v{initial.version}
          {filePath ? (
            <>
              {' · '}
              <span className="file">{baseName(filePath)}</span>
              {dirty ? <span className="dirty"> ●</span> : null}
            </>
          ) : null}
        </span>
        <div className="right">
          <span className={`transport ${started ? 'playing' : 'stopped'}`}>
            {started ? '● playing' : '○ stopped'}
          </span>
          <span className="clock">
            {engine.cps.toFixed(2)} cps · {bpm} bpm · cycle {engine.cycle}
            {engine.phase !== 'ready' ? ` · ${engine.phase}` : ''}
          </span>
          <span className="hints">
            <b>Ctrl+E</b> eval · <b>Ctrl+M</b> cmd · <b>Ctrl+P</b> palette · <b>Ctrl+G</b> viz · <b>Ctrl+B</b> panel
          </span>
        </div>
      </div>

      <div className="workspace">
        <Editor key={docKey} ref={editorRef} docKey={docKey} theme={theme} initialDoc={seedDoc} onChange={onChange} />
        {panelOpen ? (
          <>
            <div className="splitter" onMouseDown={startResize} title="drag to resize" />
            <Palette
              tab={paletteTab}
              onTab={setPaletteTab}
              width={panelWidth}
              vizCanvasRef={vizCanvasRef}
              vizId={vizId}
              onCycleViz={cycleViz}
              onInsertSound={insertSound}
              onPreviewSound={previewSound}
              onEscape={focusEditor}
              soundsFocusToken={soundsFocusToken}
            />
          </>
        ) : null}
      </div>

      <CommandBar
        ref={commandInputRef}
        active={commandActive}
        message={message}
        isError={errText !== undefined}
        onExecute={execute}
        onActiveChange={setCommandActive}
        onEscapeToEditor={focusEditor}
      />
    </div>
  );
}
