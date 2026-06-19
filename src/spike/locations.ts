/**
 * Spike: do haps carry source-code locations (for in-editor highlighting)?
 * Build the engine, evaluate, query the running pattern, and inspect
 * hap.context.locations.
 */
import { createNodeEngine, closeNodeEngine } from '../platform/node.js';

const repl = await createNodeEngine({});
await repl.evaluate('note("c e g a")');

const pattern = (repl.state.pattern ??
  (repl.scheduler as unknown as { pattern?: unknown }).pattern) as
  | { queryArc(a: number, b: number): Array<{ value: unknown; context?: { locations?: unknown } }> }
  | undefined;

if (!pattern) {
  console.log('NO PATTERN on repl.state.pattern / scheduler.pattern');
} else {
  const haps = pattern.queryArc(0, 1) as Array<{
    value: unknown;
    whole?: { begin: { toString(): string }; end: { toString(): string } };
    isActive?: (t: number) => boolean;
    context?: { locations?: unknown };
  }>;
  console.log(`queried ${haps.length} haps`);
  for (const h of haps) {
    const begin = h.whole?.begin?.toString();
    console.log(
      'value=', JSON.stringify(h.value),
      'whole.begin=', begin,
      'isActiveFn=', typeof h.isActive,
      `active@${begin}+eps=`, h.isActive?.(Number(begin) + 0.01),
      'locations=', JSON.stringify(h.context?.locations),
    );
  }
}

await closeNodeEngine();
process.exit(0);
