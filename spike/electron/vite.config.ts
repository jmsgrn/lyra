import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Renderer-only Vite config. Root is this folder (index.html lives here); Vite
// resolves superdough/@strudel/codemirror from the project-root node_modules by
// walking up. This is the same browser-targeted build path strudel.cc uses, so
// it resolves the @kabelsalat ESM oddity that our Node postinstall patch works
// around — confirming that fix-deps.mjs is unneeded under a bundler.
export default defineConfig({
  root: here,
  server: { port: 5180, strictPort: false },
  optimizeDeps: {
    include: ['@strudel/core', '@strudel/mini', '@strudel/transpiler', 'superdough'],
  },
  clearScreen: false,
});
