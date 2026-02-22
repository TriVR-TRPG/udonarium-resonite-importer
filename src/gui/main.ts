/**
 * Electron Main Process
 */

import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { extractZip } from '../parser/ZipExtractor';
import { parseXmlFiles } from '../parser/XmlParser';
import { convertObjectsWithImageAssetContext } from '../converter/ObjectConverter';
import { buildImageAspectRatioMap, buildImageBlendModeMap } from '../converter/imageAspectRatioMap';
import { buildImageAssetContext } from '../converter/imageAssetContext';
import { prepareSharedMeshDefinitions, resolveSharedMeshReferences } from '../converter/sharedMesh';
import {
  prepareSharedMaterialDefinitions,
  resolveSharedMaterialReferences,
} from '../converter/sharedMaterial';
import { ResoniteLinkClient } from '../resonite/ResoniteLinkClient';
import { SlotBuilder } from '../resonite/SlotBuilder';
import { AssetImporter } from '../resonite/AssetImporter';
import { registerExternalUrls } from '../resonite/registerExternalUrls';
import {
  IMPORT_GROUP_SCALE,
  IMPORT_ROOT_TAG,
  VERIFIED_RESONITE_LINK_VERSION,
} from '../config/MappingConfig';
import { AnalyzeResult, DefaultConfig, ImportOptions, ImportResult } from './types';

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

async function warnVersionIfChangedForGui(
  client: ResoniteLinkClient,
  onWarning: (message: string) => void
): Promise<void> {
  try {
    const sessionData = await client.getSessionData();
    const runtimeVersion = sessionData.resoniteLinkVersion;
    if (!runtimeVersion) {
      return;
    }

    if (runtimeVersion !== VERIFIED_RESONITE_LINK_VERSION) {
      onWarning(
        `ResoniteLink version changed: expected ${VERIFIED_RESONITE_LINK_VERSION}, connected ${runtimeVersion}. Please validate compatibility.`
      );
    }
  } catch (error) {
    onWarning(
      `Warning: Failed to check ResoniteLink version: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

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

async function handleImportToResonite(options: ImportOptions): Promise<ImportResult> {
  const {
    filePath,
    host,
    port,
    enableRootGrabbable,
    enableSimpleAvatarProtection = true,
    rootScale,
    enableCharacterColliderOnLockedTerrain,
    semiTransparentImageBlendMode,
  } = options;
  const resolvedHost = (typeof host === 'string' ? host : '').trim() || 'localhost';

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
    if (parseResult.objects.length === 0) {
      throw new Error(NO_PARSED_OBJECTS_ERROR);
    }
    const imageAspectRatioMap = await buildImageAspectRatioMap(
      extractedData.imageFiles,
      parseResult.objects
    );
    const imageBlendModeMap = await buildImageBlendModeMap(
      extractedData.imageFiles,
      parseResult.objects,
      { semiTransparentMode: semiTransparentImageBlendMode }
    );
    sendProgress('parse', 100);

    // Step 3: Connect to ResoniteLink
    sendProgress('connect', 0);
    const client = new ResoniteLinkClient({ host: resolvedHost, port });
    await client.connect();
    await warnVersionIfChangedForGui(client, (message) => {
      sendProgress('connect', 100, message);
    });
    sendProgress('connect', 100);

    // Step 4: Import
    sendProgress('import', 0, 'インポート中...');
    const assetImporter = new AssetImporter(client);
    const slotBuilder = new SlotBuilder(client);
    await registerExternalUrls(parseResult.objects, assetImporter);
    const previousImport = await client.captureTransformAndRemoveRootChildrenByTag(IMPORT_ROOT_TAG);

    // Create import group
    // When a previous import root exists, preserve its captured transform (including scale).
    // rootScale from the UI is only used as the default for fresh imports.
    const groupName = `Udonarium Import - ${path.basename(filePath, '.zip')}`;
    const defaultScale = { x: rootScale, y: rootScale, z: rootScale };
    await slotBuilder.createImportGroup(
      groupName,
      previousImport.transform,
      defaultScale,
      enableRootGrabbable,
      enableSimpleAvatarProtection
    );

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

    const importedImageAssetInfoMap = assetImporter.getImportedImageAssetInfoMap();
    await slotBuilder.createTextureAssetsWithUpdater(
      importedImageAssetInfoMap,
      (identifier, componentId) => {
        assetImporter.applyTextureReference(identifier, componentId);
      },
      enableSimpleAvatarProtection
    );

    const imageAssetContext = buildImageAssetContext({
      imageAssetInfoMap: assetImporter.getImportedImageAssetInfoMap(),
      imageAspectRatioMap,
      imageBlendModeMap,
    });
    const resoniteObjects = convertObjectsWithImageAssetContext(
      parseResult.objects,
      imageAssetContext,
      { enableCharacterColliderOnLockedTerrain },
      parseResult.extensions
    );
    const sharedMeshDefinitions = prepareSharedMeshDefinitions(resoniteObjects);
    const meshReferenceMap = await slotBuilder.createMeshAssets(sharedMeshDefinitions);
    resolveSharedMeshReferences(resoniteObjects, meshReferenceMap);
    const sharedMaterialDefinitions = prepareSharedMaterialDefinitions(resoniteObjects);
    const materialReferenceMap = await slotBuilder.createMaterialAssets(sharedMaterialDefinitions);
    resolveSharedMaterialReferences(resoniteObjects, materialReferenceMap);

    // Build slots
    const slotResults = await slotBuilder.buildSlots(
      resoniteObjects,
      (current, total) => {
        currentStep = totalImages + current;
        sendProgress(
          'import',
          Math.floor((currentStep / totalSteps) * 100),
          `オブジェクトを作成中... ${current}/${total}`
        );
      },
      { enableSimpleAvatarProtection }
    );

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
