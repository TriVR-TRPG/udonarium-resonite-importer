/**
 * Electron Preload Script
 * Exposes safe APIs to the renderer process
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  AnalyzeResult,
  ImportOptions,
  ImportResult,
  ProgressInfo,
  ElectronAPI,
} from './types';

const api: ElectronAPI = {
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
