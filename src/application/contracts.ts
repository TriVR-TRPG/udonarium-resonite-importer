/**
 * Application-layer contracts (Phase 1)
 *
 * These types define the public interface between the Interface Layer (CLI/GUI adapters)
 * and the Application Layer (importRunner / future UseCases).
 *
 * ImportConfig  — "what to convert and where to send it" (pure spec, no runtime control)
 * ImportOptions — "how to run it" (dry-run, verbose, etc.)
 */

// ---------------------------------------------------------------------------
// ImportConfig — 変換仕様・接続設定
// ---------------------------------------------------------------------------

export interface ImportConfig {
  /** ZIP ファイルの絶対パス */
  inputZipPath: string;

  /** ResoniteLink 接続設定 */
  resonite: {
    host: string;
    port: number;
  };

  /** インポートグループのスケール (default: 1.0, > 0) */
  rootScale: number;

  /** インポートグループルートに Grabbable を付与するか (default: false) */
  rootGrabbable: boolean;

  /** SimpleAvatarProtection コンポーネントを付与するか (default: true) */
  simpleAvatarProtection: boolean;

  /**
   * 半透明画像のブレンドモード (default: 'Cutout')
   * 'Cutout': アルファ閾値でマスク
   * 'Alpha': アルファブレンド
   */
  transparentBlendMode: 'Cutout' | 'Alpha';

  /**
   * ロック済みテレインにキャラクターコライダーを付与するか (default: true)
   */
  enableCharacterCollider: boolean;
}

// ---------------------------------------------------------------------------
// ImportOptions — 実行制御
// ---------------------------------------------------------------------------

export interface ImportOptions {
  /** true の場合、Resonite への反映をスキップして解析結果のみ返す (default: false) */
  dryRun: boolean;

  /** true の場合、詳細ログを ProgressEvent として通知する (default: false) */
  verbose: boolean;
}

// ---------------------------------------------------------------------------
// ProgressEvent — 進捗通知
// ---------------------------------------------------------------------------

export type ProgressPhase =
  | 'extract' // ZIP 読込・展開
  | 'parse' // XML 抽出・パース・正規化・画像メタ推定
  | 'compile' // オブジェクト変換・ImportPlan 生成（将来用）
  | 'connect' // ResoniteLink 接続・Preflight 検証
  | 'cleanup' // Pre-cleanup（旧インポート削除）
  | 'apply' // Asset/Material/Mesh/Slot 適用
  | 'finalize'; // タグ付け・結果集計

export interface ProgressEvent {
  phase: ProgressPhase;
  /** 現在の処理数 */
  current: number;
  /** 対象の総数（不明な場合は 0） */
  total: number;
  message: string;
  level: 'info' | 'warn' | 'error';
  /** Unix ms */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// ImportReport — 実行結果
// ---------------------------------------------------------------------------

export interface DiagnosticEntry {
  level: 'warn' | 'error';
  code: string;
  message: string;
  objectId?: string;
}

// ---------------------------------------------------------------------------
// AnalyzeOutput — 解析結果（dry-run / GUI analyze 共通）
// ---------------------------------------------------------------------------

export interface AnalyzeOutput {
  summary: {
    xmlCount: number;
    imageCount: number;
    objectCount: number;
    typeCounts: Record<string, number>;
  };
  /** 変換後オブジェクト概要（verbose / GUI プレビュー用） */
  convertedObjects: Array<{
    name: string;
    id: string;
    position: { x: number; y: number; z: number };
  }>;
  diagnostics: DiagnosticEntry[];
  performance: {
    durationMs: number;
  };
}

// ---------------------------------------------------------------------------
// ImportReport — 実行結果
// ---------------------------------------------------------------------------

export interface ImportReport {
  summary: {
    images: { total: number; success: number; failed: number };
    objects: { total: number; success: number; failed: number };
    /** Phase 1 では未追跡（常に 0） */
    components: { total: number; success: number; failed: number };
  };
  diagnostics: DiagnosticEntry[];
  artifacts: {
    /** Resonite 上のルートスロット ID */
    importRootId: string;
  };
  performance: {
    /** 全体所要時間 (ms) */
    durationMs: number;
    /** 各フェーズの所要時間 (ms) */
    stepTimings: Partial<Record<ProgressPhase, number>>;
  };
}
