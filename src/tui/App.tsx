/**
 * Top-level Ink app: a header whose top border carries the "lyra vX.Y.Z" title
 * (Claude-Code style) and whose body shows the transport/clock plus key hints,
 * the editor pane, a slash-command bar, and a status line.
 *
 * Transport is driven by slash commands (/play, /stop, ...) rather than a key
 * chord; Ctrl+E evaluates and Tab focuses the command bar.
 */
import { createRequire } from 'node:module';
import React, { useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { Editor } from './Editor.js';
import { CommandBar } from './CommandBar.js';
import { useRepl } from './useRepl.js';
import { useTerminalSize } from './useTerminalSize.js';
import { runCommand, type CommandContext } from './commands.js';
import { makeLogo } from './logo.js';
import { theme } from './theme.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

const LOGO = makeLogo('lyra');

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

export function App(): React.ReactElement {
  const { exit } = useApp();
  const repl = useRepl();
  const { columns, rows } = useTerminalSize();
  const width = Math.max(24, columns - 2); // App applies paddingX={1}
  const [mode, setMode] = useState<Mode>('editor');
  const [commandResult, setCommandResult] = useState('');

  const started = repl.state.started === true;
  const error = repl.state.error;

  const commandContext: CommandContext = {
    play: repl.play,
    stop: repl.stop,
    toggle: repl.toggle,
    setCps: repl.setCps,
    setBpm: (bpm) => repl.setCps(bpmToCps(bpm)),
    quit: exit,
  };

  const execute = (text: string): void => {
    setCommandResult(runCommand(text, commandContext));
    setMode('editor');
  };

  return (
    <Box flexDirection="column" paddingX={1} height={rows}>
      <Header
        version={version}
        width={width}
        mode={mode}
        started={started}
        cps={repl.cps}
        cycle={repl.cycle}
        phase={repl.phase}
      />
      <Editor
        width={width}
        active={mode === 'editor'}
        initialCode={DEFAULT_CODE}
        onEvaluate={repl.evaluate}
        onFocusCommand={() => setMode('command')}
        onQuit={exit}
      />
      <Footer status={repl.status} error={error} />
      <CommandBar
        active={mode === 'command'}
        result={commandResult}
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
}

function Header({ version, width, mode, started, cps, cycle, phase }: HeaderProps): React.ReactElement {
  const bpm = Math.round(cpsToBpm(cps));
  return (
    <Box
      borderStyle="round"
      borderColor={theme.accent}
      width={width}
      paddingX={1}
      justifyContent="space-between"
      alignItems="center"
    >
      <Text color={theme.accent}>{LOGO}</Text>
      <Box flexDirection="column" alignItems="flex-end">
        <Text color={theme.muted} dimColor>
          v{version}
        </Text>
        <Text color={started ? theme.playing : theme.stopped}>
          {started ? '● playing' : '○ stopped'}
        </Text>
        <Text color={theme.muted}>
          {cps.toFixed(2)} cps · {bpm} bpm · cycle {Math.floor(cycle)}
          {phase !== 'ready' ? ` · ${phase}` : ''}
        </Text>
        <KeyHints mode={mode} />
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
      <Text color={theme.key}>Ctrl+E</Text> eval · <Text color={theme.key}>Tab</Text> cmd ·{' '}
      <Text color={theme.key}>Ctrl+Q</Text> quit
    </Text>
  );
}

function Footer({ status, error }: { status: string; error: unknown }): React.ReactElement {
  const errText = error ? (error instanceof Error ? error.message : String(error)) : undefined;
  return (
    <Box marginTop={1}>
      <Text>
        {errText ? <Text color={theme.error}>⚠ {errText}</Text> : <Text color={theme.muted}>{status}</Text>}
      </Text>
    </Box>
  );
}
