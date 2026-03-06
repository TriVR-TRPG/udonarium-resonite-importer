/**
 * ImportUseCase — ライブインポート実行 (Phase 2)
 *
 * CLI と GUI の両方が呼び出す Inbound Port。
 * 現在は importRunner.runImport() に委譲。
 * 将来的には Preflight / Compile / Apply / Finalize の各段階を
 * このレイヤーで制御する。
 */

import { runImport } from './importRunner';
import type { ImportConfig, ImportOptions, ImportReport, ProgressEvent } from './contracts';

/**
 * ライブインポートを実行する。
 *
 * @param config  変換仕様・接続設定
 * @param options 実行制御
 * @param onProgress 進捗コールバック（任意）
 * @returns ImportReport
 */
export async function importToResonite(
  config: ImportConfig,
  options: ImportOptions,
  onProgress?: (event: ProgressEvent) => void
): Promise<ImportReport> {
  return runImport(config, options, onProgress);
}
