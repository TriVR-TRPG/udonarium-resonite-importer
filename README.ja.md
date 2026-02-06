# Udonarium Resonite Importer

[Udonarium](https://github.com/TK11235/udonarium)のセーブデータを、[ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink)経由で[Resonite](https://resonite.com/)にインポートするツールです。

## 特徴

- ZIPファイルを指定するだけでインポート可能
- キャラクター、カード、地形、テーブルなど主要オブジェクトに対応
- 画像アセットの自動インポート
- ドライランモードで事前確認が可能
- **GUI版**（Electron）で初心者でも簡単に使用可能

## 対応オブジェクト

| Udonarium | Resonite表現 |
|-----------|-------------|
| キャラクター (GameCharacter) | Quad + テクスチャ |
| カード (Card) | 両面Quad |
| カードの山 (CardStack) | グループ化されたカード |
| 地形 (Terrain) | Cube + テクスチャ |
| テーブル (GameTable) | Quad |
| テキストノート (TextNote) | UIX Text |

## 必要環境

- Node.js 18以上（20.18.2推奨、[mise](https://mise.jdx.dev/)で管理）
- Resonite + ResoniteLinkが有効化された状態

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/blhsrwznrghfzpr/udonarium-resonite-importer.git
cd udonarium-resonite-importer

# サブモジュールを初期化
git submodule update --init --recursive

# 依存関係をインストール
npm install

# ビルド
npm run build
```

## 使用方法

### GUI版（推奨）

プログラムに詳しくない方はGUI版をご利用ください。

```bash
# GUIをビルドして起動
npm run build:gui
npm run start:gui
```

1. 「参照...」ボタンでUdonariumのZIPファイルを選択
2. 解析結果を確認
3. ResoniteLinkの設定（通常はデフォルトでOK）
4. 「Resoniteにインポート」ボタンをクリック

### CLI版

#### 基本的な使い方

```bash
# Resoniteに接続してインポート
npm run start -- -i ./save.zip

# ポートを指定
npm run start -- -i ./save.zip -p 7869

# 言語を指定
npm run start -- -i ./save.zip -l ja
```

### ドライランモード（接続せずに解析のみ）

```bash
npm run start -- -i ./save.zip --dry-run
```

### 詳細ログ

```bash
npm run start -- -i ./save.zip --verbose
```

## CLIオプション

| オプション | 短縮形 | 説明 | デフォルト |
|------------|--------|------|------------|
| `--input` | `-i` | 入力ZIPファイルパス | (必須) |
| `--port` | `-p` | ResoniteLinkポート | 7869 |
| `--host` | `-H` | ResoniteLinkホスト | localhost |
| `--scale` | `-s` | スケール係数 | 0.02 |
| `--dry-run` | `-d` | 解析のみ（接続しない） | false |
| `--verbose` | `-v` | 詳細ログ出力 | false |
| `--lang` | `-l` | 言語（en, ja） | 自動検出 |

## 実行例

```
$ npm run start -- -i session.zip -p 7869

Udonarium Resonite Importer v1.0.0
========================================

[1/4] ZIP extracted - XML: 15, Images: 23
[2/4] Parsed 29 objects
[3/4] Connected to ResoniteLink
[4/4] Import complete - Images: 23/23, Objects: 29/29

Import completed successfully!
Check Resonite to see the imported objects.
```

## スタンドアロン実行ファイルの作成

```bash
# Windows用
npm run package:cli:win

# macOS用
npm run package:cli:mac

# Linux用
npm run package:cli:linux

# 全プラットフォーム（CLI）
npm run package:cli
```

## 座標系変換

Udonariumの2D座標系からResoniteの3D座標系に変換されます：

```
Udonarium (2D)           Resonite (3D)
  +X → 右                  +X → 右
  +Y → 下                  +Y → 上
                           +Z → 奥
```

- `resonite.x = udonarium.x * SCALE_FACTOR`
- `resonite.y = 0`（テーブル高さ）
- `resonite.z = -udonarium.y * SCALE_FACTOR`

デフォルトの`SCALE_FACTOR`は0.02（50px = 1m）です。

## 開発

### ビルドコマンド

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

# Lint & Format
npm run lint
npm run format

# 型チェック
npm run typecheck
```

### テスト

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

#### テスト構成

| 種別 | 説明 | テスト数 |
|------|------|---------|
| ユニットテスト | モックを使用した高速テスト | 216 |
| 統合テスト | 実際のResoniteLinkに接続するテスト | 15 |

統合テストは**デフォルトでスキップ**され、`RESONITE_LINK_AVAILABLE=true`が設定された場合のみ実行されます。これにより、Resoniteが不要なCI環境でも安全に動作します。

#### テストカバレッジ

```bash
npm run test:coverage
```

カバレッジレポートは`coverage/`ディレクトリに生成されます。

### ResoniteLinkモックデータ収集

ResoniteLinkのAPIが変更された場合、テスト用のモックデータを再生成できます：

```bash
# Resonite + ResoniteLinkが有効な状態で実行
npm run collect:resonitelink
```

実際のAPIレスポンスを収集し、`src/__fixtures__/resonitelink/`に保存します。

## GUI版パッケージング

```bash
# Windows用
npm run package:gui:win

# macOS用
npm run package:gui:mac

# Linux用
npm run package:gui:linux

# 全プラットフォーム
npm run package:gui
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

## ライセンス

MIT

## 関連リンク

- [Udonarium](https://github.com/TK11235/udonarium) - Webベースのバーチャルテーブルトップ
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite連携ツール
- [Resonite Wiki - Connecting to Other Applications](https://wiki.resonite.com/Connecting_Resonite_to_Other_Applications)
