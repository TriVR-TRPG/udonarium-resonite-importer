# Claude Code 引き継ぎメモ

## プロジェクト概要

Udonarium（Webベースのバーチャルテーブルトップ）のセーブデータを、ResoniteLink経由でResonite（VRプラットフォーム）にインポートするツール。

## 現在のブランチ状況

- **作業ブランチ**: `main`

## 完了した作業

### 基盤実装（過去セッション）
- TypeScriptプロジェクトの初期設定
- CLI版の実装（ZIPパース、XML解析、ResoniteLink接続）
- GUI版（Electron）の基本実装
- ESLint + Prettier の導入
- tsconfig分離（CLI用・GUI用）
- strictモードでのビルド成功
- i18n対応（日本語/英語）
- resonitelink.js をgit submoduleとして追加
- husky + lint-staged によるpre-commitフック
- GitHub Actions によるPR時のLint自動実行
- Volta によるNode.jsバージョン固定

### 今回のセッションで行った作業

1. **ネスト構造XMLパース対応**
   - `XmlParser.ts`に再帰パース機能（`findObjectsRecursively`）を追加
   - `<room>`や`<game-table>`内にネストされたオブジェクトを正しく検出
   - `game-table`タグのサポートを追加（`parseGameTable`関数）
   - キャラクター位置解析を修正（`location.x`/`location.y`属性対応）

2. **統合テストの拡充（114テスト）**
   - 実際のUdonariumセーブデータ（`roomdata-sample.zip`）を使用した統合テスト
   - テスト対象:
     - room内のキャラクター解析
     - game-table内の地形オブジェクト解析
     - カードスタック・単体カードの解析
     - game-tableの解析
     - キャラクターリソース（HP/MP）の解析
     - キャラクター位置の解析

3. **GitHub ActionsでのPRテスト自動実行**
   - `.github/workflows/lint.yml`にテスト実行ステップを追加
   - PR時にLint、型チェック、テストを全て実行

4. **Vitest ESM互換性修正**
   - `vitest.config.ts` を `vitest.config.mts` にリネーム
   - CommonJSプロジェクトでVitest 4.xを動作させるための対応

5. **個別パーサーのユニットテスト追加（177テスト総計）**
   - `CharacterParser.test.ts` (11テスト) - キャラクター解析、リソース解析、位置解析
   - `CardParser.test.ts` (15テスト) - カード解析、カードスタック解析
   - `TerrainParser.test.ts` (9テスト) - 地形解析、壁/床テクスチャ解析
   - `TextNoteParser.test.ts` (10テスト) - テキストノート解析
   - `TableParser.test.ts` (18テスト) - テーブル解析、game-table解析、マスク解析

6. **テストカバレッジ設定**
   - `@vitest/coverage-v8` パッケージを追加
   - `npm run test:coverage` でカバレッジレポート生成可能
   - 現在のカバレッジ: 全体53%、パーサー93-100%、Resonite関連0-20%

7. **PRカバレッジレポート**
   - `vitest-coverage-report-action` を導入
   - PR時にカバレッジサマリーがコメントとして自動投稿される

8. **SlotBuilder・AssetImporterのモック付きユニットテスト（216テスト総計）**
   - `SlotBuilder.test.ts` (20テスト) - スロット構築、子スロット再帰処理、インポートグループ作成
   - `AssetImporter.test.ts` (19テスト) - 画像インポート、キャッシュ処理、複数ファイルインポート

9. **ResoniteLinkデータ収集スクリプト**
   - `scripts/collect-resonitelink-data.ts` - 実際のResoniteLinkからレスポンスデータを収集
   - `src/__fixtures__/resonitelink/` - 収集したデータの保存先
   - `npm run collect:resonitelink` で実行可能
   - ResoniteLinkのAPI変更時にモックデータを再生成するために使用

10. **ResoniteLink統合テスト（231テスト総計、うち15が統合テスト）**
    - `src/resonite/integration.test.ts` (15テスト) - 実際のResoniteLinkに接続してテスト
    - テスト内容:
      - ResoniteLinkClientの接続・切断
      - スロットの作成・更新
      - テクスチャのインポート
      - SlotBuilderの階層構造作成
      - AssetImporterのキャッシュ機能
    - 実行方法: `npm run test:integration`（Resoniteが起動している必要あり）
    - 通常の `npm run test` ではスキップされる（CI環境で安全）

