/**
 * Multi-line code editor pane.
 *
 * Owns the text buffer, handles editing/navigation keys, and renders the buffer
 * inside a box whose top border carries a title (Claude-Code style). Action keys
 * (eval, toggle transport, focus command bar, quit) are forwarded to the parent.
 * Only receives input while `active`.
 */
import React, { useReducer, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { bufferText, createBuffer, reduce, type Buffer, type EditAction } from './editorBuffer.js';
import { theme } from './theme.js';

export interface EditorProps {
  initialCode: string;
  /** explicit width so it lines up with the header and command bar */
  width: number;
  active: boolean;
  onEvaluate: (code: string) => void;
  onFocusCommand: () => void;
  onQuit: () => void;
}

export function Editor(props: EditorProps): React.ReactElement {
  const { initialCode, width, active, onEvaluate, onFocusCommand, onQuit } = props;
  const color = active ? theme.accent : theme.borderInactive;

  const [buf, dispatch] = useReducer(
    (state: Buffer, action: EditAction) => reduce(state, action),
    initialCode,
    createBuffer,
  );

  // Mirror current buffer in a ref so the (closure-captured) input handler can
  // read the up-to-date text at eval time.
  const bufRef = useRef(buf);
  bufRef.current = buf;

  useInput(
    (input, key) => {
      // --- action chords ---
      if (key.ctrl && (input === 'e' || key.return)) {
        return onEvaluate(bufferText(bufRef.current));
      }
      if (key.ctrl && input === 'q') return onQuit();
      if (key.tab) return onFocusCommand();

      // --- navigation ---
      if (key.leftArrow) return dispatch({ type: 'left' });
      if (key.rightArrow) return dispatch({ type: 'right' });
      if (key.upArrow) return dispatch({ type: 'up' });
      if (key.downArrow) return dispatch({ type: 'down' });

      // --- editing ---
      if (key.return) return dispatch({ type: 'newline' });
      // Backspace arrives as `backspace` or `delete` depending on terminal;
      // treat both as backspace so deletion always works.
      if (key.backspace || key.delete) return dispatch({ type: 'backspace' });

      // Ignore other control/meta combos; insert everything else verbatim.
      if (key.ctrl || key.meta || key.escape) return;
      if (input) dispatch({ type: 'insert', text: input });
    },
    { isActive: active },
  );

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      width={width}
      borderStyle="round"
      borderColor={color}
      paddingX={1}
    >
      {buf.lines.map((line, row) => (
        <EditorLine key={row} line={line} number={row + 1} isCursor={active && row === buf.row} col={buf.col} />
      ))}
    </Box>
  );
}

interface EditorLineProps {
  line: string;
  number: number;
  isCursor: boolean;
  col: number;
}

function EditorLine({ line, number, isCursor, col }: EditorLineProps): React.ReactElement {
  const gutter = String(number).padStart(2, ' ');
  return (
    <Box>
      <Text color={isCursor ? theme.accent : theme.muted} dimColor={!isCursor}>
        {gutter}{' '}
      </Text>
      <Text>{isCursor ? <CursorLine line={line} col={col} /> : line || ' '}</Text>
    </Box>
  );
}

function CursorLine({ line, col }: { line: string; col: number }): React.ReactElement {
  const before = line.slice(0, col);
  const at = line.slice(col, col + 1) || ' ';
  const after = line.slice(col + 1);
  return (
    <Text>
      {before}
      <Text inverse>{at}</Text>
      {after}
    </Text>
  );
}
