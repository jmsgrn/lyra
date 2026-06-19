/**
 * Sounds browser — lists the registered sounds (synths + loaded sample packs /
 * drum machines), grouped by type, with a search filter. Clicking a sound
 * inserts a usable snippet at the editor cursor.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { listSounds, subscribeSounds, soundSnippet, type SoundInfo } from './sounds.js';

const MAX_RENDER = 400; // guard against rendering thousands of drum-machine hits
const TYPE_ORDER = ['synth', 'wavetable', 'sample'];
const TYPE_LABEL: Record<string, string> = {
  synth: 'synths',
  wavetable: 'wavetables',
  sample: 'samples & drum machines',
};

export interface SoundsPanelProps {
  onInsert: (text: string) => void;
}

export function SoundsPanel({ onInsert }: SoundsPanelProps): ReactElement {
  const [sounds, setSounds] = useState<SoundInfo[]>(() => listSounds());
  const [query, setQuery] = useState('');

  useEffect(() => {
    const update = (): void => setSounds(listSounds());
    update();
    return subscribeSounds(update);
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? sounds.filter((s) => s.name.toLowerCase().includes(q)) : sounds;
    const capped = filtered.slice(0, MAX_RENDER);
    const byType = new Map<string, SoundInfo[]>();
    for (const s of capped) {
      const arr = byType.get(s.type) ?? [];
      arr.push(s);
      byType.set(s.type, arr);
    }
    const order = [...byType.keys()].sort(
      (a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99),
    );
    return { order, byType, total: filtered.length, shown: capped.length };
  }, [sounds, query]);

  return (
    <div className="sounds">
      <input
        className="sounds-search"
        placeholder={`search ${sounds.length} sounds…`}
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="sounds-list">
        {sounds.length === 0 ? (
          <div className="sounds-empty">loading default sound library…</div>
        ) : (
          groups.order.map((type) => (
            <div key={type} className="sounds-group">
              <div className="sounds-group-head">{TYPE_LABEL[type] ?? type}</div>
              <div className="sounds-items">
                {groups.byType.get(type)!.map((s) => (
                  <button
                    key={s.name}
                    className="sound-chip"
                    title={soundSnippet(s)}
                    onClick={() => onInsert(soundSnippet(s))}
                  >
                    {s.name}
                    {s.count > 1 ? <span className="sound-count">{s.count}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
        {groups.total > groups.shown ? (
          <div className="sounds-more">
            +{groups.total - groups.shown} more — refine your search
          </div>
        ) : null}
      </div>
    </div>
  );
}
