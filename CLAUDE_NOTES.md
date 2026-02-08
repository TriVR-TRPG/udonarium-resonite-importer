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

## ResoniteLink接続

ポートはResoniteのワールド起動ごとに変わるため、以下のいずれかで設定:
- CLIオプション: `-p 12345`
- 環境変数: `RESONITELINK_PORT=12345`
- `.env`ファイル（`.env.example`をコピー）

統合テスト実行例: `RESONITELINK_PORT=12345 npm run test:integration`

## 技術的なメモ

### テクスチャインポート
- `importTexture2DFile`: ファイルパスを受け取り、全画像形式に対応
- `importTexture2DRawData`: 生のRGBAピクセルデータを期待（エンコード済み画像はNG）
- AssetImporterがZIPから一時ファイルに展開し、`importTexture(filePath)`で直接インポート

### FrooxEngineコンポーネント型形式
`[FrooxEngine]FrooxEngine.ComponentName`（例: `[FrooxEngine]FrooxEngine.QuadMesh`）

### Electron IPC通信
- `select-file`: ファイル選択ダイアログ
- `analyze-zip`: ZIPファイル解析
- `import-to-resonite`: Resoniteへインポート
- `import-progress`: 進捗通知（メイン→レンダラー）

### 座標系変換
```
Udonarium (2D)       Resonite (3D)
+X → 右               +X → 右
+Y → 下               +Y → 上
                      +Z → 奥

resonite.x = udonarium.x * 0.02
resonite.y = 0
resonite.z = -udonarium.y * 0.02
```

## 将来の改善候補

- エラーハンドリングの強化（接続リトライロジック等）
- GUI版のUX改善（ドラッグ&ドロップ対応等）
- テストカバレッジ向上

## 最近の更新 (2026-02-07)
- `UdonariumObject` から `ResoniteObject` へのコンポーネント/スロット変換パイプラインを実装。
- `src/converter/ObjectConverter.ts`
  - オブジェクト種別ごとのコンポーネント定義を追加:
    - character/card/table: `QuadMesh`, `UnlitMaterial`, `MeshRenderer`, `StaticTexture2D`
    - terrain: `BoxMesh`, `PBS_Metallic`, `MeshRenderer`, `StaticTexture2D`
    - text-note: `UIX.Text`
  - `card-stack` から子スロットを生成する処理を追加。
  - テクスチャプレースホルダー解決を追加:
    - 形式: `texture://<identifier>`
    - 解決関数: `resolveTexturePlaceholders(objects, textureMap)`
- `src/resonite/SlotBuilder.ts`
  - スロット作成後に `client.addComponent(...)` でコンポーネントを追加する処理を実装。
- `src/resonite/ResoniteLinkClient.ts`
  - `addComponent` を拡張し、任意のコンポーネントID指定とコンポーネントID返却に対応。
  - `addComponents(...)` ヘルパーを追加。
- `src/index.ts` と `src/gui/main.ts`
  - 画像インポート後、スロット生成前にテクスチャ解決を接続:
    - `resolveTexturePlaceholders(resoniteObjects, assetImporter.getImportedTextures())`
- `src/converter/ResoniteObject.ts`
  - `ResoniteComponent` に任意 `id` を追加（参照の安定化目的）。
- `ObjectConverter` の可読性向上のため、オブジェクト種別ごとの変換処理をファイル分離。
  - 追加ディレクトリ: `src/converter/objectConverters/`
  - 追加ファイル:
    - `characterConverter.ts`
    - `cardConverter.ts`
    - `cardStackConverter.ts`
    - `terrainConverter.ts`
    - `tableConverter.ts`
    - `textNoteConverter.ts`
    - `componentBuilders.ts`
- `src/converter/ObjectConverter.ts` はディスパッチ中心に整理し、種別ごとの詳細ロジックを委譲。
- テクスチャ置換ロジック（`replaceTexturesInValue`）を `componentBuilders.ts` に移動し、責務を集約。
- `objectConverters` 各変換関数の単体テストを追加。
  - 追加テスト:
    - `src/converter/objectConverters/characterConverter.test.ts`
    - `src/converter/objectConverters/cardConverter.test.ts`
    - `src/converter/objectConverters/cardStackConverter.test.ts`
    - `src/converter/objectConverters/terrainConverter.test.ts`
    - `src/converter/objectConverters/tableConverter.test.ts`
    - `src/converter/objectConverters/textNoteConverter.test.ts`
  - 検証観点:
    - オブジェクト種別ごとの scale 設定
    - components/children の生成内容
    - `card-stack` の子スロット高さオフセット
    - `text-note` のフォントサイズ下限 (min=8)
