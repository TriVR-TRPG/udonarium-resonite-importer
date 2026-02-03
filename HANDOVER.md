# 引き継ぎメモ

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

## 今回のセッションで行った作業

### 1. npm scriptsの再編成

- `build` コマンドを `build:cli` と `build:gui` の両方を実行するように変更
- `build:all` を削除し、`build` に統合
- スクリプトの命名規則を整理

### 2. npm-run-all2の導入

- `npm-run-all2` パッケージをインストール
- `run-p`（並列実行）と `run-s`（順次実行）を使用してスクリプトを簡潔に記述

### 3. ワイルドカードパターンの適用

以下のスクリプトでワイルドカードパターンを使用:
- `"build": "run-p build:*"` - CLI/GUIビルドを並列実行
- `"typecheck": "run-p typecheck:*"` - 型チェックを並列実行
- `"package:cli": "run-p package:cli:*"` - CLIパッケージングを並列実行

## 未完了タスク

### PRの作成

ユーザーから「masterとの差分でPRを作って」とリクエストあり。

PR作成に必要な情報:
- **タイトル案**: `refactor: Reorganize npm scripts with npm-run-all2`
- **変更内容**:
  - npm scriptsの再編成（build, typecheck, package）
  - npm-run-all2の導入による並列/順次実行の明確化
  - ワイルドカードパターンによる拡張性の向上

## 技術的な設計判断

### tsconfig分離の理由

- `tsconfig.cli.json`: ES2022 libのみ（DOMなし）
- `tsconfig.gui.json`: ES2022 + DOM lib
- CLI版でブラウザAPIを誤使用することを防止

### WebSocket イベントリスナーの修正

`ResoniteLinkClient`で以下を修正済み:
- `disconnected`リスナーをコンストラクタで一度だけ登録
- `connected`リスナーにクリーンアップ関数を追加

## プロジェクト構成

```
udonarium-resonite-importer/
├── src/
│   ├── index.ts          # CLIエントリーポイント
│   ├── gui/              # Electron GUI
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   └── renderer.ts
│   ├── parser/           # XMLパーサー
│   ├── resonite/         # ResoniteLink通信
│   └── i18n/             # 国際化対応
├── lib/
│   └── resonitelink.js/  # git submodule
├── .github/
│   └── workflows/
│       └── lint.yml      # PRでのLint自動実行
└── .husky/
    └── pre-commit        # コミット時のlint-staged実行
```

## 環境設定

- **Node.js**: 20.18.2（Voltaで固定）
- **パッケージマネージャー**: npm

## 次回作業の推奨事項

1. PRを作成（`gh pr create`コマンド使用）
2. CI（GitHub Actions）での動作確認
3. レビュー後にマージ
