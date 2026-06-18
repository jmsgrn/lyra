/**
 * Preload bridge — exposes a minimal, typed `window.lyra` IPC surface to the
 * sandboxed renderer (contextIsolation on). All calls are async and
 * non-realtime; nothing here touches the audio clock.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lyra', {
  getInitial: () => ipcRenderer.invoke('lyra:getInitial'),
  readFile: (path) => ipcRenderer.invoke('lyra:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('lyra:writeFile', path, content),
  scanSamples: () => ipcRenderer.invoke('lyra:scanSamples'),
  saveRecording: (name, bytes) => ipcRenderer.invoke('lyra:saveRecording', name, bytes),
});
