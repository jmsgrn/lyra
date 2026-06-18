/**
 * Bottom command/status bar. Runs slash commands (shared with the TUI) and
 * shows the latest status/result. Focus with Ctrl+P (or click); Esc/Enter
 * returns focus to the editor.
 */
import { forwardRef, useState, type ReactElement } from 'react';

export interface CommandBarProps {
  active: boolean;
  message: string;
  isError: boolean;
  onExecute: (text: string) => void;
  onBlurToEditor: () => void;
  onFocus: () => void;
}

export const CommandBar = forwardRef<HTMLInputElement, CommandBarProps>(function CommandBar(
  { active, message, isError, onExecute, onBlurToEditor, onFocus },
  ref,
): ReactElement {
  const [text, setText] = useState('');
  return (
    <div className={`cmdbar${active ? ' active' : ''}`}>
      <span className="prompt">❯</span>
      <input
        ref={ref}
        value={text}
        spellCheck={false}
        placeholder={message || 'Ctrl+P for commands · /help'}
        onFocus={onFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onExecute(text);
            setText('');
          } else if (e.key === 'Escape') {
            setText('');
            onBlurToEditor();
          }
        }}
      />
      {!active && message ? <span className={`msg${isError ? ' error' : ''}`}>{message}</span> : null}
    </div>
  );
});
