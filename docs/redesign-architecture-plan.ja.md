# Udonarium Resonite Importer 再設計設計書（実装非依存）

> 目的: 本ドキュメントは、現在の実装詳細に依存せず「誰が実装しても同じ品質へ収束する」ことを目的に、アーキテクチャ方針・責務分離・データ契約・移行計画を定義する。

## 1. 背景と課題定義

### 1.1 現状の価値
- CLI/GUI で Udonarium ZIP を解析し、ResoniteLink 経由でインポートできる。
- オブジェクト変換・画像インポート・共通メッシュ/マテリアル生成まで実現済み。

### 1.2 課題
- CLI と GUI で実行フロー（extract/parse/connect/import）が重複し、仕様変更時に修正点が分散する。
- 変換処理が中央集約されやすく、オブジェクト追加時の改修範囲が拡大しやすい。
- dry-run と本番インポートの共通部分が暗黙的で、検証観点の再利用性が低い。
- 「変換（純粋処理）」と「外部副作用（ResoniteLink 操作）」が同一ユースケース内に混在しやすい。
- CLI 固有オプション（`--dry-run`, `--verbose`, `--root-scale` 等）と GUI 入力の正規化ルールが設計上未定義であり、Adapter 実装時の仕様の揺れが生じやすい。

### 1.3 再設計の目標
1. **Core-first**: ドメインロジックを UI/実行環境から独立。
2. **Port/Adapter**: 外部依存は境界で吸収。
3. **Plan-driven**: 解析/変換結果を明示的な ImportPlan として定義。
4. **同一ユースケースの再利用**: CLI/GUI が同じ UseCase を呼ぶ。
5. **段階移行可能**: 大規模置換ではなく、機能を壊さず段階移行。

---

## 2. 設計原則（思想）

### 2.1 Dependency Rule
依存方向は常に **外側 -> 内側**。内側（Domain/Core）は外側（UI/Infra）を知らない。

### 2.2 Functional Core, Imperative Shell
- Core: 可能な限り純粋関数で構成（入力に対して決定的出力）。
- Shell: IO/ネットワーク/ファイル操作/進捗通知を担当。

### 2.3 Explicit Contract
暗黙の共有状態を禁止し、以下を明示契約とする。
- `ImportConfig`（変換仕様・接続設定 — 「何を変換するか」）
- `ImportOptions`（実行制御 — 「どのように実行するか」: dry-run, verbose 等）
- `ImportPlan`（作成計画）
- `ImportReport`（結果）
- `ProgressEvent`（進捗）

> `ImportConfig` と `ImportOptions` を分離することで、Core が実行制御を知らなくて済む。

### 2.4 Determinism First
同じ ZIP + Config + Extension から同じ ImportPlan が得られることを保証。再現性をテスト可能にする。

### 2.5 Backward Compatibility by Adapter
既存 CLI オプション/GUI 入力を即破壊せず、Adapter 層で吸収。

---

## 3. ターゲットアーキテクチャ

## 3.1 レイヤ構成

1. **Interface Layer**
   - CLI Adapter
   - GUI Adapter
2. **Application Layer**
   - `AnalyzeUseCase`（解析のみ）
   - `ImportUseCase`（実インポート）
3. **Domain/Core Layer**
   - Parser Normalization
   - Object Conversion Engine
   - Plan Builder
   - Validation Rules
4. **Infrastructure Layer**
   - ResoniteLink Gateway
   - File/Zip Reader
   - Image Probe
   - Logger/Telemetry

## 3.2 境界（Ports）

### Inbound Ports（UseCase 呼び出し）

**AnalyzeUseCase**
- 入力 `AnalyzeInput`: `{ config: ImportConfig, options: ImportOptions }`
- 出力 `AnalyzeOutput`: `analysisSummary`（objectCount, imageCount, typeCounts, warnings, errors, estimatedPlanStats）

**ImportUseCase**
- 入力 `ImportInput`: `{ config: ImportConfig, options: ImportOptions }`
- 出力 `ImportOutput`: `ImportReport`（Section 5.3 参照）

> 両 UseCase は同じ `{ config, options }` シグネチャを持つ。AnalyzeUseCase の出力を ImportUseCase に渡す必要はなく、ImportUseCase は Compile ステップで内部的に同等の解析を再実行する。

### Outbound Ports（外部依存）
- `ZipRepositoryPort`
- `ImageMetadataPort`
- `ResoniteGatewayPort`
- `ProgressPort`
- `ClockPort`（時刻取得）
- `IdGeneratorPort`