- 追加後に `npm run test` と `npm run check:validate` を実行し、すべて通過を確認。
- AIレビュー指摘への対応を実施。
  - `src/converter/objectConverters/cardConverter.ts`
    - `Card.isFaceUp` と `frontImage` / `backImage` を使って表示テクスチャを選択するよう修正。
    - フォールバック順:
      - 表向き: `frontImage` -> `backImage` -> `images[0]`
      - 裏向き: `backImage` -> `frontImage` -> `images[0]`
  - `src/converter/objectConverters/cardConverter.test.ts`
    - 表裏状態とフォールバックの単体テストを追加。
  - `src/resonite/registerExternalUrls.ts` を新規追加し、外部URL画像登録処理を共通化。
  - `src/gui/main.ts`
    - GUIインポートフローでも `registerExternalUrls(parseResult.objects, assetImporter)` を実行するよう修正。
  - `src/index.ts`
    - CLI側の外部URL登録処理を共通モジュール利用へ置換。
- 検証コマンド: `npm run check`（fix + validate）を実行し、通過を確認。
- ResoniteLink実機確認のため、Integrationテストを実行して converter 連携を検証。
  - 実行: `RESONITE_LINK_AVAILABLE=true` で `vitest` の Integration テスト群を実行
  - 結果: `src/resonite/integration.test.ts` の全15テストが通過（ResoniteLink接続状態で確認）
- `src/resonite/integration.test.ts` を改善。
  - `.env` から `RESONITELINK_PORT` を読み込むため `dotenv.config()` を追加
  - `beforeAll` 失敗時に `afterAll` が二次障害を起こさないよう、`client` 未初期化ガードを追加
- 検証:
  - `npm run check` 通過
  - `npm run test` 通過
- テクスチャ処理フローを「先にasset import、後でオブジェクト生成」に変更。
  - `src/index.ts`
    - 非 dry-run 時は画像インポート完了後に `convertObjectsWithTextureMap(...)` でオブジェクトを生成するよう変更。
    - `resolveTexturePlaceholders(...)` 依存を除去。
  - `src/gui/main.ts`
    - GUIインポート時も画像インポート後に `convertObjectsWithTextureMap(...)` で生成するよう変更。
- converter 側で texture URL を直接反映できるよう拡張。
  - `src/converter/ObjectConverter.ts`
    - `convertObjectsWithTextureMap(udonObjects, textureMap)` を追加。
  - `src/converter/objectConverters/componentBuilders.ts`
    - `resolveTextureValue(...)` を追加。
    - `build*Components` がプレースホルダーではなく最終URLを受け取れるよう変更。
  - `character/card/table/terrain` converter が `textureMap` を受け取り、`StaticTexture2D.URL` に最終URL（またはフォールバック値）を設定するよう変更。
- 実行確認:
  - `npm run check` 通過
  - `npm run test` 通過
  - 実機確認: `roomdata-sample-image.zip` のインポート成功（Images: 2/2, Objects: 9/9）
- TypeScript 5.9.3 対応のため、ESLintルール適合を修正。
  - `src/resonite/ResoniteLinkClient.ts`
    - `tryConnect()` 内の `reject(error)` を `Error` 型へ正規化して reject する実装に変更。
    - 対応ルール: `@typescript-eslint/prefer-promise-reject-errors`
- 検証:
  - `npm run check` 通過
  - `npm run test` 通過
- 開発環境の Node.js を最新LTS系へ更新。
  - `/.mise.toml` の `node` を `20.18.2` から `24` へ変更（24.x LTS 系を利用）。
- `npm ci` の warning 低減対応として依存更新を実施。
  - `package.json`
    - `eslint` を `^9.39.2` へ更新
    - `@typescript-eslint/parser` / `@typescript-eslint/eslint-plugin` を `^8.54.0` へ更新
    - `eslint-config-prettier` を `^10.1.8` へ更新
    - `electron-builder` を `^26.7.0` へ更新
    - `fast-xml-parser` を `^5.3.4` へ更新（実行時依存の `dependencies` で管理）
  - `eslint.config.cjs` を追加し、ESLint 9 の flat config 形式で既存 `.eslintrc.json` を互換利用する構成へ移行。
- 検証:
  - `mise x -- npm run check` 通過
  - `mise x -- npm run test` 通過
  - `mise x -- npm ci` 実行時の warning は一部残存
    - 残存 warning の主因は `electron@28` / `electron-builder` 配下の推移依存（`boolean@3`, `glob@7/10`, `inflight`, `rimraf@2`）で、現行メジャー範囲では解消不可。
    - `npm audit` の残件は moderate 2件（`electron`, `pkg`）。`electron` は `40.x` へのメジャー更新で解消可能、`pkg` は fixAvailable なし。
