/**
 * Top-level Ink app: header (transport/clock), the editor pane, and a footer
 * with status + keybinding hints.
 */
import React from 'react';
import { Box, Text, useApp } from 'ink';
import { Editor } from './Editor.js';
import { useRepl } from './useRepl.js';

const DEFAULT_CODE = `stack(
  note("c2 eb2 g2 bb2").s("sawtooth").cutoff(800),
  note("<c4 eb4 g4>/2").s("triangle").gain(.4),
  s("white*8").gain(.08).decay(.03)
)`;

export function App(): React.ReactElement {
  const { exit } = useApp();
  const repl = useRepl();
  const started = repl.state.started === true;
  const error = repl.state.error;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header started={started} cps={repl.cps} cycle={repl.cycle} phase={repl.phase} />
      <Editor
        initialCode={DEFAULT_CODE}
        onEvaluate={repl.evaluate}
        onToggle={repl.toggle}
        onQuit={exit}
      />
      <Footer status={repl.status} error={error} />
    </Box>
  );
}

interface HeaderProps {
  started: boolean;
  cps: number;
  cycle: number;
  phase: string;
}

function Header({ started, cps, cycle, phase }: HeaderProps): React.ReactElement {
  const bpm = Math.round(cps * 60 * 4); // 1 cycle ≈ 1 bar of 4 beats
  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Text>
        <Text color="magenta" bold>
          🎶 lyra
        </Text>
        <Text dimColor> · live coding</Text>
      </Text>
      <Text>
        <Text color={started ? 'green' : 'gray'}>{started ? '● playing' : '○ stopped'}</Text>
        <Text dimColor>
          {'  '}
          {cps.toFixed(2)} cps · ~{bpm} bpm · cycle {Math.floor(cycle)}
          {phase !== 'ready' ? ` · ${phase}` : ''}
        </Text>
      </Text>
    </Box>
  );
}

function Footer({ status, error }: { status: string; error: unknown }): React.ReactElement {
  const errText = error ? (error instanceof Error ? error.message : String(error)) : undefined;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        {errText ? <Text color="red">⚠ {errText}</Text> : <Text dimColor>{status}</Text>}
      </Text>
      <Text dimColor>
        <Text color="cyan">Ctrl+E</Text> eval · <Text color="cyan">Ctrl+Space</Text> play/stop ·{' '}
        <Text color="cyan">Ctrl+Q</Text> quit · <Text color="cyan">↑↓←→</Text> move
      </Text>
    </Box>
  );
}
