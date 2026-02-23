# Udonarium Resonite Importer

[Udonarium](https://github.com/TK11235/udonarium)のセーブデータを、[ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink)経由で[Resonite](https://resonite.com/)にインポートするツールです。

## 特徴

- ZIPファイルとResoniteLinkのポートを指定してインポート可能
- キャラクター、カード、地形、テーブルなど主要オブジェクトに対応
- 画像アセットの自動インポート

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

## 必要環境

- Resonite + ResoniteLinkが有効化された状態

## インストール

最新パッケージは [GitHub Releases](https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/latest) からダウンロードしてください。

- GUI版（Windows/macOS）: GUI ZIP をダウンロードして展開
- CLI版（Windows/macOS/Linux）: 各OS向け CLI ZIP をダウンロードして展開

## 使用方法

### GUI版（推奨）

1. Releases から GUI パッケージをダウンロードして展開
2. `Udonarium Resonite Importer` を起動（Windows は `.exe`、macOS は `.app`）
3. 「参照...」ボタンでUdonariumのZIPファイルを選択
4. ResoniteでResoniteLinkを有効化して、ポートを設定
5. 「Resoniteにインポート」ボタンをクリック

![GUI版の使用イメージ](docs/images/gui.ja.png)

### CLI版

展開したCLI ZIP内の実行ファイルを使用します。

```bash
# Windows
.\udonarium-resonite-importer.exe -i .\save.zip -p 7869

# macOS
./udonarium-resonite-importer-macos -i ./save.zip -p 7869

# Linux
./udonarium-resonite-importer-linux -i ./save.zip -p 7869
```

### CLIオプション

| オプション  | 短縮形 | 説明                   | デフォルト |
| ----------- | ------ | ---------------------- | ---------- |
| `--input`   | `-i`   | 入力ZIPファイルパス    | (必須)     |
| `--port`    | `-p`   | ResoniteLinkポート（`RESONITELINK_PORT`でも指定可） | (必須、`--dry-run`時は不要) |
| `--host`    | `-H`   | ResoniteLinkホスト（`RESONITELINK_HOST`でも指定可） | `localhost` |
| `--root-scale` | - | インポートルートのスケール | `1` |
| `--root-grabbable` | - | インポートルートにGrabbableを追加 | `false` |
| `--simple-avatar-protection` / `--no-simple-avatar-protection` | - | ルート/オブジェクト/テクスチャへのSimpleAvatarProtection付与を切り替え | `true` |
| `--semi-transparent-image-blend-mode` | - | 半透明画像の描画方式（`Cutout` または `Alpha`） | `Cutout` |
| `--enable-character-collider` | - | ロックされた地形とテーブルの当たり判定にCharacterColliderを有効化 | `false` |
| `--dry-run` | `-d`   | 解析のみ（接続しない） | false      |
| `--verbose` | `-v`   | 詳細ログ出力           | false      |
| `--lang`    | `-l`   | 言語（en, ja）         | 自動検出   |
| `--help`    | `-h`   | ヘルプを表示           | -          |
| `--version` | `-V`   | バージョンを表示       | -          |

## ライセンス

MIT

## 関連リンク

- [ユドナリウム（Udonarium）](https://github.com/TK11235/udonarium#readme) - Webブラウザで動作するオンラインセッションツール
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite連携ツール
- [tsrl](https://www.npmjs.com/package/@eth0fox/tsrl) - ResoniteLink接続に使用しているTypeScriptライブラリ
