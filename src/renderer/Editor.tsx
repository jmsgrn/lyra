/**
 * CodeMirror 6 editor pane (the target editor). Mounts once; the parent
 * replaces the document on file-open by bumping `docKey`, focuses it via the
 * ref, and flashes the currently-sounding note ranges via `highlight()` (the
 * Strudel-style live highlight). The theme lives in a Compartment so `/theme`
 * switches it live. App chords are handled globally in App.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactElement } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap, Decoration, WidgetType, type DecorationSet } from '@codemirror/view';
import { Compartment, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { cmTheme } from './cmTheme.js';
import type { Theme } from '../shared/themes.js';

export interface HighlightRange {
  from: number;
  to: number;
}

export interface EditorProps {
  initialDoc: string;
  /** bump to load a new document (file open) */
  docKey: number;
  theme: Theme;
  onChange: (code: string) => void;
  /** canvas hosted as a block widget after an inline ._pianoroll()/… call */
  inlineCanvas?: HTMLCanvasElement | null;
}

export interface EditorHandle {
  focus(): void;
  /** flash the given character ranges as currently-sounding (Strudel highlight) */
  highlight(ranges: HighlightRange[]): void;
  /** insert text at the cursor (replacing any selection) and focus */
  insert(text: string): void;
}

// --- live-highlight extension (shared definitions) ---
const setHighlights = StateEffect.define<HighlightRange[]>();
const markDeco = Decoration.mark({ class: 'cm-hl' });
const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setHighlights)) {
        const len = tr.state.doc.length;
        const ranges = effect.value
          .filter((r) => r.from >= 0 && r.to <= len && r.from < r.to)
          .sort((a, b) => a.from - b.from)
          .map((r) => markDeco.range(r.from, r.to));
        deco = Decoration.set(ranges, true);
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// --- inline visuals: a block widget hosting the viz canvas right after the
// line that calls ._pianoroll()/.scope()/… so code flows below it ---
const VIZ_CALL = /\b_?(?:pianoroll|punchcard|spiral|scope|wordfall|pitchwheel)\s*\(/;

class InlineVizWidget extends WidgetType {
  constructor(readonly canvas: HTMLCanvasElement) {
    super();
  }
  eq(other: InlineVizWidget): boolean {
    return other.canvas === this.canvas;
  }
  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'inline-viz';
    wrap.appendChild(this.canvas);
    return wrap;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

function inlineVizField(canvas: HTMLCanvasElement): Extension {
  const build = (state: EditorState): DecorationSet => {
    const m = VIZ_CALL.exec(state.doc.toString());
    if (!m) return Decoration.none;
    const line = state.doc.lineAt(m.index);
    return Decoration.set([
      Decoration.widget({ widget: new InlineVizWidget(canvas), block: true, side: 1 }).range(line.to),
    ]);
  };
  return StateField.define<DecorationSet>({
    create: build,
    update: (deco, tr) => (tr.docChanged ? build(tr.state) : deco),
    provide: (f) => EditorView.decorations.from(f),
  });
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref): ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeComp = useRef(new Compartment());

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      highlight: (ranges) => viewRef.current?.dispatch({ effects: setHighlights.of(ranges) }),
      insert: (text) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch(view.state.replaceSelection(text));
        view.focus();
      },
    }),
    [],
  );

  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;
  const themeRef = useRef(props.theme);
  themeRef.current = props.theme;

  useEffect(() => {
    const view = new EditorView({
      doc: props.initialDoc,
      parent: parentRef.current!,
      extensions: [
        basicSetup,
        javascript(),
        keymap.of([indentWithTab]),
        highlightField,
        ...(props.inlineCanvas ? [inlineVizField(props.inlineCanvas)] : []),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
        themeComp.current.of(cmTheme(themeRef.current)),
      ],
    });
    viewRef.current = view;
    view.focus();
    return () => view.destroy();
    // remount on file open so the whole document (and history) resets cleanly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.docKey]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: themeComp.current.reconfigure(cmTheme(props.theme)) });
  }, [props.theme]);

  return <div className="editor-wrap" ref={parentRef} />;
});
