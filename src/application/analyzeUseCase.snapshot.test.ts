/**
 * QA-001: AnalyzeOutput スナップショットテスト (Phase 3 準備)
 *
 * fixture ZIP に対して analyze() を実行し、AnalyzeOutput の構造を
 * スナップショットとして記録する。
 *
 * 目的:
 * - analyze() の出力が fixture 変更時に意図せず変わっていないことを検証
 * - Phase 3 で ImportPlan builder が導入された際は同テストでプランも検証する
 *
 * 注意:
 * - performance フィールドは時間依存のため除外する
 * - convertedObjects の id フィールドは PRNG 依存のため固定値を想定
 *   (UdonariumObject の id はパース時に XML から取得するため決定的)
 */

import * as path from 'path';
import { describe, expect, it } from 'vitest';

import { analyze } from './analyzeUseCase';
import type { ImportConfig, ImportOptions } from './contracts';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function makeConfig(zipName: string): ImportConfig {
  return {
    inputZipPath: path.join(process.cwd(), 'src', '__fixtures__', zipName),
    resonite: { host: 'localhost', port: 0 },
    rootScale: 1,
    rootGrabbable: false,
    simpleAvatarProtection: true,
    transparentBlendMode: 'Cutout',
    enableCharacterCollider: true,
  };
}

const OPTIONS: ImportOptions = { dryRun: true, verbose: false };

/**
 * スナップショット用に正規化する。
 * - performance: 時間依存のため除外
 * - convertedObjects[].id: randomUUID() 由来のため除外し name + position のみ残す
 */
function normalizeOutput(output: Awaited<ReturnType<typeof analyze>>) {
  // performance は時間依存、id は randomUUID 依存のため除外
  return {
    summary: output.summary,
    diagnostics: output.diagnostics,
    convertedObjects: output.convertedObjects.map(({ name, position }) => ({ name, position })),
  };
}

/** 画像処理を含む大型 fixture のタイムアウト (ms) */
const ANALYZE_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// スナップショットテスト
// ---------------------------------------------------------------------------

describe('AnalyzeOutput snapshot (QA-001)', () => {
  it(
    'sample-dice.zip — summary + diagnostics + convertedObjects',
    async () => {
      const output = await analyze(makeConfig('sample-dice.zip'), OPTIONS);
      expect(normalizeOutput(output)).toMatchSnapshot();
    },
    ANALYZE_TIMEOUT
  );

  it(
    'sample-card.zip — summary + diagnostics + convertedObjects',
    async () => {
      const output = await analyze(makeConfig('sample-card.zip'), OPTIONS);
      expect(normalizeOutput(output)).toMatchSnapshot();
    },
    ANALYZE_TIMEOUT
  );

  it(
    'sample-table.zip — summary + diagnostics + convertedObjects',
    async () => {
      const output = await analyze(makeConfig('sample-table.zip'), OPTIONS);
      expect(normalizeOutput(output)).toMatchSnapshot();
    },
    ANALYZE_TIMEOUT
  );

  it(
    'sample-terrain.zip — summary + diagnostics + convertedObjects',
    async () => {
      const output = await analyze(makeConfig('sample-terrain.zip'), OPTIONS);
      expect(normalizeOutput(output)).toMatchSnapshot();
    },
    ANALYZE_TIMEOUT
  );

  it(
    'sample-character.zip — summary + diagnostics + convertedObjects',
    async () => {
      const output = await analyze(makeConfig('sample-character.zip'), OPTIONS);
      expect(normalizeOutput(output)).toMatchSnapshot();
    },
    ANALYZE_TIMEOUT
  );

  it('sample-blank-data.zip — NO_OBJECTS エラーを返す', async () => {
    const output = await analyze(makeConfig('sample-blank-data.zip'), OPTIONS);
    expect(output.summary.objectCount).toBe(0);
    expect(output.diagnostics.some((d) => d.code === 'NO_OBJECTS')).toBe(true);
  });

  it(
    'sample-all-object.zip — 全オブジェクト種別が含まれる',
    async () => {
      const output = await analyze(makeConfig('sample-all-object.zip'), OPTIONS);
      expect(output.summary.objectCount).toBeGreaterThan(0);
      expect(normalizeOutput(output)).toMatchSnapshot();
    },
    ANALYZE_TIMEOUT
  );
});