> 注: Clock/Id を Port 化することでテストを決定的にできる。

---

## 4. 主要コンポーネント設計

## 4.1 AnalyzeUseCase

### 目的
副作用最小で ZIP 解析と変換可能性を評価する。

### 入力
- `config: ImportConfig`（`inputZipPath` を含む）
- `options: ImportOptions`（verbose など実行制御）

### 出力
- `analysisSummary`
  - objectCount, imageCount, typeCounts
  - warnings, errors
  - estimatedPlanStats（作成予定スロット数など）

### 非機能要件
- Resonite 未起動でも実行可能。
- 同一入力で決定的結果。

## 4.2 ImportUseCase

### 目的
Analyze の結果を利用し、ImportPlan を適用して Resonite 側の実体を作成する。

### 処理段階
1. Preflight（設定妥当性・接続可否）
2. Compile（ImportPlan 生成）
3. Apply（Resonite へ反映）
4. Finalize（タグ付け・集計・レポート）

### 出力
- `ImportReport`（詳細は Section 5.3 を正とする）

## 4.3 Conversion Engine

### 方針
- **当面は現行の switch ベースを維持する**（Phase 4 は任意実施）。
- 将来的に管理対象オブジェクト種別が大幅増加した場合は、**Registry + Converter Plugin** への移行を検討する。
- Converter Plugin のインタフェース（移行時の参考）: `canHandle(type): boolean` / `convert(input, ctx): SlotPlanEntry`

### 現行方式での新オブジェクト追加手順（3ステップ）
1. `ObjectType` 型定義に種別を追加
2. `objectConverters/` に Converter ファイルを作成
3. `ObjectConverter.ts` の switch に `case` を追加

## 4.4 Plan Builder

### 役割
変換結果を、適用可能な中間表現 `ImportPlan` に整形。

### ImportPlan の設計要件
- 実行順序を内包（asset -> material -> mesh -> slot など依存順）。
- 参照解決可能（論理ID -> 実ID へのマッピング前提）。
- 冪等再実行を想定（同一 logical key の再利用可否）。

### ImportPlan の概念構造

以下は設計方針を示す概念表現であり、実装言語の構文に依存しない。

```
ImportPlan
  config: ImportConfig                  # 生成元設定（参照用）
  assets: AssetPlanEntry[]             # テクスチャ等の外部アセット
    logicalId, filePath, mimeType, expectedSize?
  materials: MaterialPlanEntry[]       # マテリアル定義
    logicalId, blendMode, textureLRef  # textureLRef = assets への論理参照
  meshes: MeshPlanEntry[]              # メッシュ定義（Quad / Triangle / Box 等）
    logicalId, meshType, vertices?, size?
  slots: SlotPlanEntry[]               # スロット階層（再帰ネスト可）
    logicalId, name, parentLRef?
    position, rotation, scale
    components: ComponentPlanEntry[]
      type, members: { key -> value | LRef }
    sourceType?, locationName?
    groupHint: 'table' | 'object' | 'inventory'  # 配置先ルーティング用
```

**論理参照（LRef）**: `assets[id:xxx]` のような文字列形式で表し、Apply 段階で実 ID に解決する。これにより Compile と Apply を完全に分離できる。

**Apply 順序保証**: assets → materials → meshes → slots（親から子の順）とする。循環参照は Compile 時に検出し ConversionError とする。

---

## 5. データ契約（実装言語非依存）

## 5.1 ImportConfig
必須項目:
- inputZipPath
- resonite.host
- resonite.port（dry-run を除く）

任意項目:
- rootScale
- rootGrabbable
- simpleAvatarProtection
- transparentBlendMode
- enableCharacterCollider
- locale

検証ルール:
- port: 1..65535
- rootScale: > 0
- transparentBlendMode: {Cutout, Alpha}

## 5.2 ProgressEvent
```
ProgressEvent
  phase:     extract | parse | compile | connect | cleanup | apply | finalize
  current:   number   # 現在の処理数
  total:     number   # 対象の総数（不明な場合は 0）
  message:   string
  level:     info | warn | error
  timestamp: number   # Unix ms
```

**`phase` と実行ステップの対応**

| phase | 対応する実行ステップ |
|---|---|
| `extract` | ZIP 読込・展開 |
| `parse` | XML 抽出・パース・正規化・画像メタ推定 |
| `compile` | オブジェクト変換・ImportPlan 生成 |
| `connect` | ResoniteLink 接続・Preflight 検証 |
| `cleanup` | Pre-cleanup（旧インポート削除） |
| `apply` | Asset/Material/Mesh/Slot 適用（全 Apply ステップ共通） |
| `finalize` | タグ付け・結果集計 |

