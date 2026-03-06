/**
 * ImportPlan — Compile ステップの出力（Phase 3 準備）
 *
 * ResoniteObject[] から生成される中間表現。
 * Apply Executor がこれを ResoniteLink 経由で Resonite に適用する。
 *
 * 設計方針:
 * - JSON シリアライズ可能（スナップショットテスト・デバッグ対応）
 * - 論理参照 (LRef) で Compile と Apply を分離
 * - Apply 順序: assets → meshes → materials → slots（親から子の順）
 * - 循環参照は Compile 時に検出し ConversionError とする（Phase 3 で実装）
 *
 * See: docs/architecture.ja.md Section 4.4
 */

// ---------------------------------------------------------------------------
// 論理参照 (Logical Reference)
// ---------------------------------------------------------------------------

/**
 * 論理参照 (LRef) — Apply 段階で実 ID に解決する。
 *
 * 書式: `"<kind>:<logicalId>"`
 * 例:   `"asset:some-image.png"`, `"mesh:quad:1,1"`, `"material:xiexe-toon:..."`
 *
 * SlotPlanEntry.components[].members の値として埋め込まれ、
 * Apply Executor が Map<LRef, ResoniteId> で解決する。
 */
export type LRef = string;

// ---------------------------------------------------------------------------
// AssetPlanEntry — テクスチャ等の外部アセット
// ---------------------------------------------------------------------------

export type AssetKind = 'zip-image' | 'zip-svg' | 'external-url' | 'external-svg';

export interface AssetPlanEntry {
  /** 一意な論理 ID（ZIP ファイル名 または 外部 URL を正規化したもの） */
  logicalId: string;
  /** LRef 文字列。他エントリからこのアセットを参照する際に使用 */
  lref: LRef;
  /** アセット種別 */
  kind: AssetKind;
  /** ZIP 内ファイル名（zip-image / zip-svg）または 外部 URL（external-*） */
  source: string;
}

// ---------------------------------------------------------------------------
// MeshPlanEntry — メッシュ定義
// ---------------------------------------------------------------------------

export type MeshType = 'QuadMesh' | 'BoxMesh';

export interface MeshPlanEntry {
  /** 一意な論理 ID（`"quad:1,1"` 等のキー文字列） */
  logicalId: string;
  /** LRef 文字列 */
  lref: LRef;
  /** Resonite 上のスロット名 */
  name: string;
  meshType: MeshType;
  /** QuadMesh は { x, y }、BoxMesh は { x, y, z } */
  size: { x: number; y: number } | { x: number; y: number; z: number };
  dualSided?: boolean;
}

// ---------------------------------------------------------------------------
// MaterialPlanEntry — マテリアル定義
// ---------------------------------------------------------------------------

export interface MaterialPlanEntry {
  /** 一意な論理 ID（`"xiexe-toon:#FFFFFFFF:Cutout:Default"` 等） */
  logicalId: string;
  /** LRef 文字列 */
  lref: LRef;
  /** Resonite 上のスロット名 */
  name: string;
  /** コンポーネント種別（例: `"FrooxEngine.XiexeToonMaterial"` ) */
  componentType: string;
  /**
   * フィールド値。テクスチャ参照は LRef 文字列で表す。
   * Apply 段階で LRef → 実コンポーネント ID に解決される。
   */
  fields: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SlotPlanEntry — スロット階層
// ---------------------------------------------------------------------------

export interface ComponentPlanEntry {
  /** コンポーネント種別（例: `"FrooxEngine.MeshRenderer"` ） */
  type: string;
  /**
   * フィールド値。
   * メッシュ参照・マテリアル参照・テクスチャ参照は LRef 文字列で表す。
   * Apply 段階で解決される。
   */
  members: Record<string, unknown>;
}

/** スロットのグループ配置ヒント（配置先ルーティング用） */
export type GroupHint = 'table' | 'object' | 'inventory';

export interface SlotPlanEntry {
  /** 一意な論理 ID（ResoniteObject.id を引き継ぐ） */
  logicalId: string;
  name: string;
  isActive: boolean;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  components: ComponentPlanEntry[];
  /** 子スロット（再帰ネスト） */
  children: SlotPlanEntry[];
  /** 元 Udonarium オブジェクト種別 */
  sourceType?: string;
  /** character 種別のロケーション名 */
  locationName?: string;
  groupHint?: GroupHint;
}

// ---------------------------------------------------------------------------
// ImportPlan — トップレベル構造
// ---------------------------------------------------------------------------

export interface ImportPlan {
  /**
   * 生成元設定のスナップショット（参照用）。
   * Apply 段階では読み取りのみ（設定変更不可）。
   */
  configSnapshot: {
    inputZipPath: string;
    rootScale: number;
    transparentBlendMode: 'Cutout' | 'Alpha';
    enableCharacterCollider: boolean;
    simpleAvatarProtection: boolean;
  };

  /**
   * 適用順序保証:
   *   assets → meshes → materials → slots（親から子の順）
   */
  assets: AssetPlanEntry[];
  meshes: MeshPlanEntry[];
  materials: MaterialPlanEntry[];
  slots: SlotPlanEntry[];
}
