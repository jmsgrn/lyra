/**
 * Central color theme. A warm coral accent with muted grays — cohesive and a
 * bit Claude-Code-ish. Ink renders hex colors via truecolor terminals.
 */
export const theme = {
  /** primary brand accent — logo, active editor border, key labels */
  accent: '#d98a5b',
  /** command-bar accent (amber/gold) */
  command: '#e6b450',
  /** transport states */
  playing: '#8ec07c',
  stopped: 'gray',
  /** errors */
  error: '#fb4934',
  /** inactive borders / muted text */
  borderInactive: 'gray',
  muted: 'gray',
  /** keybinding labels */
  key: '#83a598',
} as const;
