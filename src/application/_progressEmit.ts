/**
 * _progressEmit — ProgressEvent 送出ヘルパー（内部共有）
 *
 * analyzeUseCase / importRunner で同一の emit 関数を共有する。
 * アンダースコアプレフィックスは「application 層内部専用」を示す。
 */

import type { ProgressEvent, ProgressPhase } from './contracts';

export function emitProgress(
  onProgress: ((event: ProgressEvent) => void) | undefined,
  phase: ProgressPhase,
  current: number,
  total: number,
  message: string,
  level: ProgressEvent['level'] = 'info'
): void {
  onProgress?.({ phase, current, total, message, level, timestamp: Date.now() });
}
