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

- Node.js 18以上
- Resonite + ResoniteLinkが有効化された状態

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/blhsrwznrghfzpr/udonarium-resonite-importer.git
cd udonarium-resonite-importer

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
npm run package:win

# macOS用
npm run package:mac

# Linux用
npm run package:linux

# 全プラットフォーム
npm run package:all
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

```bash
# CLI版ビルド
npm run build

# GUI版ビルド
npm run build:gui

# 両方ビルド
npm run build:all

# 開発モードで実行
npm run dev -- -i ./save.zip --dry-run

# GUI開発モード
npm run dev:gui

# Lint & Format
npm run lint
npm run format
```

## GUI版パッケージング

```bash
# Windows用
npm run package:gui:win

# macOS用
npm run package:gui:mac

# Linux用
npm run package:gui:linux

# 全プラットフォーム
npm run package:gui:all
```

## ライセンス

MIT

## 関連リンク

- [Udonarium](https://github.com/TK11235/udonarium) - Webベースのバーチャルテーブルトップ
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite連携ツール
- [Resonite Wiki - Connecting to Other Applications](https://wiki.resonite.com/Connecting_Resonite_to_Other_Applications)
