/**
 * Top-level Ink app: a header whose top border carries the "lyra vX.Y.Z" title
 * (plus the open filename) and whose body shows transport/clock + key hints,
 * the editor pane, and a slash-command bar (which also shows status).
 *
 * Transport is driven by slash commands (/play, /stop, ...). Ctrl+E evaluates,
 * Ctrl+S saves, Tab focuses the command bar.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import React, { useCallback, useRef, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { Editor } from './Editor.js';
import { CommandBar } from './CommandBar.js';
import { useRepl } from './useRepl.js';
import { useTerminalSize } from './useTerminalSize.js';
import { runCommand, type CommandContext } from './commands.js';
import { LOGO } from './logo.js';
import { theme } from './theme.js';
import { settingsError, settingsPath } from '../config/settings.js';
import { recordingsDir } from '../config/paths.js';
import { loadSamples } from '../audio/engine.js';
import { encodeWav } from '../audio/wav.js';
import * as recorder from '../audio/recorder.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

// One cycle ≈ one bar of 4 beats, so bpm = cps * 240.
const BEATS_PER_CYCLE = 4;
const cpsToBpm = (cps: number): number => cps * 60 * BEATS_PER_CYCLE;
const bpmToCps = (bpm: number): number => bpm / (60 * BEATS_PER_CYCLE);

const DEFAULT_CODE = `stack(
  note("c2 eb2 g2 bb2").s("sawtooth").cutoff(800),
  note("<c4 eb4 g4>/2").s("triangle").gain(.4),
  s("white*8").gain(.08).decay(.03)
)`;

type Mode = 'editor' | 'command';

export interface AppProps {
  filePath?: string;
  initialCode?: string;
}

/** A rounded top border with an inline title: `╭─ lyra v0.0.0 ───────╮`. */
function titleBorder(title: string, width: number): string {
  const label = ` ${title} `;
  const left = '╭─';
  const right = '╮';
  const fill = Math.max(0, width - left.length - label.length - right.length);
  return left + label + '─'.repeat(fill) + right;
}

export function App({ filePath: initialFilePath, initialCode }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const repl = useRepl();
  const { columns, rows } = useTerminalSize();
  const width = Math.max(24, columns - 2); // App applies paddingX={1}
  // Leave one row of headroom so a trailing newline can't scroll the top off.
  const height = Math.max(10, rows - 1);
  const [mode, setMode] = useState<Mode>('editor');
  const [commandResult, setCommandResult] = useState(settingsError ?? '');

  // --- file / editor buffer state ---
  const [filePath, setFilePath] = useState<string | undefined>(initialFilePath);
  const [seedCode, setSeedCode] = useState<string>(initialCode ?? DEFAULT_CODE);
  const [editorEpoch, setEditorEpoch] = useState(0); // bump to remount editor on open
  const [dirty, setDirty] = useState(false);
  const codeRef = useRef(seedCode);
  const savedRef = useRef(seedCode);

  const onCodeChange = useCallback((text: string) => {
    codeRef.current = text;
    setDirty(text !== savedRef.current);
  }, []);

  const openFile = useCallback((path: string): string => {
    const target = resolve(path);
    let content = '';
    try {
      content = readFileSync(target, 'utf8');
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') return `open failed: ${e.message}`;
      // ENOENT → treat as a new, empty file
    }
    setSeedCode(content);
    codeRef.current = content;
    savedRef.current = content;
    setFilePath(target);
    setDirty(false);
    setEditorEpoch((n) => n + 1);
    return `opened ${basename(target)}`;
  }, []);

  const saveFile = useCallback(
    (path?: string): string => {
      const target = path ? resolve(path) : filePath;
      if (!target) return 'no file — use /save <path>';
      try {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, codeRef.current);
      } catch (err) {
        return `save failed: ${(err as Error).message}`;
      }
      savedRef.current = codeRef.current;
      setFilePath(target);
      setDirty(false);
      return `saved ${basename(target)}`;
    },
    [filePath],
  );

  const openSettings = useCallback((): string => openFile(settingsPath), [openFile]);

  // --- recording ---
  const [recName, setRecName] = useState<string | null>(null);

  const saveRecording = useCallback(async (name: string, rec: recorder.Recording): Promise<string> => {
    mkdirSync(recordingsDir, { recursive: true });
    const file = `${name}.wav`;
    writeFileSync(join(recordingsDir, file), encodeWav(rec.channels, rec.sampleRate));
    await loadSamples({ [name]: [file] }, pathToFileURL(join(recordingsDir, '/')).href);
    return `saved "${name}" (${rec.durationSeconds.toFixed(1)}s) — play s("${name}")`;
  }, []);

  const record = useCallback(
    (arg: string): string => {
      if (recorder.isRecording()) {
        const rec = recorder.stopRecording();
        const name = recName ?? 'rec';
        setRecName(null);
        if (!rec) return 'recording was empty';
        saveRecording(name, rec)
          .then((m) => setCommandResult(m))
          .catch((e) => setCommandResult(`rec save failed: ${(e as Error).message}`));
        return `saving "${name}"…`;
      }
      const name = arg.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (!name) return 'usage: /rec <name>';
      setRecName(name);
      recorder.startRecording().catch((e) => {
        setRecName(null);
        setCommandResult(`rec failed: ${(e as Error).message}`);
      });
      return `● recording "${name}" — /rec to stop`;
    },
    [recName, saveRecording],
  );

  const started = repl.state.started === true;
  const error = repl.state.error;
  const errText = error ? (error instanceof Error ? error.message : String(error)) : undefined;
  const message = errText ?? (commandResult || repl.status);

  const commandContext: CommandContext = {
    play: repl.play,
    stop: repl.stop,
    toggle: repl.toggle,
    setCps: repl.setCps,
    setBpm: (bpm) => repl.setCps(bpmToCps(bpm)),
    open: openFile,
    save: saveFile,
    openSettings,
    record,
    quit: exit,
  };

  const execute = (text: string): void => {
    // Keep focus on the command bar so you can fire several commands in a row;
    // Esc or Tab returns to the editor.
    setCommandResult(runCommand(text, commandContext));
  };

  return (
    <Box flexDirection="column" paddingX={1} height={height}>
      <Header
        version={version}
        width={width}
        mode={mode}
        started={started}
        cps={repl.cps}
        cycle={repl.cycle}
        phase={repl.phase}
        file={filePath ? basename(filePath) : undefined}
        dirty={dirty}
        recording={recName}
      />
      <Editor
        key={editorEpoch}
        width={width}
        active={mode === 'editor'}
        initialCode={seedCode}
        onEvaluate={repl.evaluate}
        onFocusCommand={() => setMode('command')}
        onChange={onCodeChange}
        onSave={() => setCommandResult(saveFile())}
        onQuit={exit}
      />
      <CommandBar
        active={mode === 'command'}
        message={message}
        isError={errText !== undefined}
        width={width}
        onExecute={execute}
        onCancel={() => setMode('editor')}
        onQuit={exit}
      />
    </Box>
  );
}

