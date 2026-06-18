import { defineConfig, type Plugin } from 'vite';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

/**
 * The core/platform/shared modules use NodeNext-style `./foo.js` import
 * specifiers that actually point at `.ts` files (required for the Node/TUI
 * build). Vite/esbuild won't rewrite those, so resolve relative `.js` imports
 * to their `.ts` source when present.
 */
function jsToTs(): Plugin {
  return {
    name: 'lyra-js-to-ts',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.endsWith('.js')) return null;
      if (!source.startsWith('./') && !source.startsWith('../')) return null;
      const tsPath = resolve(dirname(importer), source.slice(0, -3) + '.ts');
      return existsSync(tsPath) ? tsPath : null;
    },
  };
}

export default defineConfig({
  root: here,
  // allow importing from src/* (core, platform, shared) outside the renderer root
  server: { port: 5190, strictPort: false, fs: { allow: [repoRoot] } },
  plugins: [jsToTs()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', '@strudel/core', '@strudel/mini', '@strudel/transpiler', 'superdough', 'codemirror', '@codemirror/lang-javascript', '@codemirror/view'],
  },
  build: {
    outDir: resolve(repoRoot, 'dist', 'renderer'),
    emptyOutDir: true,
  },
  clearScreen: false,
});
