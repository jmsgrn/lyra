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

/** A rounded top border with an inline title: `╭─ lyra v0.0.0 ───────╮`. */
function titleBorder(title: string, width: number): string {
  const label = ` ${title} `;
  const left = '╭─';
  const right = '╮';
  const fill = Math.max(0, width - left.length - label.length - right.length);
  return left + label + '─'.repeat(fill) + right;
}

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
    <Box flexDirection="column" width={width}>
      <Text color="magenta">{titleBorder(`lyra v${version}`, width)}</Text>
      <Box
        borderStyle="round"
        borderTop={false}
        borderColor="magenta"
        width={width}
        paddingX={1}
        justifyContent="space-between"
      >
        <Text>
          <Text color={started ? 'green' : 'gray'}>{started ? '● playing' : '○ stopped'}</Text>
          <Text dimColor>
            {'  '}
            {cps.toFixed(2)} cps · {bpm} bpm · cycle {Math.floor(cycle)}
            {phase !== 'ready' ? ` · ${phase}` : ''}
          </Text>
        </Text>
        <KeyHints mode={mode} />
      </Box>
    </Box>
  );
}

function KeyHints({ mode }: { mode: Mode }): React.ReactElement {
  if (mode === 'command') {
    return (
      <Text dimColor>
        <Text color="yellow">Enter</Text> run · <Text color="yellow">Esc</Text> cancel
      </Text>
    );
  }
  return (
    <Text dimColor>
      <Text color="cyan">Ctrl+E</Text> eval · <Text color="cyan">Tab</Text> cmd ·{' '}
      <Text color="cyan">Ctrl+Q</Text> quit
    </Text>
  );
}

function Footer({ status, error }: { status: string; error: unknown }): React.ReactElement {
  const errText = error ? (error instanceof Error ? error.message : String(error)) : undefined;
  return (
    <Box marginTop={1}>
      <Text>{errText ? <Text color="red">⚠ {errText}</Text> : <Text dimColor>{status}</Text>}</Text>
    </Box>
  );
}