interface HeaderProps {
  version: string;
  width: number;
  mode: Mode;
  started: boolean;
  cps: number;
  cycle: number;
  phase: string;
  file?: string;
  dirty: boolean;
  recording: string | null;
}

function Header({
  version,
  width,
  mode,
  started,
  cps,
  cycle,
  phase,
  file,
  dirty,
  recording,
}: HeaderProps): React.ReactElement {
  const bpm = Math.round(cpsToBpm(cps));
  const title = `lyra v${version}${file ? ` · ${file}${dirty ? ' ●' : ''}` : ''}`;
  return (
    <Box flexDirection="column" width={width}>
      <Text color={theme.header}>{titleBorder(title, width)}</Text>
      <Box
        borderStyle="round"
        borderTop={false}
        borderColor={theme.header}
        width={width}
        paddingX={1}
        justifyContent="space-between"
        alignItems="center"
      >
        <Text color={theme.header}>{LOGO}</Text>
        <Box flexDirection="column" alignItems="flex-end">
          {recording ? (
            <Text color={theme.error}>● rec {recording}</Text>
          ) : (
            <Text color={started ? theme.playing : theme.stopped}>
              {started ? '● playing' : '○ stopped'}
            </Text>
          )}
          <Text color={theme.muted}>
            {cps.toFixed(2)} cps · {bpm} bpm · cycle {Math.floor(cycle)}
            {phase !== 'ready' ? ` · ${phase}` : ''}
          </Text>
          <KeyHints mode={mode} />
        </Box>
      </Box>
    </Box>
  );
}

function KeyHints({ mode }: { mode: Mode }): React.ReactElement {
  if (mode === 'command') {
    return (
      <Text color={theme.muted}>
        <Text color={theme.command}>Enter</Text> run · <Text color={theme.command}>Esc</Text> cancel
      </Text>
    );
  }
  return (
    <Text color={theme.muted}>
      <Text color={theme.key}>Ctrl+E</Text> eval · <Text color={theme.key}>Ctrl+S</Text> save ·{' '}
      <Text color={theme.key}>Tab</Text> cmd · <Text color={theme.key}>Ctrl+Q</Text> quit
    </Text>
  );
}
