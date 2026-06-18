/**
 * Central color theme — the original palette: magenta header, cyan editor,
 * yellow command bar, with green/red/gray accents.
 */
export const theme = {
  /** header border + constellation logo */
  header: 'magenta',
  /** editor active border + cursor gutter */
  editorActive: 'cyan',
  /** command bar active border + prompt */
  command: 'yellow',
  /** inactive borders / muted text */
  borderInactive: 'gray',
  muted: 'gray',
  /** keybinding labels */
  key: 'cyan',
  /** transport states */
  playing: 'green',
  stopped: 'gray',
  /** errors */
  error: 'red',
} as const;
