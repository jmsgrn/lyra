/**
 * Post-install dependency fix-ups.
 *
 * `@kabelsalat/web@0.4.1` (a transitive dep of @strudel/core, used only for the
 * optional modular-synth output) is mis-packaged: it declares `type: module`
 * with `main` pointing at a UMD bundle (dist/index.js) that has no ESM exports,
 * while the real ESM lives in dist/index.mjs. Node follows `main`, finds no
 * `SalatRepl` export, and the whole @strudel/core import chain throws. Vite
 * (Strudel's normal build target) sidesteps this; raw Node does not.
 *
 * We add a minimal `exports` map so Node resolves the real ESM. Idempotent and
 * safe to run on every install.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function ensureExports(pkgName, exportsMap) {
  let pkgJsonPath;
  try {
    pkgJsonPath = require.resolve(`${pkgName}/package.json`);
  } catch {
    return; // dependency not installed; nothing to fix
  }
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  if (pkg.exports) return; // already has an exports map; leave it alone
  pkg.exports = exportsMap;
  writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`[fix-deps] added exports map to ${pkgName}`);
}

ensureExports('@kabelsalat/web', {
  '.': { import: './dist/index.mjs', require: './dist/index.js' },
});
