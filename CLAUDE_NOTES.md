# Claude Code 引き継ぎメモ

## プロジェクト概要

Udonarium（Webベースのバーチャルテーブルトップ）のセーブデータを、ResoniteLink経由でResonite（VRプラットフォーム）にインポートするツール。CLI版とGUI版（Electron）がある。

## 環境・ツール構成

- **Node.js**: 20.18.2（miseで固定、`.mise.toml`）
- **パッケージマネージャー**: npm
- **ビルド/検証コマンド**: [docs/development.md](docs/development.md) を参照
- **tsconfig**: CLI用（`tsconfig.cli.json`、DOM除外）とGUI用（`tsconfig.gui.json`、DOM含む）の2つ
- **CI**: GitHub Actions（PR時にlint/format自動修正 → 検証）
- **pre-commit**: lint-stagedのみ（型チェック・テストはCIに委ねる）
- **コミット前**: 必ず `npm run check` を実行すること

## ResoniteLink接続

ポートはResoniteのワールド起動ごとに変わるため、以下のいずれかで設定:
- CLIオプション: `-p 12345`
- 環境変数: `RESONITELINK_PORT=12345`
- `.env`ファイル（`.env.example`をコピー）

統合テスト実行例: `RESONITELINK_PORT=12345 npm run test:integration`

## 技術的なメモ

### 処理パイプライン

```
ZIP → ZipExtractor → XmlParser → UdonariumObject[]
  → ObjectConverter → ResoniteObject[]
  → AssetImporter (テクスチャ) + SlotBuilder (スロット/コンポーネント) → Resonite
```

- 非 dry-run 時は画像インポート完了後に `convertObjectsWithTextureMap(...)` でオブジェクトを生成（テクスチャURLを直接反映）。
- dry-run 時はプレースホルダー (`texture://<identifier>`) を使用。

### テクスチャインポート
- `importTexture2DFile`: ファイルパスを受け取り、全画像形式に対応
- `importTexture2DRawData`: 生のRGBAピクセルデータを期待（エンコード済み画像はNG）
- AssetImporterがZIPから一時ファイルに展開し、`importTexture(filePath)`で直接インポート
- GIF画像は `StaticTexture2D.FilterMode = Point` を設定

### 既知画像識別子
- `src/config/MappingConfig.ts` の `KNOWN_IMAGE_IDENTIFIERS` マップに定義
- Udonarium組み込みアセット（`testTableBackgroundImage_image` 等）を外部URLに解決
- `src/resonite/registerExternalUrls.ts` が `./` 相対パスと既知識別子の両方を処理

### FrooxEngineコンポーネント型形式
`[FrooxEngine]FrooxEngine.ComponentName`（例: `[FrooxEngine]FrooxEngine.QuadMesh`）

### SyncList の2段階プロトコル（重要）
MeshRenderer.Materials 等の SyncList は `addComponent` / 単純な `updateComponent` では設定できない。
`ResoniteLinkClient.updateListFields()` が以下の2段階プロトコルを実装:
1. `updateComponent` で要素追加（`id` なし → `targetId` は null になる）
2. `getComponent` でサーバーが割り振った要素 `id` を取得
3. `updateComponent` で `id` 付きの要素を送って `targetId` を設定

参照: `resolink-mcp/CLAUDE.md` の「Materials リストの更新（2段階必要）」セクション。

### 座標系変換
```
Udonarium (2D)       Resonite (3D Y-up)
+X → 右               +X → 右
+Y → 下               +Y → 上
posZ → 高さ           +Z → 奥

resonite.x =  udonarium.x    * SCALE_FACTOR (0.02)
resonite.y =  udonarium.posZ * SCALE_FACTOR (0.02)
resonite.z = -udonarium.y    * SCALE_FACTOR (0.02)
```
- Udonarium は `location.x` / `location.y` / `posZ` を座標に使用（`posX`/`posY` は存在しない）
- Udonarium はオブジェクト底面が座標位置、Resonite は中心が座標位置
  - terrain: `position.y += depth / 2`
  - character: `position.y += size.y / 2`

### サイズ変換
- オブジェクト寸法は Udonarium の値をそのまま Mesh の `Size` に反映（`QuadMesh.Size` / `BoxMesh.Size`）。
- `Slot.scale` は変更しない（デフォルト 1,1,1）。
- インポートルートコンテナに `IMPORT_GROUP_SCALE`（0.1）を適用して最終サイズを調整。
- `BoxCollider.Size` はメッシュ `Size` から自動計算。`QuadMesh` は厚み `z=0.01` を付与。

### 親子関係
- `<game-table>` 内のオブジェクト（terrain, character, card-stack 等）は `GameTable.children` に格納。
- `<card-stack>` 内の `<card>` は `CardStack.cards` に格納（`<node name="cardRoot">` 内を探索）。
- `XmlParser` のコンテナタグ（`game-table`, `card-stack`）は再帰探索をスキップし、重複を防止。
- `GameTable.children` の型は `GameTableChild[]`（`GameTable` を除外して循環型参照を回避）。
- テーブルの `position.y -= 0.1` オフセットは廃止（子要素の相対座標に影響するため）。

