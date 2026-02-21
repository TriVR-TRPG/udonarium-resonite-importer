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
| ダイス (DiceSymbol) | Quad（面切り替え） |
| カード (Card) | 両面Quad |
| カードの山札 (CardStack) | グループ化されたカード |
| 地形 (Terrain) | 上面+側面のQuadMesh（壁は1スロット配下で制御） |
| マップマスク (TableMask) | Quad（半透明対応） |
| テーブル (GameTable) | Quad |
| 共有メモ (TextNote) | UIX Text |

## 必要環境

- Node.js 18以上（20.18.2推奨、[mise](https://mise.jdx.dev/)で管理）
- Resonite + ResoniteLinkが有効化された状態

## インストール

```bash
git clone https://github.com/blhsrwznrghfzpr/udonarium-resonite-importer.git
cd udonarium-resonite-importer
npm install
npm run build
```

## 使用方法

### GUI版（推奨）

```bash
npm run build:gui
npm run start:gui
```

1. 「参照...」ボタンでUdonariumのZIPファイルを選択
2. 解析結果を確認
3. ResoniteLinkの設定（通常はデフォルトでOK）
4. 「Resoniteにインポート」ボタンをクリック

### CLI版

```bash
# Resoniteに接続してインポート
npm run start -- -i ./save.zip

# ポートを指定
npm run start -- -i ./save.zip -p 7869

# ドライランモード（接続せずに解析のみ）
npm run start -- -i ./save.zip --dry-run

# 詳細ログ
npm run start -- -i ./save.zip --verbose
```

### CLIオプション

| オプション | 短縮形 | 説明 | デフォルト |
|------------|--------|------|------------|
| `--input` | `-i` | 入力ZIPファイルパス | (必須) |
| `--port` | `-p` | ResoniteLinkポート | 7869 |
| `--host` | `-H` | ResoniteLinkホスト | localhost |
| `--scale` | `-s` | スケール係数 | 0.02 |
| `--dry-run` | `-d` | 解析のみ（接続しない） | false |
| `--verbose` | `-v` | 詳細ログ出力 | false |
| `--lang` | `-l` | 言語（en, ja） | 自動検出 |

## 開発

ビルド、テスト、パッケージング、プロジェクト構成については [docs/development.ja.md](docs/development.ja.md) を参照してください。

## ライセンス

MIT

## 関連リンク

- [Udonarium](https://github.com/TK11235/udonarium) - Webベースのバーチャルテーブルトップ
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite連携ツール
- [Resonite Wiki - Connecting to Other Applications](https://wiki.resonite.com/Connecting_Resonite_to_Other_Applications)
