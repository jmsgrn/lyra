/**
 * Build a CodeMirror theme (editor surface + syntax highlighting) from a Lyra
 * Theme. Returned as an Extension so it can live in a Compartment and be
 * reconfigured live when the user switches themes.
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import type { Theme } from '../shared/themes.js';

export function cmTheme(theme: Theme): Extension {
  const e = theme.editor;
  const s = theme.syntax;

  const view = EditorView.theme(
    {
      '&': { height: '100%', backgroundColor: e.background, color: e.foreground },
      '.cm-content': { caretColor: e.cursor },
      '.cm-gutters': { backgroundColor: e.background, color: e.gutter, border: 'none', borderRight: '1px solid var(--border)' },
      '.cm-activeLine': { backgroundColor: e.activeLine },
      '.cm-activeLineGutter': { backgroundColor: e.activeLine, color: e.foreground },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: e.cursor },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: e.selection,
      },
      '.cm-selectionMatch': { backgroundColor: e.selection },
    },
    { dark: true },
  );

  const highlight = syntaxHighlighting(
    HighlightStyle.define([
      { tag: t.keyword, color: s.keyword },
      { tag: [t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: s.keyword },
      { tag: [t.string, t.special(t.string)], color: s.string },
      { tag: [t.number, t.bool, t.null], color: s.number },
      { tag: [t.comment, t.lineComment, t.blockComment], color: s.comment, fontStyle: 'italic' },
      { tag: t.operator, color: s.operator },
      { tag: t.variableName, color: s.variableName },
      { tag: t.propertyName, color: s.variableName },
      { tag: [t.function(t.variableName), t.function(t.propertyName)], color: s.functionName },
      { tag: t.definition(t.variableName), color: s.def },
      { tag: [t.bracket, t.paren, t.brace, t.squareBracket], color: s.bracket },
      { tag: t.punctuation, color: s.punctuation },
      { tag: [t.atom, t.self], color: s.atom },
    ]),
  );

  return [view, highlight];
}
