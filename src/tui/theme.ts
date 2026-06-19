/**
 * Color theme for the TUI — the accent palette of the theme named in
 * ~/.config/lyra/settings.json under "theme" (e.g. "lyra", "midnight",
 * "forest"; see src/shared/themes.ts). Defaults to "lyra".
 */
import { settings } from '../config/settings.js';
import { resolveTheme } from '../shared/themes.js';

export const theme = resolveTheme(settings.theme).accents;
