/**
 * Built-in dark themes — the catalog selected by `settings.theme` (a name) and
 * switchable live in the desktop app via `/theme <name>`. Host-neutral (no fs,
 * no DOM): the TUI uses `accents`, the renderer uses all three groups (accents
 * for chrome, editor + syntax for CodeMirror).
 *
 * `accents` keeps the original field names so the Ink TUI consumes it unchanged.
 * Colors are hex so they render identically in the terminal and the browser.
 */

/** UI chrome colors (header, command bar, transport, …) — used by TUI + GUI. */
export interface ThemeAccents {
  header: string;
  editorActive: string;
  command: string;
  borderInactive: string;
  muted: string;
  key: string;
  playing: string;
  stopped: string;
  error: string;
}

/** Editor surface colors (GUI / CodeMirror). */
export interface ThemeEditor {
  background: string;
  foreground: string;
  gutter: string;
  cursor: string;
  activeLine: string;
  selection: string;
}

/** Syntax-highlighting token colors (GUI / CodeMirror). */
export interface ThemeSyntax {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  operator: string;
  variableName: string;
  functionName: string;
  def: string;
  bracket: string;
  punctuation: string;
  atom: string;
}

export interface Theme {
  name: string;
  label: string;
  accents: ThemeAccents;
  editor: ThemeEditor;
  syntax: ThemeSyntax;
}

export const THEMES: Record<string, Theme> = {
  lyra: {
    name: 'lyra',
    label: 'Lyra (warm)',
    accents: {
      header: '#d98a5b',
      editorActive: '#5bd9c4',
      command: '#d9b35b',
      borderInactive: '#3a3a44',
      muted: '#6f7480',
      key: '#6fd9d9',
      playing: '#7bd97b',
      stopped: '#6f7480',
      error: '#e07b7b',
    },
    editor: {
      background: '#0b0b10',
      foreground: '#e6e1d8',
      gutter: '#5a5550',
      cursor: '#d98a5b',
      activeLine: '#ffffff08',
      selection: '#d98a5b33',
    },
    syntax: {
      keyword: '#e0915b',
      string: '#a8cf8e',
      number: '#d9b35b',
      comment: '#5f6470',
      operator: '#d98a5b',
      variableName: '#c9c4ba',
      functionName: '#6fd9d9',
      def: '#e0915b',
      bracket: '#9a958c',
      punctuation: '#8a8f99',
      atom: '#d97ba0',
    },
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight (cool)',
    accents: {
      header: '#7aa2f7',
      editorActive: '#7dcfff',
      command: '#bb9af7',
      borderInactive: '#2a2e3a',
      muted: '#565f89',
      key: '#7dcfff',
      playing: '#9ece6a',
      stopped: '#565f89',
      error: '#f7768e',
    },
    editor: {
      background: '#0a0c14',
      foreground: '#c0caf5',
      gutter: '#3b4261',
      cursor: '#7aa2f7',
      activeLine: '#ffffff0a',
      selection: '#7aa2f733',
    },
    syntax: {
      keyword: '#bb9af7',
      string: '#9ece6a',
      number: '#ff9e64',
      comment: '#565f89',
      operator: '#89ddff',
      variableName: '#c0caf5',
      functionName: '#7aa2f7',
      def: '#bb9af7',
      bracket: '#a9b1d6',
      punctuation: '#89ddff',
      atom: '#ff9e64',
    },
  },
  forest: {
    name: 'forest',
    label: 'Forest (green)',
    accents: {
      header: '#8fbf7f',
      editorActive: '#6fcf97',
      command: '#cdb97a',
      borderInactive: '#2c3328',
      muted: '#6a7561',
      key: '#7fd9a8',
      playing: '#9fe08f',
      stopped: '#6a7561',
      error: '#e08f8f',
    },
    editor: {
      background: '#0a0f0b',
      foreground: '#d6e0d0',
      gutter: '#4a5544',
      cursor: '#8fbf7f',
      activeLine: '#ffffff08',
      selection: '#8fbf7f33',
    },
    syntax: {
      keyword: '#8fbf7f',
      string: '#cdb97a',
      number: '#d9a86a',
      comment: '#5a6552',
      operator: '#7fd9a8',
      variableName: '#cdd6c4',
      functionName: '#6fcf97',
      def: '#8fbf7f',
      bracket: '#9aa890',
      punctuation: '#8a9580',
      atom: '#d99a9a',
    },
  },
};

export const DEFAULT_THEME = 'lyra';

// THEMES[DEFAULT_THEME] is statically present; assert it for the fallback so
// resolveTheme always returns a Theme (under noUncheckedIndexedAccess).
const FALLBACK_THEME = THEMES[DEFAULT_THEME] as Theme;

export const themeNames = (): string[] => Object.keys(THEMES);

/** Resolve a theme name to a Theme, falling back to the default. */
export function resolveTheme(name: string | undefined): Theme {
  return (name ? THEMES[name] : undefined) ?? FALLBACK_THEME;
}
