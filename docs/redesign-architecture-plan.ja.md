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
- `ImportConfig`（入力設定）
- `ImportPlan`（作成計画）
- `ImportReport`（結果）
- `ProgressEvent`（進捗）

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
- `AnalyzeInput -> AnalyzeOutput`
- `ImportInput -> ImportOutput`

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
- `zipPath`
- `config`
- `options`（verbose, language など）

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
- `ImportReport`
  - total/success/failed（image/object/component）
  - warnings
  - durationMs
  - importRootId

## 4.3 Conversion Engine

### 方針
- 現在の switch ベースを、**Registry + Converter Plugin** に置換。
- Converter は `canHandle(type)` と `convert(input, ctx)` を実装。

### 期待効果
- オブジェクト種別追加時の変更点を局所化。
- Converter 単体テストが容易。

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
- `phase`: extract|parse|compile|connect|apply|finalize
- `current`, `total`
- `message`
- `level`: info|warn|error
- `timestamp`

## 5.3 ImportReport
- summary: 成功/失敗数
- diagnostics: warning/error 一覧
- artifacts: 生成ルートID等
- performance: duration, step timings

## 5.4 CLI オプション ↔ ImportConfig マッピング

CLI Adapter は以下のマッピングで ImportConfig を構築する。GUI Adapter も同等のマッピングを独自 UI から構築する。

| CLI オプション | ImportConfig フィールド | 備考 |
|---|---|---|
| `-i, --input` | `inputZipPath` | 必須 |
| `-p, --port` | `resonite.port` | デフォルト: 実装定義 |
| `-H, --host` | `resonite.host` | デフォルト: `localhost` |
| `--root-scale` | `rootScale` | > 0 の実数 |
| `--root-grabbable` | `rootGrabbable` | boolean flag |
| `--enable-character-collider` / `--disable-character-collider` | `enableCharacterCollider` | 相互排他フラグ |
| `--transparent-blend-mode` | `transparentBlendMode` | `Cutout` または `Alpha` |
| `-d, --dry-run` | `dryRun` | 別フィールド（ImportOptions）でも可 |
| `-v, --verbose` | ImportConfig 外 — `ProgressPort` の verbosity として注入 | ImportConfig を汚染しない |

> **設計方針**: `verbose` と `dry-run` は実行制御であり、変換仕様には影響しない。
> `verbose` は `ProgressPort` の実装（詳細ログ出力 Adapter）で吸収し、
> `dry-run` は `ImportUseCase` への入力フラグ（`ImportOptions.dryRun`）として分離することを推奨する。
> これにより `ImportConfig` が「何を変換するか」の純粋な設定として機能し、「どのように実行するか」が混入しない。

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
7. タグ付け
8. 結果集計

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
- Apply 中は「継続可能な単位」で続行し、最終レポートで失敗件数を提示。
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

## Phase 0: 準備（1週）
- 目的: 破壊を避けるための足場づくり。
- タスク:
  1. 設計ドキュメント合意
  2. 既存フローのイベント列を可視化
  3. 受け入れ基準（DoD）定義
- 完了条件:
  - 設計レビュー承認
  - 主要ユースケースの現行テストが安定

## Phase 1: Contract 抽出 + 共通実行ロジック抽出（1〜2週）
- タスク:
  1. ImportConfig/Report/Event/ImportOptions を定義
  2. **CLI/GUI の重複実行フロー（extract/parse/connect/import）を共通関数として抽出**
     - 抽出先: `src/application/` 等の新ディレクトリ（UseCase 導入前の暫定層）
     - CLI・GUI 双方がその共通関数を呼ぶよう切替
  3. CLI/GUI を新契約に合わせる Adapter を作成（5.4 のマッピング適用）
- リスク低減:
  - 実処理のロジックは変えず「呼び出しの集約」のみ行うため挙動変化を最小化
  - Phase 2 以降での UseCase 委譲先が明確になる

## Phase 2: UseCase 導入（2週）
- タスク:
  1. AnalyzeUseCase を新規実装
  2. CLI dry-run/GUI analyze を UseCase 経由へ切替
  3. ImportUseCase の雛形導入（Phase 1 で抽出した共通関数に委譲）
- 完了条件:
  - CLI/GUI の解析結果一致
  - ImportUseCase を経由して現行と同等のインポートが動作すること

## Phase 3: Compile/Apply 分離（2〜3週）
- タスク:
  1. ImportPlan Builder 実装
  2. Apply Executor 実装
  3. ImportUseCase を完全移行
- 完了条件:
  - dry-run と live import が同一 Compile パス使用

## Phase 4: Converter Registry 化（任意実施）
> **注: 優先度「低」** — 現行の switch ベース実装は新オブジェクト追加時に「型定義 + Converter ファイル作成 + switch への case 追加」の3ステップで完結しており、拡張コストは小さい。本 Phase は技術負債整理の一環として、必要性が高まった時点で実施を検討する。

- タスク:
  1. 各 object converter を Plugin インタフェース（`canHandle` / `convert`）に合わせてラップ
  2. switch 実装を Registry 呼び出しへ段階的に置換
  3. Converter 契約テスト導入
- 完了条件:
  - 既存 fixture の変換互換を維持
- **実施判断基準**: 管理対象オブジェクト種別が大幅増加する、または外部 Plugin 提供が必要になった場合に優先度を上げる

## Phase 5: 技術負債整理（1〜2週）
- タスク:
  1. 重複コード削減（CLI/GUI）
  2. ログ/メトリクス標準化
  3. パフォーマンス最適化（必要時）

---

## 11. 受け入れ基準（Definition of Done）

1. CLI/GUI は同じ UseCase を呼ぶ。
2. dry-run/live import で Compile ロジックが共通。
3. 主要 fixture で現行互換（object/image 成功数一致）。
4. 失敗時に ImportReport で原因分類が可能。
5. 新オブジェクト追加時に変更箇所が Registry + Converter + Test に閉じる。

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

## 14. 実装開始時の最初の 10 チケット（例）

1. ARCH-001: ImportConfig 契約定義
2. ARCH-002: ProgressEvent 契約定義
3. APP-001: AnalyzeUseCase scaffold
4. APP-002: CLI dry-run を AnalyzeUseCase 経由化
5. APP-003: GUI analyze を AnalyzeUseCase 経由化
6. APP-004: ImportUseCase scaffold
7. CORE-001: ImportPlan モデル定義
8. CORE-002: Plan Builder 初版
9. INF-001: ResoniteGatewayPort + adapter
10. QA-001: Plan snapshot テスト基盤

---

## 15. まとめ

- 本再設計は「全面書き換え」ではなく、**契約抽出 -> UseCase 統合 -> Compile/Apply 分離 -> Plugin 化**の順で安全に進める。
- 成果は「重複削減」「拡張容易性」「テスト容易性」「失敗時診断性」の4点で測る。
- ドキュメントを仕様の単一情報源とし、実装は常に本設計との差分説明を伴って進める。
