# Claude Code 引き継ぎメモ

## プロジェクト概要

Udonarium（Webベースのバーチャルテーブルトップ）のセーブデータを、ResoniteLink経由でResonite（VRプラットフォーム）にインポートするツール。

## 現在のブランチ状況

- **作業ブランチ**: `claude/udonarium-resonite-importer-odZc3`
- **ベースブランチ**: `origin/main`

### origin/mainとの差分コミット

```
b145ce9 refactor: Use wildcard patterns for parallel npm scripts
36cc7b5 refactor: Use npm-run-all2 for cleaner script definitions
e18b6ff refactor: Reorganize npm scripts for clarity
351a350 refactor: Reorganize build scripts for consistency
```

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
│       └── lint.yml             # PRでのLint自動実行
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
npm run package        # CLI/GUIパッケージング（順次）
```

## 環境設定

- **Node.js**: 20.18.2（Voltaで固定）
- **パッケージマネージャー**: npm

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
- **タイトル案**: `refactor: Reorganize npm scripts with npm-run-all2`
- **変更内容**:
  - npm scriptsの再編成（build, typecheck, package）
  - npm-run-all2の導入による並列/順次実行の明確化
  - ワイルドカードパターンによる拡張性の向上

### 中優先度
- エラーハンドリングの強化（接続リトライロジック等）
- GUI版のUX改善（ドラッグ&ドロップ対応等）

### 低優先度
- テストの追加（Jest等）
- ドキュメント改善

## 次回作業の推奨事項

1. PRを作成（`gh pr create`コマンドまたはGitHub Web UI使用）
2. CI（GitHub Actions）での動作確認
3. レビュー後にマージ
