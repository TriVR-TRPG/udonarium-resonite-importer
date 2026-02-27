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

## インストール（パッケージの選び方）

最新パッケージは [GitHub Releases](https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/latest) からダウンロードしてください。

- デスクトップアプリとして使いたい場合は **GUI版**、ターミナル運用や自動化で使いたい場合は **CLI版** を選択
- CLI版のファイル名: `udonarium-resonite-importer-cli-<platform>-bundle.zip`（`<platform>` = `win` / `macos` / `linux`）
- GUI版のファイル名: `udonarium-resonite-importer-gui-<version>-<os>-<arch>.<ext>`（Windows/macOSは通常 `.zip`、Linuxは `.AppImage` の場合あり）
- OS別の目安
  - Windows: `...-cli-win-bundle.zip` または `...-gui-...-win-...zip`
  - macOS: `...-cli-macos-bundle.zip` または `...-gui-...-mac-...zip`
  - Linux: `...-cli-linux-bundle.zip`（GUIは Linux 向け成果物が公開されている場合のみ）

## 使用方法

### GUI版（推奨）

1. Releases から GUI パッケージをダウンロードして展開
2. `Udonarium Resonite Importer` を起動（Windows は `.exe`、macOS は `.app`）
3. 「選択」ボタンでUdonariumのZIPファイルを選択
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
| `--transparent-blend-mode` | - | 半透明画像の描画方式（`Cutout` または `Alpha`） | `Cutout` |
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

## MMC26 エントリー

このツールは Metaverse Maker Competition 2026 にエントリーした作品です。  
エントリー時点のバージョン: [v1.0.0-beta.4](https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/tag/v1.0.0-beta.4)

- イベント: [Metaverse Maker Competition 2026](https://youtu.be/MHxobH-TkKc)
- カテゴリ: `その他: TAU`
- ワールド: [[MMC26] Udonarium Resonite Importer - Resonite](https://go.resonite.com/world/G-1Nc5BgekFJQ/R-b0e1dc28-fec9-48cb-8fee-58459f3f637a)
