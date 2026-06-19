/**
 * Sounds browser (the Sounds tab of the palette). Search + arrow-key navigation
 * + audition: focus it (Ctrl+P), type to filter, ↑/↓ to select, Enter to play a
 * demo of the selected sound, Esc to return to the editor. Click a sound to
 * audition it; double-click (or Shift+Enter) to insert a snippet at the cursor.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { listSounds, subscribeSounds, soundSnippet, type SoundInfo } from './sounds.js';

const MAX_RENDER = 400;
const TYPE_ORDER = ['synth', 'wavetable', 'sample'];
const TYPE_LABEL: Record<string, string> = {
  synth: 'synths',
  wavetable: 'wavetables',
  sample: 'samples & drum machines',
};

type Row =
  | { kind: 'head'; label: string }
  | { kind: 'sound'; sound: SoundInfo; index: number };

export interface SoundsPanelProps {
  onInsert: (text: string) => void;
  onPreview: (s: SoundInfo) => void;
  onEscape: () => void;
  /** bump to move keyboard focus into the search box */
  focusToken: number;
}

export function SoundsPanel({ onInsert, onPreview, onEscape, focusToken }: SoundsPanelProps): ReactElement {
  const [sounds, setSounds] = useState<SoundInfo[]>(() => listSounds());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = (): void => setSounds(listSounds());
    update();
    return subscribeSounds(update);
  }, []);

  // focus the search box when the palette is focused (Ctrl+P)
  useEffect(() => {
    if (focusToken > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusToken]);

  const { rows, flat } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (q ? sounds.filter((s) => s.name.toLowerCase().includes(q)) : sounds).slice(0, MAX_RENDER);
    const byType = new Map<string, SoundInfo[]>();
    for (const s of filtered) {
      const arr = byType.get(s.type) ?? [];
      arr.push(s);
      byType.set(s.type, arr);
    }
    const order = [...byType.keys()].sort(
      (a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99),
    );
    const rows: Row[] = [];
    const flat: SoundInfo[] = [];
    for (const t of order) {
      rows.push({ kind: 'head', label: TYPE_LABEL[t] ?? t });
      for (const s of byType.get(t)!) {
        rows.push({ kind: 'sound', sound: s, index: flat.length });
        flat.push(s);
      }
    }
    return { rows, flat };
  }, [sounds, query]);

  // keep selection in range and scrolled into view
  useEffect(() => {
    if (selected > flat.length - 1) setSelected(flat.length ? flat.length - 1 : 0);
  }, [flat.length, selected]);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onKeyDown = (e: ReactKeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = flat[selected];
      if (s) (e.shiftKey ? onInsert(soundSnippet(s)) : onPreview(s));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEscape();
    }
  };

  return (
    <div className="sounds">
      <input
        ref={inputRef}
        className="sounds-search"
        placeholder={`search ${sounds.length} sounds…`}
        spellCheck={false}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(0);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="sounds-hint">↑↓ select · Enter audition · ⇧Enter insert · Esc editor</div>
      <div className="sounds-list">
        {sounds.length === 0 ? (
          <div className="sounds-empty">loading default sound library…</div>
        ) : (
          rows.map((row) =>
            row.kind === 'head' ? (
              <div key={`h:${row.label}`} className="sounds-group-head">
                {row.label}
              </div>
            ) : (
              <button
                key={row.sound.name}
                ref={row.index === selected ? selectedRef : undefined}
                className={`sound-chip${row.index === selected ? ' selected' : ''}`}
                title={`${soundSnippet(row.sound)} · click to audition, dbl-click to insert`}
                onClick={() => {
                  setSelected(row.index);
                  onPreview(row.sound);
                }}
                onDoubleClick={() => onInsert(soundSnippet(row.sound))}
              >
                {row.sound.name}
                {row.sound.count > 1 ? <span className="sound-count">{row.sound.count}</span> : null}
              </button>
            ),
          )
        )}
      </div>
    </div>
  );
}
