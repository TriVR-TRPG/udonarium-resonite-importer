/**
 * Electron Main Process
 *
 * GUI Adapter (Phase 1)
 * GUI ImportOptions → ImportConfig + ImportOptions → runImport()
 */

import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { extractZip } from '../parser/ZipExtractor';
import { parseXmlFiles } from '../parser/XmlParser';
import { IMPORT_GROUP_SCALE } from '../config/MappingConfig';
import { AnalyzeResult, DefaultConfig, ImportOptions, ImportResult } from './types';
import { runImport } from '../application/importRunner';
import type {
  ImportConfig,
  ImportOptions as AppImportOptions,
  ProgressEvent,
} from '../application/contracts';

let mainWindow: BrowserWindow | null = null;
const NO_PARSED_OBJECTS_ERROR = 'No supported objects were found in the ZIP file.';
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

function handleAnalyzeZip(filePath: string): AnalyzeResult {
  try {
    const extractedData = extractZip(filePath);
    const parseResult = parseXmlFiles(extractedData.xmlFiles);
    const hasObjects = parseResult.objects.length > 0;

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const obj of parseResult.objects) {
      typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
    }

    return {
      success: hasObjects,
      ...(hasObjects ? {} : { error: NO_PARSED_OBJECTS_ERROR }),
      xmlCount: extractedData.xmlFiles.length,
      imageCount: extractedData.imageFiles.length,
      objectCount: parseResult.objects.length,
      typeCounts,
      errors: parseResult.errors.map((e) => `${e.file}: ${e.message}`),
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

ipcMain.handle('analyze-zip', (_event: IpcMainInvokeEvent, ...args: unknown[]): AnalyzeResult => {
  const filePath = args[0] as string;
  return handleAnalyzeZip(filePath);
});

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
    const report = await runImport(config, appOptions, onProgress);

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
      errorMessage === NO_PARSED_OBJECTS_ERROR ? NO_PARSED_OBJECTS_ERROR_CODE : 'UNKNOWN';

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
