/**
 * Slash-command parser for the command bar. Pure: given an input string and a
 * context of actions, run the matching command and return a status message.
 * A leading "/" is optional.
 */
export interface CommandContext {
  play: () => void;
  stop: () => void;
  toggle: () => void;
  setCps: (cps: number) => void;
  setBpm: (bpm: number) => void;
  open: (path: string) => string;
  save: (path?: string) => string;
  openSettings: () => string;
  record: (name: string) => string;
  quit: () => void;
}

export const COMMAND_HELP =
  '/play · /stop · /bpm <n> · /rec <name> · /open <f> · /save · /settings · /quit';

export function runCommand(input: string, ctx: CommandContext): string {
  const trimmed = input.trim().replace(/^\//, '');
  if (!trimmed) return '';
  const [name = '', ...args] = trimmed.split(/\s+/);
  const cmd = name.toLowerCase();
  // remainder after the command, preserving spaces (for file paths)
  const arg = trimmed.slice(name.length).trim();

  const num = (label: string, fn: (n: number) => void, unit: string): string => {
    const n = Number(args[0]);
    if (!Number.isFinite(n) || n <= 0) return `usage: /${cmd} <number>`;
    fn(n);
    return `${label} = ${n}${unit}`;
  };

  switch (cmd) {
    case 'play':
    case 'start':
      ctx.play();
      return 'playing';
    case 'stop':
    case 'pause':
    case 'hush':
      ctx.stop();
      return 'stopped';
    case 'toggle':
      ctx.toggle();
      return 'toggled';
    case 'bpm':
      return num('bpm', ctx.setBpm, ' bpm');
    case 'cps':
      return num('cps', ctx.setCps, ' cps');
    case 'open':
    case 'o':
      return arg ? ctx.open(arg) : 'usage: /open <path>';
    case 'save':
    case 'w':
      return ctx.save(arg || undefined);
    case 'settings':
    case 'config':
      return ctx.openSettings();
    case 'rec':
    case 'record':
      return ctx.record(arg);
    case 'quit':
    case 'q':
    case 'exit':
      ctx.quit();
      return 'bye';
    case 'help':
    case '?':
      return COMMAND_HELP;
    default:
      return `unknown command: /${cmd} (try /help)`;
  }
}
