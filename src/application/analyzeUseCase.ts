/**
 * AnalyzeUseCase — ZIP 解析・変換可能性評価 (Phase 2)
 *
 * 副作用最小で ZIP を解析し、変換結果のプレビューを返す。
 * Resonite 未起動でも実行可能。同一入力で決定的結果。
 *
 * CLI dry-run と GUI analyze の共通ロジック。
 */

import { extractZip } from '../parser/ZipExtractor';
import { parseXmlFiles } from '../parser/XmlParser';
import { buildImageAspectRatioMap, buildImageBlendModeMap } from '../converter/imageAspectRatioMap';
import { buildImageAssetContext } from '../converter/imageAssetContext';
import { convertObjectsWithImageAssetContext } from '../converter/ObjectConverter';
import { buildDryRunImageAssetInfoMap } from '../resonite/dryRunImageAssetInfo';

import type {
  ImportConfig,
  ImportOptions,
  AnalyzeOutput,
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
// analyze
// ---------------------------------------------------------------------------

/**
 * ZIP を解析し、変換可能性を評価する。
 *
 * @param config  変換仕様（`inputZipPath` と画像設定を使用。`resonite` 接続設定は不要）
 * @param _options 実行制御（将来の verbose 詳細出力向け）
 * @param onProgress 進捗コールバック（任意）
 * @returns AnalyzeOutput
 * @throws ZIP 展開失敗 / パースエラー
 */
export async function analyze(
  config: ImportConfig,
  _options: ImportOptions,
  onProgress?: (event: ProgressEvent) => void
): Promise<AnalyzeOutput> {
  const startTime = Date.now();
  const diagnostics: DiagnosticEntry[] = [];

  // -------------------------------------------------------------------------
  // Phase: extract
  // -------------------------------------------------------------------------
  emit(onProgress, 'extract', 0, 1, 'Extracting ZIP...');
  const extractedData = extractZip(config.inputZipPath);
  emit(onProgress, 'extract', 1, 1, 'ZIP extracted');

  // -------------------------------------------------------------------------
  // Phase: parse
  // -------------------------------------------------------------------------
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
    return {
      summary: {
        xmlCount: extractedData.xmlFiles.length,
        imageCount: extractedData.imageFiles.length,
        objectCount: 0,
        typeCounts: {},
      },
      convertedObjects: [],
      diagnostics: [
        ...diagnostics,
        {
          level: 'error',
          code: 'NO_OBJECTS',
          message: 'No supported objects were found in the ZIP file.',
        },
      ],
      performance: { durationMs: Date.now() - startTime },
    };
  }

  // typeCounts 集計
  const typeCounts: Record<string, number> = {};
  for (const obj of parseResult.objects) {
    typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
  }

  // -------------------------------------------------------------------------
  // 画像メタデータ解析 + オブジェクト変換
  // -------------------------------------------------------------------------
  const imageAspectRatioMap = await buildImageAspectRatioMap(
    extractedData.imageFiles,
    parseResult.objects
  );
  const imageBlendModeMap = await buildImageBlendModeMap(
    extractedData.imageFiles,
    parseResult.objects,
    { semiTransparentMode: config.transparentBlendMode }
  );
  const imageAssetInfoMap = buildDryRunImageAssetInfoMap(
    extractedData.imageFiles,
    parseResult.objects
  );
  const imageAssetContext = buildImageAssetContext({
    imageAssetInfoMap,
    imageAspectRatioMap,
    imageBlendModeMap,
  });

  const resoniteObjects = convertObjectsWithImageAssetContext(
    parseResult.objects,
    imageAssetContext,
    { enableCharacterColliderOnLockedTerrain: config.enableCharacterCollider },
    parseResult.extensions
  );

  emit(
    onProgress,
    'parse',
    1,
    1,
    `Parsed ${parseResult.objects.length} objects, ${extractedData.imageFiles.length} images`
  );

  // -------------------------------------------------------------------------
  // AnalyzeOutput を組み立てて返す
  // -------------------------------------------------------------------------
  return {
    summary: {
      xmlCount: extractedData.xmlFiles.length,
      imageCount: extractedData.imageFiles.length,
      objectCount: resoniteObjects.length,
      typeCounts,
    },
    convertedObjects: resoniteObjects.map((obj) => ({
      name: obj.name,
      id: obj.id,
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    })),
    diagnostics,
    performance: { durationMs: Date.now() - startTime },
  };
}
