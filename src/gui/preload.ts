/**
 * Electron Preload Script
 * Exposes safe APIs to the renderer process
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  AnalyzeResult,
  DefaultConfig,
  ImportOptions,
  ImportResult,
  ProgressInfo,
  ElectronAPI,
} from './types';

const api: ElectronAPI = {
  getDefaultConfig: () => ipcRenderer.invoke('get-default-config') as Promise<DefaultConfig>,
  selectFile: () => ipcRenderer.invoke('select-file') as Promise<string | null>,
  analyzeZip: (filePath: string) =>
    ipcRenderer.invoke('analyze-zip', filePath) as Promise<AnalyzeResult>,
  importToResonite: (options: ImportOptions) =>
    ipcRenderer.invoke('import-to-resonite', options) as Promise<ImportResult>,
  onImportProgress: (callback: (info: ProgressInfo) => void) => {
    ipcRenderer.on('import-progress', (_event: IpcRendererEvent, info: unknown) => {
      callback(info as ProgressInfo);
    });
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
// renderer.ts is executed from preload context, so provide the same API there too.
(window as unknown as { electronAPI: ElectronAPI }).electronAPI = api;

// Renderer script is compiled as CommonJS. Load it from preload after DOM is ready
// so browser context does not execute CommonJS output directly.
window.addEventListener('DOMContentLoaded', () => {
  void import('./renderer.js');
});
