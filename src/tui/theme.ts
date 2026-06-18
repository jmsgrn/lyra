/**
 * Color theme — sourced from user settings (which default to the original
 * palette: magenta header, cyan editor, yellow command bar). Customize via
 * ~/.config/lyra/settings.json under "theme".
 */
import { settings } from '../config/settings.js';

export const theme = settings.theme;
