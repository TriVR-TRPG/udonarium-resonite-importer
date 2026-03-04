/**
 * importRunner — 共通インポート実行ロジック (Phase 1)
 *
 * CLI と GUI の両方が呼び出す共通実行関数。
 * "Functional Core, Imperative Shell" の「Shell」に相当し、
 * 外部副作用（ResoniteLink 操作・ファイルIO）を担当する。
 *
 * dry-run は Phase 2 で AnalyzeUseCase として分離予定。
 * Phase 1 ではライブインポートのみを扱う。
 */

import * as path from 'path';

import { extractZip } from '../parser/ZipExtractor';
import { parseXmlFiles } from '../parser/XmlParser';
import { buildImageAspectRatioMap, buildImageBlendModeMap } from '../converter/imageAspectRatioMap';
import { buildImageAssetContext } from '../converter/imageAssetContext';
import { convertObjectsWithImageAssetContext } from '../converter/ObjectConverter';
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

import type {
  ImportConfig,
  ImportOptions,
  ImportReport,
  DiagnosticEntry,
  ProgressEvent,
  ProgressPhase,
} from './contracts';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function emit(
  onProgress: ((event: ProgressEvent) => void) | undefined,
  phase: ProgressPhase,
  current: number,
  total: number,
  message: string,
  level: ProgressEvent['level'] = 'info'
): void {
  onProgress?.({ phase, current, total, message, level, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// runImport
// ---------------------------------------------------------------------------

/**
 * ライブインポートを実行する。
 *
 * @param config  変換仕様・接続設定
 * @param _options 実行制御（Phase 1 では dry-run は未サポート、CLI 側で処理）
 * @param onProgress 進捗コールバック（任意）
 * @returns ImportReport
 * @throws ZIP 展開失敗 / パースエラー / 接続失敗 / 致命的な Apply エラー
 */
export async function runImport(
  config: ImportConfig,
  _options: ImportOptions,
  onProgress?: (event: ProgressEvent) => void
): Promise<ImportReport> {
  const startTime = Date.now();
  const stepTimings: Partial<Record<ProgressPhase, number>> = {};
  const diagnostics: DiagnosticEntry[] = [];

  // -------------------------------------------------------------------------
  // Phase: extract
  // -------------------------------------------------------------------------
  let phaseStart = Date.now();
  emit(onProgress, 'extract', 0, 1, 'Extracting ZIP...');
  const extractedData = extractZip(config.inputZipPath);
  emit(onProgress, 'extract', 1, 1, 'ZIP extracted');
  stepTimings['extract'] = Date.now() - phaseStart;

  // -------------------------------------------------------------------------
  // Phase: parse
  // -------------------------------------------------------------------------
  phaseStart = Date.now();
  emit(onProgress, 'parse', 0, 1, 'Parsing XML files...');

  const parseResult = parseXmlFiles(extractedData.xmlFiles);

  for (const err of parseResult.errors) {
    diagnostics.push({
      level: 'warn',
      code: 'PARSE_WARNING',
      message: `${err.file}: ${err.message}`,
    });
  }

  if (parseResult.objects.length === 0) {
    throw new Error('No supported objects were found in the ZIP file.');
  }

  const imageAspectRatioMap = await buildImageAspectRatioMap(
    extractedData.imageFiles,
    parseResult.objects
  );
  const imageBlendModeMap = await buildImageBlendModeMap(
    extractedData.imageFiles,
    parseResult.objects,
    { semiTransparentMode: config.transparentBlendMode }
  );

  emit(onProgress, 'parse', 1, 1, `Parsed ${parseResult.objects.length} objects`);
  stepTimings['parse'] = Date.now() - phaseStart;

  // -------------------------------------------------------------------------
  // Phase: connect
  // -------------------------------------------------------------------------
  phaseStart = Date.now();
  emit(
    onProgress,
    'connect',
    0,
    1,
    `Connecting to ResoniteLink at ${config.resonite.host}:${config.resonite.port}...`
  );

  const client = new ResoniteLinkClient({
    host: config.resonite.host,
    port: config.resonite.port,
  });
  await client.connect();

  // バージョン確認（不一致は警告として記録）
  try {
    const sessionData = await client.getSessionData();
    const runtimeVersion = sessionData.resoniteLinkVersion;
    if (runtimeVersion && runtimeVersion !== VERIFIED_RESONITE_LINK_VERSION) {
      const warnMsg =
        `ResoniteLink version changed: expected ${VERIFIED_RESONITE_LINK_VERSION}, ` +
        `connected ${runtimeVersion}. Please validate compatibility.`;
      diagnostics.push({ level: 'warn', code: 'VERSION_MISMATCH', message: warnMsg });
      emit(onProgress, 'connect', 1, 1, warnMsg, 'warn');
    }
  } catch (error) {
    const warnMsg = `Failed to check ResoniteLink version: ${error instanceof Error ? error.message : String(error)}`;
    diagnostics.push({ level: 'warn', code: 'VERSION_CHECK_FAILED', message: warnMsg });
    emit(onProgress, 'connect', 1, 1, warnMsg, 'warn');
  }

  emit(onProgress, 'connect', 1, 1, 'Connected to ResoniteLink');
  stepTimings['connect'] = Date.now() - phaseStart;

  const assetImporter = new AssetImporter(client);
  const slotBuilder = new SlotBuilder(client);
  let connected = true;

  try {
    // -----------------------------------------------------------------------
    // Phase: cleanup（旧インポート削除）
    // -----------------------------------------------------------------------
    phaseStart = Date.now();
    emit(onProgress, 'cleanup', 0, 1, 'Removing previous import...');

    await registerExternalUrls(parseResult.objects, assetImporter);
    const previousImport = await client.captureTransformAndRemoveRootChildrenByTag(IMPORT_ROOT_TAG);

    emit(onProgress, 'cleanup', 1, 1, 'Previous import removed');
    stepTimings['cleanup'] = Date.now() - phaseStart;

    // -----------------------------------------------------------------------
    // Phase: apply
    // -----------------------------------------------------------------------
    phaseStart = Date.now();

    const groupName = `Udonarium Import - ${path.basename(config.inputZipPath, '.zip')}`;
    const defaultScale = { x: config.rootScale, y: config.rootScale, z: config.rootScale };
    const groupId = await slotBuilder.createImportGroup(
      groupName,
      previousImport.transform,
      defaultScale,
      config.rootGrabbable,
      config.simpleAvatarProtection
    );

    const totalImages = extractedData.imageFiles.length;
    const totalObjects = parseResult.objects.length;
    const totalSteps = totalImages + totalObjects;

    // 画像インポート前のルート子スロット一覧を記録（後でテクスチャスロットをグループに移動）
    const rootChildIdsBefore = await client.getSlotChildIds('Root');

    const imageResults = await assetImporter.importImages(
      extractedData.imageFiles,
      (current, total) => {
        emit(onProgress, 'apply', current, totalSteps, `Importing images (${current}/${total})...`);
      }
    );

    // 新たに作成されたテクスチャスロットをインポートグループ内に移動
    const rootChildIdsAfter = await client.getSlotChildIds('Root');
    const beforeSet = new Set(rootChildIdsBefore);
    const newSlotIds = rootChildIdsAfter.filter((id) => !beforeSet.has(id));
    for (const slotId of newSlotIds) {
      try {
        await client.reparentSlot(slotId, groupId);
      } catch {
        // 非致命的: テクスチャスロットがルートに残るだけ
      }
    }

    const importedImageAssetInfoMap = assetImporter.getImportedImageAssetInfoMap();
    await slotBuilder.createTextureAssetsWithUpdater(
      importedImageAssetInfoMap,
      (identifier, componentId) => {
        assetImporter.applyTextureReference(identifier, componentId);
      },
      config.simpleAvatarProtection
    );

    const imageAssetContext = buildImageAssetContext({
      imageAssetInfoMap: assetImporter.getImportedImageAssetInfoMap(),
      imageAspectRatioMap,
      imageBlendModeMap,
    });

    const resoniteObjects = convertObjectsWithImageAssetContext(
      parseResult.objects,
      imageAssetContext,
      { enableCharacterColliderOnLockedTerrain: config.enableCharacterCollider },
      parseResult.extensions
    );

    const sharedMeshDefinitions = prepareSharedMeshDefinitions(resoniteObjects);
    const meshReferenceMap = await slotBuilder.createMeshAssets(sharedMeshDefinitions);
    resolveSharedMeshReferences(resoniteObjects, meshReferenceMap);

    const sharedMaterialDefinitions = prepareSharedMaterialDefinitions(resoniteObjects);
    const materialReferenceMap = await slotBuilder.createMaterialAssets(sharedMaterialDefinitions);
    resolveSharedMaterialReferences(resoniteObjects, materialReferenceMap);

    const slotResults = await slotBuilder.buildSlots(
      resoniteObjects,
      (current, _total) => {
        emit(
          onProgress,
          'apply',
          totalImages + current,
          totalSteps,
          `Importing objects (${current}/${totalObjects})...`
        );
      },
      { enableSimpleAvatarProtection: config.simpleAvatarProtection }
    );

    stepTimings['apply'] = Date.now() - phaseStart;

    // -----------------------------------------------------------------------
    // Phase: finalize
    // -----------------------------------------------------------------------
    phaseStart = Date.now();
    emit(onProgress, 'finalize', 0, 1, 'Finalizing import...');

    await slotBuilder.tagImportGroupRoot(groupId);

    connected = false;
    client.disconnect();

    emit(onProgress, 'finalize', 1, 1, 'Import complete');
    stepTimings['finalize'] = Date.now() - phaseStart;

    // -----------------------------------------------------------------------
    // ImportReport を組み立てて返す
    // -----------------------------------------------------------------------
    const failedImages = imageResults.filter((r) => !r.success).length;
    const failedObjects = slotResults.filter((r) => !r.success).length;

    for (const img of imageResults.filter((r) => !r.success)) {
      diagnostics.push({
        level: 'warn',
        code: 'IMAGE_IMPORT_FAILED',
        message: `Failed to import image ${img.identifier}: ${img.error ?? 'unknown'}`,
      });
    }
    for (const slot of slotResults.filter((r) => !r.success)) {
      diagnostics.push({
        level: 'warn',
        code: 'SLOT_BUILD_FAILED',
        message: `Failed to build slot ${slot.slotId}: ${slot.error ?? 'unknown'}`,
      });
    }

    return {
      summary: {
        images: {
          total: totalImages,
          success: totalImages - failedImages,
          failed: failedImages,
        },
        objects: {
          total: totalObjects,
          success: totalObjects - failedObjects,
          failed: failedObjects,
        },
        components: { total: 0, success: 0, failed: 0 },
      },
      diagnostics,
      artifacts: { importRootId: groupId },
      performance: {
        durationMs: Date.now() - startTime,
        stepTimings,
      },
    };
  } finally {
    assetImporter.cleanup();
    if (connected) {
      client.disconnect();
    }
  }
}
