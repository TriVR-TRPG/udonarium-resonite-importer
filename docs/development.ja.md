# 開発ガイド

[English](development.md)

## ビルドコマンド

```bash
# CLI版とGUI版を並列ビルド
npm run build

# CLI版のみビルド
npm run build:cli

# GUI版のみビルド
npm run build:gui

# 開発モードで実行
npm run dev -- -i ./save.zip --dry-run

# GUI開発モード
npm run dev:gui
```

## 検証・自動修正

```bash
# 自動修正してから検証（lint, format, types）
npm run check

# 検証のみ（自動修正なし）
npm run check:validate

# 自動修正のみ
npm run check:fix
```

## テスト

このプロジェクトでは[Vitest](https://vitest.dev/)を使用しています。

```bash
# ユニットテスト実行
npm run test

# ウォッチモードでテスト
npm run test:watch

# カバレッジレポート付きテスト
npm run test:coverage

# 統合テスト実行（Resonite + ResoniteLinkが必要）
npm run test:integration
```

### テスト構成

| 種別 | 説明 | テスト数 |
|------|------|---------|
| ユニットテスト | モックを使用した高速テスト | 217 |
| 統合テスト | 実際のResoniteLinkに接続するテスト | 15 |

統合テストは**デフォルトでスキップ**され、`RESONITE_LINK_AVAILABLE=true`が設定された場合のみ実行されます。これにより、Resoniteが不要なCI環境でも安全に動作します。

### ResoniteLinkモックデータ収集

ResoniteLinkのAPIが変更された場合、テスト用のモックデータを再生成できます：

```bash
# Resonite + ResoniteLinkが有効な状態で実行
npm run collect:resonitelink
```

実際のAPIレスポンスを収集し、`src/__fixtures__/resonitelink/`に保存します。

## パッケージング

### CLIスタンドアロン実行ファイル

```bash
npm run package:cli:win      # Windows
npm run package:cli:mac      # macOS
npm run package:cli:linux    # Linux
npm run package:cli          # 全プラットフォーム
```

### GUIパッケージング

```bash
npm run package:gui:win      # Windows
npm run package:gui:mac      # macOS
npm run package:gui:linux    # Linux
npm run package:gui          # 全プラットフォーム
```

## プロジェクト構成

```
udonarium-resonite-importer/
├── src/
│   ├── index.ts                 # CLIエントリーポイント
│   ├── config/                  # 設定
│   ├── parser/                  # ZIP/XML解析
│   │   └── objects/             # オブジェクト別パーサー
│   ├── converter/               # Udonarium → Resonite変換
│   ├── resonite/                # ResoniteLinkクライアント
│   ├── gui/                     # Electron GUI
│   ├── i18n/                    # 国際化
│   └── __fixtures__/            # テストフィクスチャ
├── scripts/                     # ユーティリティスクリプト
├── lib/
│   └── resonitelink.js/         # ResoniteLinkライブラリ（サブモジュール）
└── .github/
    └── workflows/               # CI/CDパイプライン
```

## 変換仕様ドキュメント

オブジェクト種別ごとの変換仕様は以下を参照してください。

- [docs/object-conversion/README.ja.md](object-conversion/README.ja.md)

## 座標系変換

Udonariumの2D座標系からResoniteの3D座標系に変換されます：

```
Udonarium (2D)           Resonite (3D Y-up)
  +X → 右                  +X → 右
  +Y → 下                  +Y → 上
  posZ → 高さ              +Z → 奥
```

- `resonite.x =  udonarium.x    * SCALE_FACTOR`
- `resonite.y =  udonarium.posZ * SCALE_FACTOR`
- `resonite.z = -udonarium.y    * SCALE_FACTOR`

デフォルトの`SCALE_FACTOR`は0.02（50px = 1m）です。

Udonariumは `location.x` / `location.y` / `posZ` を座標に使用します。
Udonariumではオブジェクトの端が座標位置ですが、Resoniteでは中心が座標位置のため、各converterでオブジェクトごとに中心補正を適用しています。
例:
- terrain: `x += width/2`, `y += height/2`, `z -= depth/2`
- character: `x += size/2`, `y += size/2`, `z -= size/2`
- card/card-stack/text-note: `x += width/2`, `z -= height/2`