## 5.3 ImportReport
```
ImportReport
  summary:
    images:    { total, success, failed }
    objects:   { total, success, failed }
    components:{ total, success, failed }
  diagnostics: DiagnosticEntry[]   # warning/error の一覧
    { level: 'warn'|'error', code, message, objectId? }
  artifacts:
    importRootId: string           # Resonite 上のルートスロット ID
  performance:
    durationMs: number             # 全体所要時間
    stepTimings: { [phase]: number }  # 各フェーズの所要時間
```

## 5.4 CLI オプション ↔ ImportConfig マッピング

CLI Adapter は以下のマッピングで ImportConfig を構築する。GUI Adapter も同等のマッピングを独自 UI から構築する。

| CLI オプション | 格納先 | フィールド名 | デフォルト | 備考 |
|---|---|---|---|---|
| `-i, --input` | `ImportConfig` | `inputZipPath` | （必須） | |
| `-p, --port` | `ImportConfig` | `resonite.port` | `20080` | 現行実装のデフォルト値 |
| `-H, --host` | `ImportConfig` | `resonite.host` | `localhost` | |
| `--root-scale` | `ImportConfig` | `rootScale` | `1.0` | > 0 の実数 |
| `--root-grabbable` | `ImportConfig` | `rootGrabbable` | `false` | |
| `--no-simple-avatar-protection` | `ImportConfig` | `simpleAvatarProtection` | `true` | フラグ指定で `false` |
| `--enable-character-collider` | `ImportConfig` | `enableCharacterCollider` | `true` | |
| `--disable-character-collider` | `ImportConfig` | `enableCharacterCollider` | — | `--enable-` と相互排他 |
| `--transparent-blend-mode` | `ImportConfig` | `transparentBlendMode` | `Cutout` | `Cutout` または `Alpha` |
| `-d, --dry-run` | **`ImportOptions`** | `dryRun` | `false` | ImportConfig には**入れない** |
| `-v, --verbose` | **`ImportOptions`** | `verbose` | `false` | `ProgressPort` の実装で参照 |

> **設計方針**: `dry-run` と `verbose` は「どのように実行するか」の制御であり、変換仕様（ImportConfig）と混在させない。
> `ImportOptions` として UseCase への別引数とし、Core は ImportOptions を知らなくてよい。
> `verbose` は `ProgressPort` の実装（詳細ログ出力 Adapter）内で `ImportOptions.verbose` を参照する。

---

## 6. 実行シーケンス（論理）

## 6.1 Dry-run
1. ZIP 読込
2. XML 抽出・パース
3. 正規化
4. 画像メタ推定
5. オブジェクト変換
6. ImportPlan 生成（Apply しない）
7. Analysis 出力

## 6.2 Live Import
1. Dry-run と同等の Compile
2. Resonite 接続
3. Pre-cleanup（旧インポート処理）
4. Asset 適用
5. Material/Mesh 適用
6. Slot/Component 適用
7. タグ付け（Finalize）
8. 結果集計

### Pre-cleanup の仕様
Pre-cleanup は前回インポートの残留スロットを除去し、ルートのトランスフォームを引き継ぐための処理である。

- **検出方法**: ルートスロット直下の子スロットのうち、特定のタグ（`UdonariumImport` または実装定義のタグ文字列）を持つものを対象とする。
- **保持するもの**: ルートスロット自体のトランスフォーム（位置・回転・スケール）。以前のインポート位置を次回インポートに引き継ぐ。
- **削除するもの**: タグを持つ子スロット（Tables / Objects / Inventory 等の直下グループ）を削除する。
- **タグ付けのタイミング**: Finalize ステップ（ステップ 7）でインポートグループに同タグを付与する。これにより次回 Pre-cleanup で正しく検出される。
- **タグ名の管理**: タグ文字列は ImportConfig または定数として一元管理し、Compile / Apply / Finalize で共有する。

---

## 7. エラーハンドリング方針

### 7.1 エラー分類
- ValidationError: 入力不正
- ParseError: ZIP/XML 不正
- ConversionError: オブジェクト変換不能
- GatewayError: ResoniteLink 通信失敗
- PartialApplyError: 部分失敗

