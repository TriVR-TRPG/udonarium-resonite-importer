/**
 * Neutralinojs Backend Extension
 *
 * Runs as a separate Node.js process and communicates with the
 * Neutralinojs app via WebSocket. Handles all Node.js-dependent
 * operations (ZIP extraction, image processing, ResoniteLink).
 */

import WebSocket from 'ws';
import * as path from 'path';
import { extractZip } from '../parser/ZipExtractor';
import { parseXmlFiles } from '../parser/XmlParser';
import { convertObjectsWithTextureMap } from '../converter/ObjectConverter';
import { buildImageAspectRatioMap, buildImageBlendModeMap } from '../converter/imageAspectRatioMap';
import { toTextureReference } from '../converter/objectConverters/componentBuilders';
import { prepareSharedMeshDefinitions, resolveSharedMeshReferences } from '../converter/sharedMesh';
import {
  prepareSharedMaterialDefinitions,
  resolveSharedMaterialReferences,
} from '../converter/sharedMaterial';
import { ResoniteLinkClient } from '../resonite/ResoniteLinkClient';
import { SlotBuilder } from '../resonite/SlotBuilder';
import { AssetImporter } from '../resonite/AssetImporter';
import { registerExternalUrls } from '../resonite/registerExternalUrls';
import { IMPORT_ROOT_TAG, VERIFIED_RESONITE_LINK_VERSION } from '../config/MappingConfig';
import { AnalyzeResult, ImportOptions, ImportResult } from '../gui/types';

// Parse command-line arguments from Neutralinojs
// Format: --nl-port=PORT --nl-token=TOKEN --nl-extension-id=ID
function parseArgs(): { port: string; token: string; extensionId: string } {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (const arg of args) {
    const match = arg.match(/^--nl-(\w+(?:-\w+)*)=(.+)$/);
    if (match) {
      const key = match[1].replace(/-/g, '_');
      parsed[key] = match[2];
    }
  }

  return {
    port: parsed['port'] || '0',
    token: parsed['token'] || '',
    extensionId: parsed['extension_id'] || '',
  };
}

const config = parseArgs();
let ws: WebSocket | null = null;
let messageId = 0;

/**
 * Connect to the Neutralinojs WebSocket server.
 */
function connect(): void {
  const url = `ws://localhost:${config.port}?extensionId=${config.extensionId}&connectToken=${config.token}`;

  ws = new WebSocket(url);

  ws.on('open', () => {
    console.log(`[backend] Connected to Neutralinojs on port ${config.port}`);
  });

  ws.on('message', (rawData: WebSocket.RawData) => {
    try {
      const text = Buffer.isBuffer(rawData)
        ? rawData.toString('utf-8')
        : ArrayBuffer.isView(rawData)
          ? Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength).toString('utf-8')
          : new TextDecoder().decode(rawData as ArrayBuffer);
      const message = JSON.parse(text) as {
        event: string;
        data?: Record<string, unknown>;
      };
      void handleMessage(message);
    } catch (err) {
      console.error('[backend] Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[backend] WebSocket closed, exiting');
    process.exit(0);
  });

  ws.on('error', (err: Error) => {
    console.error('[backend] WebSocket error:', err.message);
    process.exit(1);
  });
}

/**
 * Send an event back to the Neutralinojs app via broadcast.
 */
function sendEvent(event: string, data: unknown): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const message = {
    id: String(++messageId),
    method: 'app.broadcast',
    accessToken: config.token,
    data: { event, data },
  };

  ws.send(JSON.stringify(message));
}

/**
 * Handle incoming messages from the frontend.
 */
async function handleMessage(message: {
  event: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const { event, data } = message;

  switch (event) {
    case 'analyzeZip': {
      const requestId = data?.requestId as string;
      const filePath = data?.filePath as string;
      const result = handleAnalyzeZip(filePath);
      sendEvent('analyzeZipResult', { requestId, result });
      break;
    }
    case 'importToResonite': {
      const requestId = data?.requestId as string;
      const options = data?.options as ImportOptions;
      const result = await handleImportToResonite(options);
      sendEvent('importToResoniteResult', { requestId, result });
      break;
    }
    default:
      // Ignore unknown events
      break;
  }
}

/**
 * Analyze a ZIP file and return statistics.
 */
function handleAnalyzeZip(filePath: string): AnalyzeResult {
  try {
    const extractedData = extractZip(filePath);
    const parseResult = parseXmlFiles(extractedData.xmlFiles);

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

/**
 * Import objects into Resonite via ResoniteLink.
 */
async function handleImportToResonite(options: ImportOptions): Promise<ImportResult> {
  const { filePath, host, port } = options;

  const sendProgress = (step: string, progress: number, detail?: string) => {
    sendEvent('importProgress', { step, progress, detail });
  };

  try {
    // Step 1: Extract ZIP
    sendProgress('extract', 0, 'ZIPファイルを解凍中...');
    const extractedData = extractZip(filePath);
    sendProgress('extract', 100);

    // Step 2: Parse objects
    sendProgress('parse', 0, 'オブジェクトを解析中...');
    const parseResult = parseXmlFiles(extractedData.xmlFiles);
    const imageAspectRatioMap = await buildImageAspectRatioMap(
      extractedData.imageFiles,
      parseResult.objects
    );
    const imageBlendModeMap = await buildImageBlendModeMap(
      extractedData.imageFiles,
      parseResult.objects
    );
    sendProgress('parse', 100);

    // Step 3: Connect to ResoniteLink
    sendProgress('connect', 0, 'ResoniteLinkに接続中...');
    const client = new ResoniteLinkClient({ host, port });
    await client.connect();
    await warnVersionIfChangedForGui(client, (message) => {
      sendProgress('connect', 100, message);
    });
    sendProgress('connect', 100);

    // Step 4: Import
    sendProgress('import', 0, 'インポート中...');
    const assetImporter = new AssetImporter(client);
    const slotBuilder = new SlotBuilder(client);
    registerExternalUrls(parseResult.objects, assetImporter);
    const previousImport = await client.captureTransformAndRemoveRootChildrenByTag(IMPORT_ROOT_TAG);

    // Create import group
    const groupName = `Udonarium Import - ${path.basename(filePath, '.zip')}`;
    await slotBuilder.createImportGroup(groupName, previousImport.transform);

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

    const importedTextures = assetImporter.getImportedTextures();
    const textureReferenceMap = await slotBuilder.createTextureAssets(importedTextures);
    const textureComponentMap = new Map<string, string>();
    for (const [identifier] of importedTextures) {
      const componentId = textureReferenceMap.get(identifier);
      if (!componentId) {
        continue;
      }
      textureComponentMap.set(identifier, toTextureReference(componentId));
    }

    const resoniteObjects = convertObjectsWithTextureMap(
      parseResult.objects,
      textureComponentMap,
      imageAspectRatioMap,
      imageBlendModeMap
    );
    const sharedMeshDefinitions = prepareSharedMeshDefinitions(resoniteObjects);
    const meshReferenceMap = await slotBuilder.createMeshAssets(sharedMeshDefinitions);
    resolveSharedMeshReferences(resoniteObjects, meshReferenceMap);
    const sharedMaterialDefinitions = prepareSharedMaterialDefinitions(resoniteObjects);
    const materialReferenceMap = await slotBuilder.createMaterialAssets(sharedMaterialDefinitions);
    resolveSharedMaterialReferences(resoniteObjects, materialReferenceMap);

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

// Start the extension
connect();
