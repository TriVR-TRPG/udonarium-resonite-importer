# Udonarium Resonite Importer

[Udonarium](https://github.com/TK11235/udonarium)のセーブデータを、[ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink)経由で[Resonite](https://resonite.com/)にインポートするツールです。

## 特徴

- ZIPファイルを指定するだけでインポート可能
- キャラクター、カード、地形、テーブルなど主要オブジェクトに対応
- 画像アセットの自動インポート
- ドライランモードで事前確認が可能
- **GUI版**（Electron）で初心者でも簡単に使用可能

## 対応オブジェクト

| Udonarium                    | Resonite表現                                   |
| ---------------------------- | ---------------------------------------------- |
| キャラクター (GameCharacter) | Quad + テクスチャ                              |
| ダイス (DiceSymbol)          | Quad（面切り替え）                             |
| カード (Card)                | 両面Quad                                       |
| カードの山札 (CardStack)     | グループ化されたカード                         |
| 地形 (Terrain)               | 上面+側面のQuadMesh（壁は1スロット配下で制御） |
| マップマスク (TableMask)     | Quad（半透明対応）                             |
| テーブル (GameTable)         | Quad                                           |
| 共有メモ (TextNote)          | UIX Text                                       |

## 必要環境

- Node.js 18以上（20.18.2推奨、[mise](https://mise.jdx.dev/)で管理）
- Resonite + ResoniteLinkが有効化された状態

## インストール

GitHub Releases から最新パッケージをダウンロードしてください。

- https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/latest

用途に応じて次を選択します。

- GUI版（Windows/macOS）: GUI ZIP をダウンロードして展開
- CLI版（Windows/macOS/Linux）: 各OS向けスタンドアロン実行ファイルをダウンロード

## 使用方法

### GUI版（推奨）

1. Releases から GUI パッケージをダウンロードして展開
2. `Udonarium Resonite Importer` を起動（Windows は `.exe`、macOS は `.app`）
3. 「参照...」ボタンでUdonariumのZIPファイルを選択
4. ResoniteでResoniteLinkを有効化して、ポートを設定
5. 「Resoniteにインポート」ボタンをクリック

### CLI版

```bash
# ダウンロードしたスタンドアロン実行ファイルを実行
./udonarium-resonite-importer -i ./save.zip

# ポートを指定
./udonarium-resonite-importer -i ./save.zip -p 7869

# ドライランモード（接続せずに解析のみ）
./udonarium-resonite-importer -i ./save.zip --dry-run

# 詳細ログ
./udonarium-resonite-importer -i ./save.zip --verbose
```

ソースコードからスタンドアロンCLIバンドルを生成する場合（現在OS向けのみ）:

```bash
npm run package:cli
```

出力先:

- 実行ファイル: `dist/udonarium-resonite-importer*`
- バンドルZIP: `dist/udonarium-resonite-importer-*-bundle.zip` または `dist/udonarium-resonite-importer-win.zip`

### CLIオプション

| オプション  | 短縮形 | 説明                   | デフォルト |
| ----------- | ------ | ---------------------- | ---------- |
| `--input`   | `-i`   | 入力ZIPファイルパス    | (必須)     |
| `--port`    | `-p`   | ResoniteLinkポート     | 7869       |
| `--host`    | `-H`   | ResoniteLinkホスト     | localhost  |
| `--scale`   | `-s`   | スケール係数           | 1 (m)      |
| `--dry-run` | `-d`   | 解析のみ（接続しない） | false      |
| `--verbose` | `-v`   | 詳細ログ出力           | false      |
| `--lang`    | `-l`   | 言語（en, ja）         | 自動検出   |

## 開発

ビルド、テスト、パッケージング、プロジェクト構成については [docs/development.ja.md](docs/development.ja.md) を参照してください。

## ライセンス

MIT

## 関連リンク

- [Udonarium](https://github.com/TK11235/udonarium) - Webベースのバーチャルテーブルトップ
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite連携ツール
