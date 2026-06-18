/** Well-known on-disk locations for lyra (XDG-aware). */
import { homedir } from 'node:os';
import { join } from 'node:path';

const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');

/** Where recorded samples are written and auto-loaded from on startup. */
export const recordingsDir = join(dataHome, 'lyra', 'samples');
