/**
 * CodeMirror 6 editor pane (the target editor). Mounts once; the parent
 * replaces the document on file-open by bumping `docKey`, and can focus it via
 * the imperative ref. App chords (eval/save/command/quit) are handled globally
 * in App, so the editor itself only does text editing + reports changes.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactElement } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';

export interface EditorProps {
  initialDoc: string;
  /** bump to load a new document (file open) */
  docKey: number;
  onChange: (code: string) => void;
}

export interface EditorHandle {
  focus(): void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref): ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useImperativeHandle(ref, () => ({ focus: () => viewRef.current?.focus() }), []);

  // Keep latest onChange in a ref so the long-lived listener reads the fresh one.
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;

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
});
