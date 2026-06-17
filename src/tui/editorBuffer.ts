/**
 * Pure text-buffer model for the editor: a list of lines plus a cursor.
 * No React, no I/O — just transformations, so it's easy to reason about and test.
 */
export interface Buffer {
  lines: string[];
  /** cursor row (line index) */
  row: number;
  /** cursor column (char index within the line) */
  col: number;
}

export type EditAction =
  | { type: 'insert'; text: string }
  | { type: 'newline' }
  | { type: 'backspace' }
  | { type: 'deleteForward' }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'home' }
  | { type: 'end' };

export function createBuffer(text: string): Buffer {
  const lines = text.split('\n');
  const lastRow = lines.length - 1;
  return { lines, row: lastRow, col: (lines[lastRow] ?? '').length };
}

export function bufferText(buf: Buffer): string {
  return buf.lines.join('\n');
}

const lineAt = (buf: Buffer, row: number): string => buf.lines[row] ?? '';

export function reduce(buf: Buffer, action: EditAction): Buffer {
  switch (action.type) {
    case 'insert':
      return insert(buf, action.text);
    case 'newline':
      return insert(buf, '\n');
    case 'backspace':
      return backspace(buf);
    case 'deleteForward':
      return deleteForward(buf);
    case 'left':
      return moveLeft(buf);
    case 'right':
      return moveRight(buf);
    case 'up':
      return moveVertical(buf, -1);
    case 'down':
      return moveVertical(buf, +1);
    case 'home':
      return { ...buf, col: 0 };
    case 'end':
      return { ...buf, col: lineAt(buf, buf.row).length };
    default:
      return buf;
  }
}

function insert(buf: Buffer, text: string): Buffer {
  const line = lineAt(buf, buf.row);
  const before = line.slice(0, buf.col);
  const after = line.slice(buf.col);
  const parts = text.split('\n');

  if (parts.length === 1) {
    const lines = [...buf.lines];
    lines[buf.row] = before + text + after;
    return { lines, row: buf.row, col: buf.col + text.length };
  }

  // multi-line insert (e.g. a paste)
  const inserted = [before + parts[0], ...parts.slice(1)];
  inserted[inserted.length - 1] += after;
  const lines = [...buf.lines.slice(0, buf.row), ...inserted, ...buf.lines.slice(buf.row + 1)];
  const row = buf.row + parts.length - 1;
  const col = (parts[parts.length - 1] ?? '').length;
  return { lines, row, col };
}

function backspace(buf: Buffer): Buffer {
  if (buf.col > 0) {
    const line = lineAt(buf, buf.row);
    const lines = [...buf.lines];
    lines[buf.row] = line.slice(0, buf.col - 1) + line.slice(buf.col);
    return { lines, row: buf.row, col: buf.col - 1 };
  }
  if (buf.row > 0) {
    const prev = lineAt(buf, buf.row - 1);
    const cur = lineAt(buf, buf.row);
    const lines = [...buf.lines];
    lines[buf.row - 1] = prev + cur;
    lines.splice(buf.row, 1);
    return { lines, row: buf.row - 1, col: prev.length };
  }
  return buf;
}

function deleteForward(buf: Buffer): Buffer {
  const line = lineAt(buf, buf.row);
  if (buf.col < line.length) {
    const lines = [...buf.lines];
    lines[buf.row] = line.slice(0, buf.col) + line.slice(buf.col + 1);
    return { ...buf, lines };
  }
  if (buf.row < buf.lines.length - 1) {
    const next = lineAt(buf, buf.row + 1);
    const lines = [...buf.lines];
    lines[buf.row] = line + next;
    lines.splice(buf.row + 1, 1);
    return { ...buf, lines };
  }
  return buf;
}

function moveLeft(buf: Buffer): Buffer {
  if (buf.col > 0) return { ...buf, col: buf.col - 1 };
  if (buf.row > 0) return { ...buf, row: buf.row - 1, col: lineAt(buf, buf.row - 1).length };
  return buf;
}

function moveRight(buf: Buffer): Buffer {
  if (buf.col < lineAt(buf, buf.row).length) return { ...buf, col: buf.col + 1 };
  if (buf.row < buf.lines.length - 1) return { ...buf, row: buf.row + 1, col: 0 };
  return buf;
}

function moveVertical(buf: Buffer, delta: number): Buffer {
  const row = buf.row + delta;
  if (row < 0 || row >= buf.lines.length) return buf;
  return { ...buf, row, col: Math.min(buf.col, lineAt(buf, row).length) };
}
