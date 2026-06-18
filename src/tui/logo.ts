/**
 * ASCII-art logo via figlet. The typeface is a single constant so it's trivial
 * to swap. Trailing whitespace and blank edge lines are trimmed so the art sits
 * tightly in the header.
 */
import figlet, { type FontName } from 'figlet';

export const LOGO_FONT: FontName = 'Standard';

export function makeLogo(text: string, font: FontName = LOGO_FONT): string {
  let art: string;
  try {
    art = figlet.textSync(text, { font });
  } catch {
    return text; // fall back to plain text if the font can't be loaded
  }
  const lines = art.split('\n').map((line) => line.replace(/\s+$/u, ''));
  while (lines.length > 0 && (lines[0] ?? '').trim() === '') lines.shift();
  while (lines.length > 0 && (lines[lines.length - 1] ?? '').trim() === '') lines.pop();
  return lines.join('\n');
}