### 7.2 失敗戦略
- Compile 中の致命エラーは即中断。
- Apply 中は **SlotPlanEntry 単位**（= Udonarium オブジェクト1件）で継続する。1件の Apply 失敗は PartialApplyError として記録し、次の SlotPlanEntry の処理を続ける。
  - Asset/Material/Mesh の Apply 失敗はそれを参照する Slot も失敗扱いとし、Slot の Apply はスキップする。
  - Component 単位での部分失敗（Slot は作成できたが一部コンポーネント追加失敗）も PartialApplyError として記録する。
- 例外は UseCase 境界で必ずドメインエラーへ正規化。

---

## 8. 可観測性（Observability）

### 8.1 ログ
- 構造化ログ（json lines も選択可）
- correlationId を 1 実行単位で採番

### 8.2 メトリクス
- step duration（extract/parse/compile/apply）
- objects/sec, images/sec
- fail ratio

### 8.3 トレース
- ProgressEvent をイベントストリームとして保存可能にする。

---

## 9. テスト戦略

## 9.1 レベル別
1. **Unit**: Converter/Validator/Plan Builder
2. **Contract**: Port の期待挙動（mock gateway）
3. **Integration (fixture)**: ZIP -> Plan 生成の整合性
4. **Integration (live)**: ResoniteLink 実接続

## 9.2 重点
- `ImportPlan` スナップショット
- 画像透過モード分岐
- テーブル選択可視性制御
- 旧インポート削除と再作成の整合

## 9.3 回帰防止
- 既知 fixture ごとに expected report を持つ。
- 互換レベル（Strict / Compatible）を定義し、CI で判定。

---

## 10. リファクタリング計画（段階移行）

## Phase 0: 準備（1週） ✅ 完了
- 目的: 破壊を避けるための足場づくり。
- タスク:
  1. 設計ドキュメント合意 ✅
  2. 既存フローのイベント列を可視化 ✅
  3. 受け入れ基準（DoD）定義 ✅
- 完了条件:
  - 設計レビュー承認 ✅
  - 主要ユースケースの現行テストが安定 ✅（411 tests passed）

## Phase 1: Contract 抽出 + 共通実行ロジック抽出（1〜2週） ✅ 完了
- タスク:
  1. ImportConfig/Report/Event/ImportOptions を定義 ✅ → `src/application/contracts.ts`
  2. **CLI/GUI の重複実行フロー（extract/parse/connect/import）を共通関数として抽出** ✅ → `src/application/importRunner.ts`
     - 抽出先: `src/application/` ✅
     - CLI・GUI 双方がその共通関数を呼ぶよう切替 ✅
  3. CLI/GUI を新契約に合わせる Adapter を作成（5.4 のマッピング適用） ✅ → `src/index.ts`, `src/gui/main.ts` 再実装
- リスク低減:
  - 実処理のロジックは変えず「呼び出しの集約」のみ行うため挙動変化を最小化 ✅
  - Phase 2 以降での UseCase 委譲先が明確になる ✅
- 実装メモ:
  - TypeScript 5.9 の CFA バグ（let 変数をクロージャ内で書き換えると never に narrowing）を ref オブジェクトパターンで回避
  - スロット再親子化（reparenting）は CLI 専用だったが共通 Runner に統合（GUI 側も同じ整理が適用される）
  - ~~CLI の dry-run パスは Phase 2 (AnalyzeUseCase) 導入まで `src/index.ts` に保持~~ → Phase 2 完了により解消

## Phase 2: UseCase 導入（2週） ✅ 完了
- タスク:
  1. AnalyzeUseCase を新規実装 ✅ → `src/application/analyzeUseCase.ts`
  2. CLI dry-run/GUI analyze を UseCase 経由へ切替 ✅
  3. ImportUseCase の雛形導入（Phase 1 で抽出した共通関数に委譲） ✅ → `src/application/importUseCase.ts`
- 完了条件:
  - CLI/GUI の解析結果一致 ✅
  - ImportUseCase を経由して現行と同等のインポートが動作すること ✅
  - 全テスト通過（411 tests passed） ✅

## Phase 3: Compile/Apply 分離（2〜3週）✅ 完了
- タスク:
  1. ~~ImportPlan Builder 実装~~ ✅ → `src/application/compilePlan.ts`（buildImportPlan）
  2. ~~Apply Executor 実装~~ ✅ → `importRunner.ts` が _compiled 経由でApply
  3. ~~ImportUseCase を完全移行~~ ✅ → analyzeUseCase / importRunner が共通 Compile パス使用
