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
