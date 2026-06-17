/**
 * Multi-line code editor pane.
 *
 * Owns the text buffer, handles editing/navigation keys, and renders the buffer
 * with a line-number gutter and an inverse-video cursor. Action keys (eval,
 * toggle transport, quit) are handled here and forwarded to the parent, since
 * this is the focused component that receives keyboard input.
 */
import React, { useReducer, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { bufferText, createBuffer, reduce, type Buffer, type EditAction } from './editorBuffer.js';

export interface EditorProps {
  initialCode: string;
  onEvaluate: (code: string) => void;
  onToggle: () => void;
  onQuit: () => void;
}

/** Ctrl+Space: most terminals send a NUL byte; some send space + ctrl modifier. */
function isCtrlSpace(input: string, ctrl: boolean): boolean {
  if (input.length === 1 && input.charCodeAt(0) === 0) return true; // NUL byte
  return ctrl && input === ' ';
}

export function Editor({ initialCode, onEvaluate, onToggle, onQuit }: EditorProps): React.ReactElement {
  const [buf, dispatch] = useReducer(
    (state: Buffer, action: EditAction) => reduce(state, action),
    initialCode,
    createBuffer,
  );

  // Mirror current buffer in a ref so the (closure-captured) input handler can
  // read the up-to-date text at eval time.
  const bufRef = useRef(buf);
  bufRef.current = buf;

  useInput((input, key) => {
    // --- action chords ---
    // A plain space (input === ' ', key.ctrl === false) is NOT a chord and
    // falls through to insertion below.
    if (isCtrlSpace(input, key.ctrl)) {
      onToggle();
      return;
    }
    if (key.ctrl && (input === 'e' || key.return)) {
      onEvaluate(bufferText(bufRef.current));
      return;
    }
    if (key.ctrl && input === 'q') {
      onQuit();
      return;
    }

    // --- navigation ---
    if (key.leftArrow) return dispatch({ type: 'left' });
    if (key.rightArrow) return dispatch({ type: 'right' });
    if (key.upArrow) return dispatch({ type: 'up' });
    if (key.downArrow) return dispatch({ type: 'down' });

    // --- editing ---
    if (key.return) return dispatch({ type: 'newline' });
    // Backspace arrives as `backspace` or `delete` depending on the terminal;
    // treat both as backspace so deletion always works.
    if (key.backspace || key.delete) return dispatch({ type: 'backspace' });
    if (key.tab) return dispatch({ type: 'insert', text: '  ' });

    // Ignore any other control/meta combos; insert everything else verbatim.
    if (key.ctrl || key.meta || key.escape) return;
    if (input) dispatch({ type: 'insert', text: input });
  });

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="cyan" paddingX={1}>
      {buf.lines.map((line, row) => (
        <EditorLine key={row} line={line} number={row + 1} isCursor={row === buf.row} col={buf.col} />
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
      <Text color={isCursor ? 'cyan' : 'gray'} dimColor={!isCursor}>
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