- 完了条件:
  - dry-run と live import が同一 Compile パス使用 ✅（両者とも buildImportPlan を呼ぶ）
- 実装メモ:
  - テクスチャ参照解決のため Apply 時にオブジェクト変換を再実行（dry-run ID → 実 ID）
  - Phase 4/5 で ImportPlan.slots ベースの Apply に段階移行する予定（`_compiled` を廃止）
- 全テスト通過（418 tests passed）✅

## Phase 4: Converter Registry 化（任意実施）
> **注: 優先度「低」** — 現行の switch ベース実装は新オブジェクト追加時に「型定義 + Converter ファイル作成 + switch への case 追加」の3ステップで完結しており、拡張コストは小さい。本 Phase は技術負債整理の一環として、必要性が高まった時点で実施を検討する。

- タスク:
  1. 各 object converter を Plugin インタフェース（`canHandle` / `convert`）に合わせてラップ
  2. switch 実装を Registry 呼び出しへ段階的に置換
  3. Converter 契約テスト導入
- 完了条件:
  - 既存 fixture の変換互換を維持
- **実施判断基準**: 管理対象オブジェクト種別が大幅増加する、または外部 Plugin 提供が必要になった場合に優先度を上げる

## Phase 5: 技術負債整理（1〜2週）✅ 主要項目完了
- タスク:
  1. ~~Phase 1〜3 で対処しきれなかった残留重複コードの削減~~ ✅
     - `_compiled` の未使用フィールド削除（`resoniteObjects` / `sharedMeshDefs` / `sharedMaterialDefs`）
     - 共通 `emit` ヘルパーを `_progressEmit.ts` に抽出（analyzeUseCase / importRunner の重複排除）
  2. ~~ログ/メトリクス標準化（step timings の実装）~~ ✅
     - `buildImportPlan()` が `compileTimings`（extract/parse/compile を個別計測）を返す
     - `importRunner.ts` が `compileTimings` を `stepTimings` に統合（`parse = extract` の同値バグを解消）
  3. パフォーマンス最適化（現時点では不要）
- 全テスト通過（418 tests passed）✅

---

## 11. 受け入れ基準（Definition of Done）

1. CLI/GUI は同じ UseCase を呼ぶ。
2. dry-run/live import で Compile ロジックが共通。
3. 主要 fixture で現行互換（object/image 成功数一致）。
4. 失敗時に ImportReport で原因分類が可能。
5. 新オブジェクト追加時の変更箇所が `ObjectType` 定義・Converter ファイル・switch case・テストの4点に閉じる（Registry 化完了後は Converter + Test の2点）。

---

## 12. 体制・運用計画

## 12.1 ロール
- Architecture Owner: 設計原則維持
- UseCase Owner: アプリケーション層実装
- Adapter Owner: CLI/GUI/Resonite 境界管理
- QA Owner: fixture/live テスト運用

## 12.2 開発フロー
- 小さな PR 単位で段階移行。
- 各 Phase で「互換性レポート」を添付。
- 破壊的変更は feature flag で切替。

---

## 13. リスクと対策

1. **互換崩れ**
   - 対策: fixture snapshot + report diff
2. **性能劣化**
   - 対策: Step duration の継続計測
3. **設計過剰化**
   - 対策: Phase ごとに ROI 評価、不要抽象化を禁止（Phase 4 の Registry 化は ROI 低の場合は見送り）
4. **移行長期化**
   - 対策: 垂直スライス（analyze -> import）で先に価値提供
5. **CLI 固有オプションの仕様散逸**
   - 状況: `--verbose` や `--dry-run` は変換仕様ではなく実行制御に属するが、ImportConfig に混入すると Core が汚染される
   - 対策: Section 5.4 のマッピング定義を Adapter 実装の仕様書として使用し、CLI/GUI Adapter レビュー時に逸脱を検出する

---

## 14. 実装チケット一覧

Phase 0（✅ 完了）:
1. ~~ARCH-001: ImportConfig / ImportOptions 契約定義（Section 5.1 / 5.4 に基づく）~~ ✅
2. ~~ARCH-002: ProgressEvent / ImportReport 契約定義（Section 5.2 / 5.3 に基づく）~~ ✅

Phase 1（✅ 完了）:
3. ~~ARCH-003: CLI/GUI 共通実行フローを `src/application/` へ抽出~~ ✅ → `src/application/importRunner.ts`
4. ~~ARCH-004: CLI Adapter を ImportConfig + ImportOptions にマッピング（Section 5.4）~~ ✅ → `src/index.ts`
5. ~~ARCH-005: GUI Adapter を ImportConfig + ImportOptions にマッピング~~ ✅ → `src/gui/main.ts`

