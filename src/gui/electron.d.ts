/**
 * Electron type declarations for when electron package is not installed
 */

declare module 'electron' {
  export interface BrowserWindowConstructorOptions {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    webPreferences?: {
      preload?: string;
      contextIsolation?: boolean;
      nodeIntegration?: boolean;
    };
    title?: string;
  }

  export class BrowserWindow {
    constructor(options?: BrowserWindowConstructorOptions);
    loadFile(filePath: string): Promise<void>;
    on(event: string, listener: () => void): this;
    webContents: {
      send(channel: string, ...args: unknown[]): void;
    };
    static getAllWindows(): BrowserWindow[];
  }

  export const app: {
    whenReady(): Promise<void>;
    on(event: string, listener: () => void): void;
    quit(): void;
  };

  export interface IpcMainInvokeEvent {
    frameId: number;
    sender: unknown;
    senderFrame: unknown;
  }

  export interface IpcRendererEvent {
    sender: unknown;
    senderId: number;
  }

  export const ipcMain: {
    handle<T>(
      channel: string,
      listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T> | T
    ): void;
  };

  export const ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void;
  };

  export const contextBridge: {
    exposeInMainWorld(apiKey: string, api: unknown): void;
  };

  export const dialog: {
    showOpenDialog(
      window: BrowserWindow,
      options: {
        properties?: string[];
        filters?: { name: string; extensions: string[] }[];
      }
    ): Promise<{ canceled: boolean; filePaths: string[] }>;
  };
}
