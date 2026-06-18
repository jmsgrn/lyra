/**
 * Bottom command bar — a single-line input for slash commands (/play, /stop,
 * /bpm <n>, ...). Active only when focused (Tab from the editor); otherwise it
 * shows the last command result or a hint.
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from './theme.js';

export interface CommandBarProps {
  active: boolean;
  result: string;
  /** explicit width so it lines up with the editor box above */
  width: number;
  onExecute: (text: string) => void;
  onCancel: () => void;
  onQuit: () => void;
}

export function CommandBar({ active, result, width, onExecute, onCancel, onQuit }: CommandBarProps): React.ReactElement {
  const [text, setText] = useState('');

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'q') {
        onQuit();
        return;
      }
      if (key.return) {
        onExecute(text);
        setText('');
        return;
      }
      if (key.escape || key.tab) {
        setText('');
        onCancel();
        return;
      }
      if (key.backspace || key.delete) {
        setText((t) => t.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta) return;
      if (input) setText((t) => t + input);
    },
    { isActive: active },
  );

  const color = active ? theme.command : theme.borderInactive;
  return (
    <Box borderStyle="round" borderColor={color} paddingX={1} width={width}>
      <Text color={active ? theme.command : theme.muted}>{'❯ '}</Text>
      {active ? (
        <Text>
          {text}
          <Text inverse> </Text>
        </Text>
      ) : (
        <Text color={theme.muted} dimColor>
          {result || 'Tab for commands · /help'}
        </Text>
      )}
    </Box>
  );
}
