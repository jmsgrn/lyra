/**
 * Renderer app shell — header (transport/clock/file), CodeMirror editor, and a
 * command/status bar. Ports the TUI App's orchestration (file open/save, dirty
 * tracking, slash-command dispatch via the shared runCommand) to the desktop.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { runCommand, type CommandContext } from '../shared/commands.js';
import type { Settings } from '../shared/settings.js';
import { Editor, type EditorHandle } from './Editor.js';
import { CommandBar } from './CommandBar.js';
import { useEngine } from './useEngine.js';
import { lyra, type InitialState } from './ipc.js';

const BEATS_PER_CYCLE = 4;
const cpsToBpm = (cps: number): number => cps * 60 * BEATS_PER_CYCLE;
const bpmToCps = (bpm: number): number => bpm / (60 * BEATS_PER_CYCLE);
const baseName = (p: string): string => p.split('/').pop() || p;

const DEFAULT_CODE = `stack(
  // clean tones — a good audio-quality test
  note("c2 [eb2 g2] c2 g1").s("sine").gain(.55).release(.12),
  note("<c4 eb4 g4 c5>").s("triangle").gain(.35).slow(2).release(.2),
  note("<[c3,eb3,g3] [g2,bb2,d3]>").s("sawtooth").gain(.12).slow(2).cutoff(800).release(.5)
)`;

export interface AppProps {
  initial: InitialState;
  settings: Settings;
}

export function App({ initial, settings }: AppProps): ReactElement {
  const engine = useEngine(settings.tempo.cps);

  // apply themeable colors as CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const t = settings.theme;
    const set = (k: string, v?: string): void => {
      if (v) root.style.setProperty(k, v);
    };
    set('--header', t.header);
    set('--command', t.command);
    set('--playing', t.playing);
    set('--stopped', t.stopped);
    set('--error', t.error);
    set('--key', t.key);
  }, [settings]);

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

  // focus the command bar (Ctrl+P); the input's onFocus flips `active`
  const focusCommand = useCallback(() => {
    requestAnimationFrame(() => commandInputRef.current?.focus());
  }, []);
  // hand focus back to the editor (Esc in the command bar)
  const focusEditor = useCallback(() => editorRef.current?.focus(), []);

  // Global app chords — work regardless of which pane has focus, and
  // preventDefault beats Chromium's own Ctrl+P (print) / Ctrl+S (save page).
  // Latest callbacks via ref so we subscribe once.
  const chords = useRef({ evaluate: engine.evaluate, save: saveFile, focusCommand });
  chords.current = { evaluate: engine.evaluate, save: saveFile, focusCommand };
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
      } else if (k === 'p') {
        e.preventDefault();
        chords.current.focusCommand();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
            <b>Ctrl+E</b> eval · <b>Ctrl+S</b> save · <b>Ctrl+P</b> cmd · <b>Ctrl+Q</b> quit
          </span>
        </div>
      </div>

      <Editor key={docKey} ref={editorRef} docKey={docKey} initialDoc={seedDoc} onChange={onChange} />

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