11. **READMEの更新**
    - `README.md` と `README.ja.md` にテストセクションを追加
    - ビルドコマンド、テストコマンド、データ収集スクリプトの説明を追加
    - プロジェクト構成セクションを追加

12. **pre-commitフックの強化**
    - lint-staged + typecheck + test を実行するように更新
    - コミット時にlint、型チェック、テストが全て通ることを保証

13. **GitHub Actions CI/CDの改善**
    - PR時にlint/format問題を自動修正してコミット
    - `stefanzweifel/git-auto-commit-action@v5` を使用
    - 自動修正後に検証ステップを実行

14. **ResoniteLinkポート設定の必須化と環境変数対応**
    - Resoniteはワールド起動ごとに異なるポートを使用するため、デフォルトポートを削除
    - `dotenv`パッケージを追加し、`.env`ファイルからの設定読み込みに対応
    - 環境変数: `RESONITELINK_PORT`（必須）、`RESONITELINK_HOST`（オプション、デフォルト: localhost）
    - CLI: `-p`オプションまたは環境変数でポート指定必須（`--dry-run`時は不要）
    - 変更ファイル:
      - `src/config/MappingConfig.ts` - 環境変数読み取り関数追加
      - `src/index.ts` - dotenv読み込み、ポート検証ロジック追加
      - `src/resonite/ResoniteLinkClient.ts` - コンストラクタでポート必須化
      - `src/resonite/integration.test.ts` - 環境変数からポート読み取り
      - `scripts/collect-resonitelink-data.ts` - 環境変数からポート読み取り
      - `DESIGN.md` - CLI仕様更新
      - `.env.example` - 新規作成

15. **GUI配布をZIP形式に統一**
    - Windows/macOSのElectron配布をインストーラー（NSIS/DMG）ではなくZIPに変更
    - `electron-builder` のターゲットを `zip` に更新（LinuxはAppImageのまま）
    - 非技術者向けのZIP配布方針に実装を合わせるための調整

16. **コンポーネントフィクスチャデータの収集**
    - Udonariumオブジェクト表現に必要な12種類のコンポーネントのテストデータを収集
    - `src/__fixtures__/resonitelink/components/` に各コンポーネントのフィクスチャを保存
    - コンポーネントタイプ形式: `[FrooxEngine]FrooxEngine.ComponentName`
    - 対象コンポーネント:
      - Mesh: QuadMesh, BoxMesh
      - Rendering: MeshRenderer
      - Materials: PBS_Metallic, UnlitMaterial
      - Textures: StaticTexture2D
      - Interaction: Grabbable, BoxCollider
      - UIX: Canvas, Text, VerticalLayout, Image
    - 不要になった旧コンポーネントレスポンスファイルを削除（addComponent-response.json等）
    - README.mdにコンポーネントフィクスチャのドキュメントを追加

### 過去のセッションで行った作業

1. **npm scriptsの再編成**
   - `build` コマンドを `build:cli` と `build:gui` の両方を実行するように変更
   - `build:all` を削除し、`build` に統合
   - スクリプトの命名規則を整理

2. **npm-run-all2の導入**
   - `npm-run-all2` パッケージをインストール
   - `run-p`（並列実行）と `run-s`（順次実行）を使用してスクリプトを簡潔に記述

3. **ワイルドカードパターンの適用**
   - `"build": "run-p build:*"` - CLI/GUIビルドを並列実行
   - `"typecheck": "run-p typecheck:*"` - 型チェックを並列実行
   - `"package:cli": "run-p package:cli:*"` - CLIパッケージングを並列実行

4. **ユニットテストの実装**
   - Vitestをセットアップ（vitest.config.ts）
   - 高優先度モジュールのテストを作成:
     - `ObjectConverter.test.ts` (19テスト) - 座標変換、サイズ変換、オブジェクト変換
     - `ParserUtils.test.ts` (36テスト) - findDataByName, getTextValue, getNumberValue, getBooleanValue
     - `ZipExtractor.test.ts` (16テスト) - ZIP展開、ファイルフィルタリング
     - `XmlParser.test.ts` (16テスト) - 各オブジェクト型のパース
     - `ResoniteLinkClient.test.ts` (16テスト) - 接続状態、エラーハンドリング

## ファイル構成

