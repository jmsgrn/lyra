/**
 * Top-level Ink app: header (transport/clock), the titled editor pane, a
 * slash-command bar, and a footer with status + keybinding hints.
 */
import { createRequire } from 'node:module';
import React, { useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { Editor } from './Editor.js';
import { CommandBar } from './CommandBar.js';
import { useRepl } from './useRepl.js';
import { useColumns } from './useTerminalSize.js';
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

export function App(): React.ReactElement {
  const { exit } = useApp();
  const repl = useRepl();
  const columns = useColumns();
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
    <Box flexDirection="column" paddingX={1}>
      <Header
        version={version}
        width={width}
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
        onToggle={repl.toggle}
        onFocusCommand={() => setMode('command')}
        onQuit={exit}
      />
      <CommandBar
        active={mode === 'command'}
        result={commandResult}
        width={width}
        onExecute={execute}
        onCancel={() => setMode('editor')}
        onQuit={exit}
      />
      <Footer status={repl.status} error={error} mode={mode} />
    </Box>
  );
}

interface HeaderProps {
  version: string;
  width: number;
  started: boolean;
  cps: number;
  cycle: number;
  phase: string;
}

function Header({ version, width, started, cps, cycle, phase }: HeaderProps): React.ReactElement {
  const bpm = Math.round(cpsToBpm(cps));
  return (
    <Box borderStyle="round" borderColor="magenta" width={width} paddingX={1} justifyContent="space-between">
      <Text>
        <Text color="magenta" bold>
          🎶 lyra
        </Text>
        <Text dimColor> v{version}</Text>
      </Text>
      <Text>
        <Text color={started ? 'green' : 'gray'}>{started ? '● playing' : '○ stopped'}</Text>
        <Text dimColor>
          {'  '}
          {cps.toFixed(2)} cps · {bpm} bpm · cycle {Math.floor(cycle)}
          {phase !== 'ready' ? ` · ${phase}` : ''}
        </Text>
      </Text>
    </Box>
  );
}

function Footer({
  status,
  error,
  mode,
}: {
  status: string;
  error: unknown;
  mode: Mode;
}): React.ReactElement {
  const errText = error ? (error instanceof Error ? error.message : String(error)) : undefined;
  const hints =
    mode === 'command' ? (
      <>
        <Text color="yellow">Enter</Text> run · <Text color="yellow">Esc</Text> cancel ·{' '}
        <Text color="yellow">/help</Text> commands
      </>
    ) : (
      <>
        <Text color="cyan">Ctrl+E</Text> eval · <Text color="cyan">Ctrl+Space</Text> play/stop ·{' '}
        <Text color="cyan">Tab</Text> command · <Text color="cyan">Ctrl+Q</Text> quit
      </>
    );
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{errText ? <Text color="red">⚠ {errText}</Text> : <Text dimColor>{status}</Text>}</Text>
      <Text dimColor>{hints}</Text>
    </Box>
  );
}
