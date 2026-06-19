/**
 * CodeMirror 6 editor pane (the target editor). Mounts once; the parent
 * replaces the document on file-open by bumping `docKey`, and can focus it via
 * the imperative ref. The theme lives in a Compartment so `/theme` switches it
 * live without remounting. App chords (eval/save/command/quit) are handled
 * globally in App, so the editor itself only does text editing + reports changes.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactElement } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { cmTheme } from './cmTheme.js';
import type { Theme } from '../shared/themes.js';

export interface EditorProps {
  initialDoc: string;
  /** bump to load a new document (file open) */
  docKey: number;
  theme: Theme;
  onChange: (code: string) => void;
}

export interface EditorHandle {
  focus(): void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref): ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeComp = useRef(new Compartment());

  useImperativeHandle(ref, () => ({ focus: () => viewRef.current?.focus() }), []);

  // Keep latest onChange in a ref so the long-lived listener reads the fresh one.
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;
  // theme at construction time (the live-switch effect handles later changes)
  const themeRef = useRef(props.theme);
  themeRef.current = props.theme;

  useEffect(() => {
    const view = new EditorView({
      doc: props.initialDoc,
      parent: parentRef.current!,
      extensions: [
        basicSetup,
        javascript(),
        // capture Tab to indent so it doesn't fall through and shift focus
        keymap.of([indentWithTab]),
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

  // live theme switch — reconfigure the compartment, no remount
  useEffect(() => {
    viewRef.current?.dispatch({ effects: themeComp.current.reconfigure(cmTheme(props.theme)) });
  }, [props.theme]);

  return <div className="editor-wrap" ref={parentRef} />;
});
