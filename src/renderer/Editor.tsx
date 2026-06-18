/**
 * CodeMirror 6 editor pane (the target editor). Mounts once; the parent
 * replaces the document on file-open by bumping `docKey`. Eval/save/focus-command
 * chords are forwarded to the parent; edits are reported via onChange.
 */
import { useEffect, useRef, type ReactElement } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { keymap } from '@codemirror/view';

export interface EditorProps {
  initialDoc: string;
  /** bump to load a new document (file open) */
  docKey: number;
  onChange: (code: string) => void;
  onEvaluate: (code: string) => void;
  onSave: () => void;
  onFocusCommand: () => void;
}

export function Editor(props: EditorProps): ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Keep latest callbacks in a ref so the (long-lived) keymap reads fresh ones.
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    const view = new EditorView({
      doc: props.initialDoc,
      parent: parentRef.current!,
      extensions: [
        basicSetup,
        javascript(),
        keymap.of([
          { key: 'Ctrl-e', preventDefault: true, run: (v) => (cb.current.onEvaluate(v.state.doc.toString()), true) },
          { key: 'Ctrl-Enter', preventDefault: true, run: (v) => (cb.current.onEvaluate(v.state.doc.toString()), true) },
          { key: 'Ctrl-s', preventDefault: true, run: () => (cb.current.onSave(), true) },
          { key: 'Ctrl-p', preventDefault: true, run: () => (cb.current.onFocusCommand(), true) },
        ]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) cb.current.onChange(u.state.doc.toString());
        }),
        EditorView.theme(
          {
            '&': { height: '100%', backgroundColor: 'var(--bg)', color: 'var(--text)' },
            '.cm-gutters': { backgroundColor: 'var(--bg)', borderRight: '1px solid var(--border)', color: 'var(--muted)' },
            '.cm-activeLine': { backgroundColor: '#ffffff08' },
            '.cm-activeLineGutter': { backgroundColor: '#ffffff08' },
            '.cm-cursor': { borderLeftColor: 'var(--header)' },
          },
          { dark: true },
        ),
      ],
    });
    viewRef.current = view;
    view.focus();
    return () => view.destroy();
    // remount on file open so the whole document (and history) resets cleanly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.docKey]);

  return <div className="editor-wrap" ref={parentRef} />;
}
