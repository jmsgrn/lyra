/**
 * Renderer entry. Fetches initial state (open file, raw settings) from the main
 * process before first paint, merges settings over the shared defaults, then
 * mounts the React app.
 */
import { createRoot } from 'react-dom/client';
import { DEFAULT_SETTINGS, deepMerge } from '../shared/settings.js';
import { App } from './App.js';
import { lyra } from './ipc.js';
import './styles.css';

const initial = await lyra.getInitial();
const settings = deepMerge(DEFAULT_SETTINGS, initial.rawSettings);

// No StrictMode: its dev-only double-mount would build/tear-down the
// AudioContext twice and confuse superdough's global state.
createRoot(document.getElementById('root')!).render(<App initial={initial} settings={settings} />);