```
udonarium-resonite-importer/
├── src/
│   ├── index.ts                 # CLIエントリーポイント
│   ├── config/
│   │   └── MappingConfig.ts     # 座標変換設定
│   ├── parser/
│   │   ├── ZipExtractor.ts      # ZIP解凍
│   │   ├── XmlParser.ts         # XML解析
│   │   └── objects/             # 各オブジェクトパーサー
│   ├── converter/
│   │   ├── UdonariumObject.ts   # Udonarium型定義
│   │   ├── ResoniteObject.ts    # Resonite型定義
│   │   └── ObjectConverter.ts   # 変換ロジック
│   ├── resonite/
│   │   ├── ResoniteLinkClient.ts    # WebSocketクライアント
│   │   ├── SlotBuilder.ts           # スロット生成
│   │   └── AssetImporter.ts         # アセットインポート
│   ├── gui/
│   │   ├── main.ts              # Electronメインプロセス
│   │   ├── preload.ts           # プリロードスクリプト
│   │   ├── renderer.ts          # レンダラースクリプト
│   │   ├── types.ts             # 共有型定義
│   │   ├── electron.d.ts        # Electron型宣言
│   │   ├── index.html           # GUI HTML
│   │   └── styles.css           # GUI スタイル
│   └── i18n/                    # 国際化対応
├── lib/
│   └── resonitelink.js/         # git submodule
├── .github/
│   └── workflows/
│       └── lint.yml             # PRでのLint・テスト自動実行
└── .husky/
    └── pre-commit               # コミット時のlint-staged実行
```

## ビルドコマンド

```bash
npm run build          # CLI/GUI両方ビルド（並列）
npm run build:cli      # CLI版のみビルド
npm run build:gui      # GUI版のみビルド
npm run typecheck      # 型チェック（並列）
npm run lint           # ESLintチェック
npm run format         # Prettierフォーマット
npm run test           # ユニットテスト実行（統合テストはスキップ）
npm run test:watch     # テストをウォッチモードで実行
npm run test:coverage  # カバレッジ付きテスト実行
npm run test:integration  # 統合テスト実行（Resonite起動必須）
npm run collect:resonitelink  # ResoniteLinkからモック用データを収集
npm run package        # CLI/GUIパッケージング（順次）
```

## 環境設定

- **Node.js**: 20.18.2（Voltaで固定）
- **パッケージマネージャー**: npm

### ResoniteLink接続設定

ポートはワールド起動ごとに変わるため、以下のいずれかで設定:

1. CLIオプション: `-p 12345`
2. 環境変数: `RESONITELINK_PORT=12345`
3. `.env`ファイル: `.env.example`をコピーして設定

```bash
# 統合テスト実行例
RESONITELINK_PORT=12345 npm run test:integration
```

## 技術的なメモ

### TypeScript設定
- `tsconfig.cli.json`: CLI用（DOM除外）- ブラウザAPIの誤使用を防止
- `tsconfig.gui.json`: GUI用（DOM含む）
- 両方strict: trueで設定

### WebSocket イベントリスナー
`ResoniteLinkClient`で以下を修正済み:
- `disconnected`リスナーをコンストラクタで一度だけ登録
- `connected`リスナーにクリーンアップ関数を追加

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

## 未完了タスク

### PRの作成

PR作成に必要な情報:
- **タイトル案**: `feat: Add unit tests with Vitest`
- **変更内容**:
  - npm scriptsの再編成（build, typecheck, package）
  - npm-run-all2の導入による並列/順次実行の明確化
  - Vitestによるユニットテスト（103テスト）

### 追加テスト（中優先度）

| モジュール | テスト種別 | 状況 |
|-----------|----------|------|
| CharacterParser | Unit | ✅ 完了 (11テスト) |
| CardParser | Unit | ✅ 完了 (15テスト) |
| TerrainParser | Unit | ✅ 完了 (9テスト) |
| TextNoteParser | Unit | ✅ 完了 (10テスト) |
| TableParser | Unit | ✅ 完了 (18テスト) |
| SlotBuilder | Unit (モック) | ✅ 完了 (20テスト) - 階層構造の再帰処理 |
| AssetImporter | Unit (モック) | ✅ 完了 (19テスト) - キャッシュ処理 |

### その他
- エラーハンドリングの強化（接続リトライロジック等）
- GUI版のUX改善（ドラッグ&ドロップ対応等）
- ドキュメント改善

## 次回作業の推奨事項

1. PRを作成（`gh pr create`コマンドまたはGitHub Web UI使用）
2. エラーハンドリングの強化
3. GUI版のUX改善（ドラッグ&ドロップ対応等）
4. カバレッジ向上（現在53%）
