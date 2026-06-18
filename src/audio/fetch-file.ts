/**
 * Teach the global `fetch` to read `file://` URLs.
 *
 * Node's fetch refuses the file: scheme, but superdough loads samples (and
 * sample maps / strudel.json) via `fetch(url).arrayBuffer()` / `.json()`. With
 * this shim, local sample packs load through superdough's normal pipeline — no
 * static server needed. Import for side effects before loading any samples.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const originalFetch = globalThis.fetch;

const patchedFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('file:')) {
    const data = await readFile(fileURLToPath(url));
    return new Response(new Uint8Array(data));
  }
  return originalFetch(input, init);
};

globalThis.fetch = patchedFetch;
