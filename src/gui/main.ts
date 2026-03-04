/**
 * Electron Main Process
 *
 * GUI Adapter (Phase 1)
 * GUI ImportOptions → ImportConfig + ImportOptions → runImport()
 */

import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { IMPORT_GROUP_SCALE } from '../config/MappingConfig';
import { AnalyzeResult, DefaultConfig, ImportOptions, ImportResult } from './types';
import { analyze } from '../application/analyzeUseCase';
import { importToResonite } from '../application/importUseCase';
import type {
  ImportConfig,
  ImportOptions as AppImportOptions,
  ProgressEvent,
} from '../application/contracts';

let mainWindow: BrowserWindow | null = null;
const NO_PARSED_OBJECTS_ERROR_CODE: ImportResult['errorCode'] = 'NO_PARSED_OBJECTS';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 500,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Udonarium Resonite Importer',
  });

  void mainWindow.loadFile(path.join(__dirname, '../../src/gui/index.html'));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

void app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

ipcMain.handle('get-default-config', (): DefaultConfig => {
  return { importGroupScale: IMPORT_GROUP_SCALE };
});

ipcMain.handle('select-file', async (): Promise<string | null> => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

async function handleAnalyzeZip(filePath: string): Promise<AnalyzeResult> {
  const minimalConfig: ImportConfig = {
    inputZipPath: filePath,
    resonite: { host: 'localhost', port: 0 },
    rootScale: 1,
    rootGrabbable: false,
    simpleAvatarProtection: true,
    transparentBlendMode: 'Cutout',
    enableCharacterCollider: true,
  };
  try {
    const output = await analyze(minimalConfig, { dryRun: true, verbose: false });
    const hasErrors = output.diagnostics.some((d) => d.level === 'error');
    const errorMsg = output.diagnostics.find((d) => d.level === 'error')?.message;
    return {
      success: !hasErrors,
      ...(hasErrors ? { error: errorMsg } : {}),
      xmlCount: output.summary.xmlCount,
      imageCount: output.summary.imageCount,
      objectCount: output.summary.objectCount,
      typeCounts: output.summary.typeCounts,
      errors: output.diagnostics.filter((d) => d.code === 'PARSE_WARNING').map((d) => d.message),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      xmlCount: 0,
      imageCount: 0,
      objectCount: 0,
      typeCounts: {},
      errors: [],
    };
  }
}

ipcMain.handle(
  'analyze-zip',
  async (_event: IpcMainInvokeEvent, ...args: unknown[]): Promise<AnalyzeResult> => {
    const filePath = args[0] as string;
    return handleAnalyzeZip(filePath);
  }
);

// ---------------------------------------------------------------------------
// GUI Adapter: GUI ImportOptions → ImportConfig + AppImportOptions
// ---------------------------------------------------------------------------

function buildImportConfig(options: ImportOptions): ImportConfig {
  const resolvedHost = (typeof options.host === 'string' ? options.host : '').trim() || 'localhost';
  return {
    inputZipPath: options.filePath,
    resonite: { host: resolvedHost, port: options.port },
    rootScale: options.rootScale,
    rootGrabbable: options.enableRootGrabbable,
    simpleAvatarProtection: options.enableSimpleAvatarProtection ?? true,
    transparentBlendMode: options.semiTransparentImageBlendMode,
    enableCharacterCollider: options.enableCharacterColliderOnLockedTerrain,
  };
}

function buildAppImportOptions(): AppImportOptions {
  return { dryRun: false, verbose: false };
}

// ---------------------------------------------------------------------------
// handleImportToResonite — runImport() を呼び出して GUI に進捗を通知
// ---------------------------------------------------------------------------

async function handleImportToResonite(options: ImportOptions): Promise<ImportResult> {
  const config = buildImportConfig(options);
  const appOptions = buildAppImportOptions();

  const sendProgress = (step: string, progress: number, detail?: string) => {
    mainWindow?.webContents.send('import-progress', { step, progress, detail });
  };

  // ProgressEvent → GUI progress マッピング
  const phaseToStep: Partial<Record<ProgressEvent['phase'], string>> = {
    extract: 'extract',
    parse: 'parse',
    connect: 'connect',
    cleanup: 'import',
    apply: 'import',
    finalize: 'import',
  };

  let lastPhase: ProgressEvent['phase'] | null = null;
  const onProgress = (event: ProgressEvent) => {
    const step = phaseToStep[event.phase] ?? event.phase;

    if (event.phase !== lastPhase) {
      lastPhase = event.phase;
      sendProgress(step, 0, event.message);
    }

    if (event.total > 0) {
      const progress = Math.floor((event.current / event.total) * 100);
      sendProgress(step, progress, event.message);
    }

    if (event.level === 'warn') {
      sendProgress(step, -1, event.message);
    }
  };

  try {
    const report = await importToResonite(config, appOptions, onProgress);

    sendProgress('complete', 100);

    const { images, objects } = report.summary;
    return {
      success: true,
      importedImages: images.success,
      totalImages: images.total,
      importedObjects: objects.success,
      totalObjects: objects.total,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode: ImportResult['errorCode'] =
      errorMessage === 'No supported objects were found in the ZIP file.'
        ? NO_PARSED_OBJECTS_ERROR_CODE
        : 'UNKNOWN';

    return {
      success: false,
      error: errorMessage,
      errorCode,
      importedImages: 0,
      totalImages: 0,
      importedObjects: 0,
      totalObjects: 0,
    };
  }
}

ipcMain.handle(
  'import-to-resonite',
  async (_event: IpcMainInvokeEvent, ...args: unknown[]): Promise<ImportResult> => {
    const options = args[0] as ImportOptions;
    return handleImportToResonite(options);
  }
);