### マテリアル設定
- すべてのマテリアルは `BlendMode = Cutout` に統一（`UnlitMaterial`, `PBS_Metallic` 共通）。

### Electron IPC通信
- `select-file`: ファイル選択ダイアログ
- `analyze-zip`: ZIPファイル解析
- `import-to-resonite`: Resoniteへインポート
- `import-progress`: 進捗通知（メイン→レンダラー）

### デバッグツール
- `--dump-json` オプション: パース結果を `{入力ZIP名}.parsed.json` にファイル出力
- `--dry-run --verbose`: ResoniteLink接続なしで解析結果を表示

## モジュール構成

```
src/
├── index.ts                          # CLIエントリーポイント
├── config/
│   └── MappingConfig.ts              # 定数・マッピング設定
├── parser/
│   ├── ZipExtractor.ts               # ZIP解凍
│   ├── XmlParser.ts                  # XML解析基盤
│   └── objects/                      # オブジェクト別パーサー
│       ├── ParserUtils.ts            # 共通ユーティリティ (parsePosition等)
│       ├── CharacterParser.ts
│       ├── CardParser.ts
│       ├── TerrainParser.ts
│       ├── TableParser.ts
│       └── TextNoteParser.ts
├── converter/
│   ├── UdonariumObject.ts            # Udonariumオブジェクト型定義
│   ├── ResoniteObject.ts             # Resoniteオブジェクト型定義
│   ├── ObjectConverter.ts            # 変換ディスパッチ + BoxCollider付与
│   └── objectConverters/             # 種別ごとの変換ロジック
│       ├── componentBuilders.ts      # QuadMesh/BoxMesh コンポーネント生成
│       ├── characterConverter.ts
│       ├── cardConverter.ts
│       ├── cardStackConverter.ts
│       ├── terrainConverter.ts
│       ├── tableConverter.ts
│       └── textNoteConverter.ts
├── resonite/
│   ├── ResoniteLinkClient.ts         # WebSocketクライアント
│   ├── SlotBuilder.ts                # スロット生成 + SyncList分離
│   ├── AssetImporter.ts              # アセットインポート
│   └── registerExternalUrls.ts       # 外部URL画像登録
├── gui/                              # Electron GUI
└── i18n/                             # 国際化
```

## 将来の改善候補

- エラーハンドリングの強化（接続リトライロジック等）
- GUI版のUX改善（ドラッグ&ドロップ対応等）
- テストカバレッジ向上

## 更新履歴

### 2026-02-10
- `game-table` の親子関係保持: 子オブジェクトを `GameTable.children` に格納。
- `card-stack` の重複カード問題を修正: `<node name="cardRoot">` 内のカード探索を追加。
- コンテナタグ（`game-table`, `card-stack`）の再帰探索スキップで重複防止。
- テーブルの Y オフセット（-0.1）を廃止。
- XML座標パースを `location.x` / `location.y` / `posZ` に統一。
- オブジェクトの原点位置の違い（底面 vs 中心）に対応（terrain: `+depth/2`, character: `+size.y/2`）。
- terrain の寸法マッピングを修正: Udonarium `depth`→Resonite Y軸、`height`→Z軸。
- キャラクター画像の既知識別子を `KNOWN_IMAGE_IDENTIFIERS` に追加。
- テーブル親スロットの回転を廃止し、見た目用 `-surface` 子スロットを回転（x=90）させる構成に変更。
  - 目的: テーブル配下の子オブジェクト（地形など）の座標ずれ防止。
  - テーブルの `BoxCollider` は `-surface` 子スロット（MeshRenderer と同じスロット）に配置。
- コライダー実装を共通自動生成から各 converter 定義へ移行。
  - `ObjectConverter` のメッシュ依存 `ensureBoxCollider` を削除。
  - `character/card/card-stack/terrain/table/text-note` それぞれで
    `BoxCollider` の `Size` を個別に指定。

### 2026-02-09
- GIF画像に `StaticTexture2D.FilterMode = Point` を設定。
- 全マテリアルを `BlendMode = Cutout` に統一。
- サイズ基準を「1マス=1m」に統一し、`Slot.scale` ではなく Mesh `Size` で寸法を定義。
- `SIZE_MULTIPLIER` を廃止、`IMPORT_GROUP_SCALE`（0.1）をルートコンテナに適用。
- `BoxCollider.Size` をメッシュ `Size` から自動計算するよう変更。
- カード・テーブルの Quad を水平配置（rotation.x=90）に変更。

### 2026-02-07〜08
- `UdonariumObject` → `ResoniteObject` 変換パイプライン実装。
- オブジェクト種別ごとの converter を `src/converter/objectConverters/` に分離。
- テクスチャ処理フローを「先に asset import、後でオブジェクト生成」に変更。
- MeshRenderer.Materials の SyncList 2段階プロトコルを実装。
- 既知画像識別子（`KNOWN_IMAGE_IDENTIFIERS`）の外部URL解決を追加。
- `--dump-json` オプションを追加（パース結果のJSON出力）。
- `registerExternalUrls.ts` で外部URL画像登録処理を共通化。
- 各converter の単体テストを追加。
- ESLint 9 flat config 移行、依存ライブラリ更新。
