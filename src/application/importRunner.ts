/**
 * importRunner — ライブインポート実行ロジック (Phase 3)
 *
 * CLI と GUI の両方が呼び出す共通実行関数。
 * Phase 3 より buildImportPlan()（共通 Compile パス）を使用する。
 *
 * フロー:
 *   Compile (buildImportPlan) → Connect → Cleanup → Apply → Finalize
 *
 * NOTE: Apply ステップでは実アップロード済み画像 ID を用いて
 *       オブジェクト変換を再実行する（テクスチャ参照解決のため）。
 *       Phase 4/5 で ImportPlan.slots から直接 Apply できるよう改善予定。
 */

import * as path from 'path';

import { buildImportPlan } from './compilePlan';
import { emitProgress } from './_progressEmit';
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
// runImport
// ---------------------------------------------------------------------------

/**
 * ライブインポートを実行する。
 *
 * @param config  変換仕様・接続設定
 * @param _options 実行制御（dry-run は AnalyzeUseCase 側で処理）
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
  // Phase: extract + parse + compile (共通パス)
  // -------------------------------------------------------------------------
  emitProgress(onProgress, 'extract', 0, 1, 'Extracting ZIP...');

  const compileResult = await buildImportPlan(config);

  diagnostics.push(...compileResult.diagnostics);

  const { parseStats, _compiled } = compileResult;

  if (parseStats.objectCount === 0) {
    throw new Error('No supported objects were found in the ZIP file.');
  }

  emitProgress(onProgress, 'parse', 1, 1, `Parsed ${parseStats.objectCount} objects`);

  // compileTimings には extract / parse / compile の個別タイミングが入っている
  Object.assign(stepTimings, compileResult.compileTimings);

  // -------------------------------------------------------------------------
  // Phase: connect
  // -------------------------------------------------------------------------
  let phaseStart = Date.now();
  emitProgress(
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

  try {
    const sessionData = await client.getSessionData();
    const runtimeVersion = sessionData.resoniteLinkVersion;
    if (runtimeVersion && runtimeVersion !== VERIFIED_RESONITE_LINK_VERSION) {
      const warnMsg =
        `ResoniteLink version changed: expected ${VERIFIED_RESONITE_LINK_VERSION}, ` +
        `connected ${runtimeVersion}. Please validate compatibility.`;
      diagnostics.push({ level: 'warn', code: 'VERSION_MISMATCH', message: warnMsg });
      emitProgress(onProgress, 'connect', 1, 1, warnMsg, 'warn');
    }
  } catch (error) {
    const warnMsg = `Failed to check ResoniteLink version: ${error instanceof Error ? error.message : String(error)}`;
    diagnostics.push({ level: 'warn', code: 'VERSION_CHECK_FAILED', message: warnMsg });
    emitProgress(onProgress, 'connect', 1, 1, warnMsg, 'warn');
  }

  emitProgress(onProgress, 'connect', 1, 1, 'Connected to ResoniteLink');
  stepTimings['connect'] = Date.now() - phaseStart;

  const assetImporter = new AssetImporter(client);
  const slotBuilder = new SlotBuilder(client);
  let connected = true;

  try {
    // -----------------------------------------------------------------------
    // Phase: cleanup（旧インポート削除）
    // -----------------------------------------------------------------------
    phaseStart = Date.now();
    emitProgress(onProgress, 'cleanup', 0, 1, 'Removing previous import...');

    await registerExternalUrls(_compiled.parsedObjects, assetImporter);
    const previousImport = await client.captureTransformAndRemoveRootChildrenByTag(IMPORT_ROOT_TAG);

    emitProgress(onProgress, 'cleanup', 1, 1, 'Previous import removed');
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

    const totalImages = _compiled.imageFiles.length;
    const totalObjects = parseStats.objectCount;
    const totalSteps = totalImages + totalObjects;

    // 画像インポート前のルート子スロット一覧を記録
    const rootChildIdsBefore = await client.getSlotChildIds('Root');

    const imageResults = await assetImporter.importImages(
      _compiled.imageFiles,
      (current, total) => {
        emitProgress(
          onProgress,
          'apply',
          current,
          totalSteps,
          `Importing images (${current}/${total})...`
        );
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

    // テクスチャ参照解決のため、実アップロード済み ID で imageAssetContext を再構築し
    // オブジェクト変換を再実行する。
    // NOTE: Compile ステップが dry-run ID で変換済みの _compiled.resoniteObjects とは別に
    //       実 ID 版を生成する。Phase 4/5 で ImportPlan.slots ベースの Apply に移行予定。
    const liveImageAssetContext = buildImageAssetContext({
      imageAssetInfoMap: assetImporter.getImportedImageAssetInfoMap(),
      imageAspectRatioMap: _compiled.imageAspectRatioMap,
      imageBlendModeMap: _compiled.imageBlendModeMap,
    });

    const liveResoniteObjects = convertObjectsWithImageAssetContext(
      _compiled.parsedObjects,
      liveImageAssetContext,
      { enableCharacterColliderOnLockedTerrain: config.enableCharacterCollider },
      _compiled.parsedExtensions
    );

    const liveSharedMeshDefs = prepareSharedMeshDefinitions(liveResoniteObjects);
    const meshReferenceMap = await slotBuilder.createMeshAssets(liveSharedMeshDefs);
    resolveSharedMeshReferences(liveResoniteObjects, meshReferenceMap);

    const liveSharedMaterialDefs = prepareSharedMaterialDefinitions(liveResoniteObjects);
    const materialReferenceMap = await slotBuilder.createMaterialAssets(liveSharedMaterialDefs);
    resolveSharedMaterialReferences(liveResoniteObjects, materialReferenceMap);

    const slotResults = await slotBuilder.buildSlots(
      liveResoniteObjects,
      (current, _total) => {
        emitProgress(
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
    emitProgress(onProgress, 'finalize', 0, 1, 'Finalizing import...');

    await slotBuilder.tagImportGroupRoot(groupId);

    connected = false;
    client.disconnect();

    emitProgress(onProgress, 'finalize', 1, 1, 'Import complete');
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
