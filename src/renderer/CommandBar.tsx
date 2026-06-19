/**
 * Bottom command/status bar. Runs slash commands (shared with the TUI) and
 * shows the latest status/result. Focus with Ctrl+M (or click); Esc returns
 * focus to the editor. `active` tracks the input's real focus so the highlight
 * clears when you click away.
 */
import { forwardRef, useState, type ReactElement } from 'react';

export interface CommandBarProps {
  active: boolean;
  message: string;
  isError: boolean;
  onExecute: (text: string) => void;
  /** reflect the input's real focus state up to the app */
  onActiveChange: (active: boolean) => void;
  /** Esc — hand focus back to the editor */
  onEscapeToEditor: () => void;
}

export const CommandBar = forwardRef<HTMLInputElement, CommandBarProps>(function CommandBar(
  { active, message, isError, onExecute, onActiveChange, onEscapeToEditor },
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
        placeholder={message || 'Ctrl+M for commands · /help'}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => onActiveChange(true)}
        onBlur={() => onActiveChange(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onExecute(text);
            setText('');
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setText('');
            onEscapeToEditor();
          }
        }}
      />
      {!active && message ? <span className={`msg${isError ? ' error' : ''}`}>{message}</span> : null}
    </div>
  );
});
