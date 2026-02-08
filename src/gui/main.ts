/**
 * Electron Main Process
 */

import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { extractZip } from '../parser/ZipExtractor';
import { parseXmlFiles } from '../parser/XmlParser';
import { convertObjectsWithTextureMap } from '../converter/ObjectConverter';
import { ResoniteLinkClient } from '../resonite/ResoniteLinkClient';
import { SlotBuilder } from '../resonite/SlotBuilder';
import { AssetImporter } from '../resonite/AssetImporter';
import { registerExternalUrls } from '../resonite/registerExternalUrls';
import { AnalyzeResult, ImportOptions, ImportResult } from './types';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Udonarium Resonite Importer',
  });

  void mainWindow.loadFile(path.join(__dirname, '../../src/gui/index.html'));

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

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const obj of parseResult.objects) {
      typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
    }

    return {
      success: true,
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

async function handleImportToResonite(options: ImportOptions): Promise<ImportResult> {
  const { filePath, host, port } = options;

  const sendProgress = (step: string, progress: number, detail?: string) => {
    mainWindow?.webContents.send('import-progress', {
      step,
      progress,
      detail,
    });
  };

  try {
    // Step 1: Extract ZIP
    sendProgress('extract', 0, 'ZIPファイルを解凍中...');
    const extractedData = extractZip(filePath);
    sendProgress('extract', 100);

    // Step 2: Parse objects
    sendProgress('parse', 0, 'オブジェクトを解析中...');
    const parseResult = parseXmlFiles(extractedData.xmlFiles);
    sendProgress('parse', 100);

    // Step 3: Connect to ResoniteLink
    sendProgress('connect', 0, 'ResoniteLinkに接続中...');
    const client = new ResoniteLinkClient({ host, port });
    await client.connect();
    sendProgress('connect', 100);

    // Step 4: Import
    sendProgress('import', 0, 'インポート中...');
    const assetImporter = new AssetImporter(client);
    const slotBuilder = new SlotBuilder(client);
    registerExternalUrls(parseResult.objects, assetImporter);

    // Create import group
    const groupName = `Udonarium Import - ${path.basename(filePath, '.zip')}`;
    await slotBuilder.createImportGroup(groupName);

    // Import images
    const totalImages = extractedData.imageFiles.length;
    const totalObjects = parseResult.objects.length;
    const totalSteps = totalImages + totalObjects;
    let currentStep = 0;

    const imageResults = await assetImporter.importImages(
      extractedData.imageFiles,
      (current, total) => {
        currentStep = current;
        sendProgress(
          'import',
          Math.floor((currentStep / totalSteps) * 100),
          `画像をインポート中... ${current}/${total}`
        );
      }
    );

    const resoniteObjects = convertObjectsWithTextureMap(
      parseResult.objects,
      assetImporter.getImportedTextures()
    );

    // Build slots
    const slotResults = await slotBuilder.buildSlots(resoniteObjects, (current, total) => {
      currentStep = totalImages + current;
      sendProgress(
        'import',
        Math.floor((currentStep / totalSteps) * 100),
        `オブジェクトを作成中... ${current}/${total}`
      );
    });

    client.disconnect();
    sendProgress('import', 100, '完了');

    const failedImages = imageResults.filter((r) => !r.success).length;
    const failedSlots = slotResults.filter((r) => !r.success).length;

    return {
      success: true,
      importedImages: totalImages - failedImages,
      totalImages,
      importedObjects: totalObjects - failedSlots,
      totalObjects,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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