Phase 2（✅ 完了）:
6. ~~APP-001: AnalyzeUseCase scaffold（入力: `{ config, options }`, 出力: AnalyzeOutput）~~ ✅ → `src/application/analyzeUseCase.ts` + `AnalyzeOutput` 型を contracts.ts に追加
7. ~~APP-002: CLI dry-run / GUI analyze を AnalyzeUseCase 経由化~~ ✅ → `src/index.ts`, `src/gui/main.ts`
8. ~~APP-003: ImportUseCase scaffold（Phase 1 共通関数へ委譲）~~ ✅ → `src/application/importUseCase.ts`

Phase 3 準備（✅ 完了）:
9. ~~CORE-001: ImportPlan モデル定義（Section 4.4 の概念構造に基づく）~~ ✅ → `src/application/importPlan.ts`
10. ~~QA-001: Plan snapshot テスト基盤~~ ✅ → `src/application/analyzeUseCase.snapshot.test.ts`（7 tests + 6 snapshots）

---

## 15. まとめ

- 本再設計は「全面書き換え」ではなく、**契約抽出 -> 共通ロジック抽出 -> UseCase 統合 -> Compile/Apply 分離**の順で安全に進める（Converter Registry 化は任意）。
- 成果は「重複削減」「拡張容易性」「テスト容易性」「失敗時診断性」の4点で測る。
- ドキュメントを仕様の単一情報源とし、実装は常に本設計との差分説明を伴って進める。

---

## 16. 実装監査結果と残課題（2026-03-05 時点）

Phase 0〜3 完了後の実装監査（418 tests passed）で判明した残課題を記録する。
DoD 全5項目は充足済み。以下はバックログとして管理する。

### 16.1 `compile` フェーズの ProgressEvent 未 emit ✅ 対処済み

**現象（修正前）**: `contracts.ts` で `'compile'` が `ProgressPhase` に定義されているにもかかわらず、`analyzeUseCase.ts` および `importRunner.ts` のいずれも `buildImportPlan()` 完了後に `compile` フェーズの `ProgressEvent` を emit していなかった。呼び出し元には `extract → parse → connect` のように `compile` フェーズが飛ばされて見えていた。

**修正方針**: `buildImportPlan()` 完了直後（`parse` emit の後）に `compile` フェーズの emit を追加する。

**実施済み変更**:
- `src/application/analyzeUseCase.ts`: `parse` emit 直後に `compile` (1/1) を emit
- `src/application/importRunner.ts`: `parse` emit 直後に `compile` (1/1) を emit

---

### 16.2 `ImportReport.summary.components` が常にゼロ（バックログ）

**現象**: `importRunner.ts` の ImportReport 組み立て部で `components` が `{ total: 0, success: 0, failed: 0 }` ハードコードになっている。
`contracts.ts` のコメント「Phase 1 では未追跡（常に 0）」が根拠。

**原因**: `SlotBuilder.buildSlots()` の戻り値がスロット単位の成否であり、スロット内コンポーネントの単位追跡を行っていない。

**対応方針（将来）**:
1. `SlotBuilder` がコンポーネント追加結果をコンポーネント単位で返すよう拡張
2. `importRunner.ts` で集計して `summary.components` に反映

**優先度**: 低（現時点では objects/images の成否で診断可能）
**予定フェーズ**: Phase 4/5 の Apply 改善時に合わせて実施

---

### 16.3 コンポーネント単位のエラー分離（将来対応）

**現象**: Section 7.2 に「Component 単位での部分失敗（Slot は作成できたが一部コンポーネント追加失敗）も PartialApplyError として記録する」と定義されているが、現在は Slot が失敗した場合にのみ診断エントリが記録される。1 Slot 内の一部コンポーネント失敗は追跡されない。

**原因**: `SlotBuilder` がコンポーネント追加をまとめて実行しており、コンポーネント単位の戻り値を持たない。

**対応方針（将来）**:
1. `SlotBuilder` のコンポーネント追加処理をコンポーネント単位で try/catch し、部分失敗を返す
2. `importRunner.ts` で `diagnostics` に `PartialApplyError` として記録
3. `summary.components` の追跡（16.2）と同時実施が望ましい

**優先度**: 低（Slot レベルで失敗が分かれば診断上は許容範囲）
**予定フェーズ**: Phase 4/5 で SlotBuilder をリファクタリングする際に実施
