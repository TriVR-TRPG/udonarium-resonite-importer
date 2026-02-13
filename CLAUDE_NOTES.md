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
- `StaticTexture2D.WrapModeU` / `WrapModeV` は `Clamp` に設定

### 既知画像識別子
- `src/config/MappingConfig.ts` の `KNOWN_IMAGE_IDENTIFIERS` マップに定義
- Udonarium組み込みアセット（`testTableBackgroundImage_image` 等）を外部URLに解決
- `src/resonite/registerExternalUrls.ts` が `./` 相対パスと既知識別子の両方を処理

### FrooxEngineコンポーネント型形式
`[FrooxEngine]FrooxEngine.ComponentName`（例: `[FrooxEngine]FrooxEngine.QuadMesh`）

### ResoniteLink の型指定に関する注意
- enum 値は `$type: 'enum'` を使用すること。`enum?`（nullable型）だとコンポーネント作成に失敗する。
- 例: `BlendMode: { $type: 'enum', value: 'Cutout', enumType: 'BlendMode' }`

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
- `ResoniteObject` 型に `scale` フィールドは持たない（常にデフォルト 1,1,1）。
- インポートルートコンテナに `IMPORT_GROUP_SCALE`（0.1）を適用して最終サイズを調整。
- `BoxCollider.Size` は各 converter が個別に定義。`QuadMesh` は厚み `z=0.01` を付与。

### 親子関係
- `<game-table>` 内のオブジェクト（terrain, character, card-stack 等）は `GameTable.children` に格納。
- `<card-stack>` 内の `<card>` は `CardStack.cards` に格納（`<node name="cardRoot">` 内を探索）。
- `XmlParser` のコンテナタグ（`game-table`, `card-stack`）は再帰探索をスキップし、重複を防止。
- `GameTable.children` の型は `GameTableChild[]`（`GameTable` を除外して循環型参照を回避）。

### マテリアル設定
- 基本は `BlendMode = Cutout`（character, card, terrain, table, text-note）。
- table-mask は `BlendMode = Alpha`（半透明表現のため）。

### スロット active 制御
- `ResoniteObject` に `isActive?: boolean` を定義。
- `SlotBuilder` / `ResoniteLinkClient.addSlot` で `isActive` を受け渡し可能。
- terrain の `-walls` スロット（`mode === 1` で非表示）等に使用。

### Grabbable コンポーネント
- terrain: `isLocked === false` のとき付与。
- table-mask: `isLock === false` のとき付与。
- 注意: Udonarium の XML 属性名が terrain は `isLocked`、table-mask は `isLock` と異なるため、型プロパティ名もそれぞれ `isLocked` / `isLock` で定義。

### インポートの上書き動作
- ルートコンテナに `IMPORT_ROOT_TAG`（`udonarium-resonite-importer:root`）を付与。
- 新規インポート開始前に `Root` 直下を走査し、同タグの旧インポートルートを削除してから取り込みを実行。
- CLI（`src/index.ts`）とGUI（`src/gui/main.ts`）の両方で同じクリーンアップを実施。
- 旧インポートが存在する場合は、削除前に `position` / `rotation` / `scale` を取得し、
  新規インポートのルートコンテナに引き継ぐ。

### パーサーのデフォルト値
- 数値フィールドのデフォルト値は `??`（nullish coalescing）で設定すること。
- `||` を使うと `0` が falsy と判定され、意図せずデフォルト値に置換される。
- 文字列フィールド（`name || fileName` 等）は空文字列をフォールバックさせたいので `||` で正しい。

### Electron IPC通信
- `select-file`: ファイル選択ダイアログ
- `analyze-zip`: ZIPファイル解析
- `import-to-resonite`: Resoniteへインポート
- `import-progress`: 進捗通知（メイン→レンダラー）

### デバッグツール
- `npm run dev` 実行時: パース結果を `parsed/{入力ZIP名}.parsed.json` に自動出力（`__dirname`基準）
- `--dry-run --verbose`: ResoniteLink接続なしで解析結果を表示

## オブジェクト変換仕様

種別ごとの詳細は [docs/object-conversion/](docs/object-conversion/README.ja.md) を参照。

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
│       ├── TableParser.ts            # GameTable + TableMask パーサー
│       └── TextNoteParser.ts
├── domain/
│   ├── UdonariumObject.ts            # Udonariumオブジェクト型定義（共通）
│   └── ResoniteObject.ts             # Resoniteオブジェクト型定義（共通）
├── converter/
│   ├── ObjectConverter.ts            # 変換ディスパッチ
│   └── objectConverters/             # 種別ごとの変換ロジック
│       ├── componentBuilders.ts      # QuadMesh/BoxMesh コンポーネント生成
│       ├── characterConverter.ts
│       ├── cardConverter.ts
│       ├── cardStackConverter.ts
│       ├── terrainConverter.ts
│       ├── tableConverter.ts
│       ├── tableMaskConverter.ts
│       └── textNoteConverter.ts
├── resonite/
│   ├── ResoniteLinkClient.ts         # WebSocketクライアント
│   ├── SlotBuilder.ts                # スロット生成 + SyncList分離
│   ├── AssetImporter.ts              # アセットインポート
│   └── registerExternalUrls.ts       # 外部URL画像登録
├── gui/                              # Electron GUI
└── i18n/                             # 国際化
```

> 注: 互換性維持用の `src/converter/UdonariumObject.ts` / `src/converter/ResoniteObject.ts` は削除済み。型は `src/domain/*` を唯一の参照先とする。

## 将来の改善候補

- エラーハンドリングの強化（接続リトライロジック等）
- GUI版のUX改善（ドラッグ&ドロップ対応等）
- テストカバレッジ向上
