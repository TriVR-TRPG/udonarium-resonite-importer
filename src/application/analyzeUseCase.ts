/**
 * AnalyzeUseCase — ZIP 解析・変換可能性評価 (Phase 2 → Phase 3)
 *
 * 副作用最小で ZIP を解析し、変換結果のプレビューを返す。
 * Resonite 未起動でも実行可能。同一入力で決定的結果。
 *
 * CLI dry-run と GUI analyze の共通ロジック。
 * Phase 3 より buildImportPlan() (共通 Compile パス) を使用する。
 */

import { buildImportPlan } from './compilePlan';

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
  // Phase: extract + parse + compile (共通パス)
  // -------------------------------------------------------------------------
  emit(onProgress, 'extract', 0, 1, 'Extracting ZIP...');

  const { plan, parseStats, diagnostics: compileDiagnostics } = await buildImportPlan(config);

  diagnostics.push(...compileDiagnostics);

  emit(onProgress, 'extract', 1, 1, 'ZIP extracted');

  if (parseStats.objectCount === 0) {
    return {
      summary: {
        xmlCount: parseStats.xmlCount,
        imageCount: parseStats.imageCount,
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

  emit(
    onProgress,
    'parse',
    1,
    1,
    `Parsed ${parseStats.objectCount} objects, ${parseStats.imageCount} images`
  );

  // -------------------------------------------------------------------------
  // AnalyzeOutput を組み立てて返す
  // -------------------------------------------------------------------------
  return {
    summary: {
      xmlCount: parseStats.xmlCount,
      imageCount: parseStats.imageCount,
      objectCount: parseStats.objectCount,
      typeCounts: parseStats.typeCounts,
    },
    convertedObjects: plan.slots.map((slot) => ({
      name: slot.name,
      id: slot.logicalId,
      position: { x: slot.position.x, y: slot.position.y, z: slot.position.z },
    })),
    diagnostics,
    performance: { durationMs: Date.now() - startTime },
  };
}
