# Udonarium Resonite Importer 設計書

## 1. 概要

### 1.1 目的
Udonarium（Webベースのバーチャルテーブルトップ）のセーブデータを、ResoniteLink経由でResonite（VRプラットフォーム）にインポートし、テーブルトップ環境を再現するツール。

### 1.2 ターゲットユーザー
- **Windows/macOSの一般ユーザー（プログラミング知識なし）**
- TRPGセッションをVR環境で再現したいユーザー
- Linuxユーザーは「ある程度プログラミングに詳しい」前提で、CLIや追加ライブラリ導入を許容

### 1.3 基本フロー
```
[Udonarium ZIP] → [本ツール] → [ResoniteLink] → [Resonite内にオブジェクト生成]
```

---

## 2. 入力データ仕様

### 2.1 Udonariumセーブデータ構造
```
save.zip
├── data/
│   ├── *.xml          # オブジェクト定義ファイル
│   └── ...
└── images/
    ├── *.png          # 画像アセット
    ├── *.jpg
    └── ...
```

### 2.2 対応オブジェクトタイプ

| XMLタグ | Udonariumクラス | 説明 |
|---------|-----------------|------|
| `<character>` | GameCharacter | キャラクターコマ |
| `<card>` | Card | カード |
| `<card-stack>` | CardStack | カードの山 |
| `<terrain>` | Terrain | 立体地形 |
| `<table>` | GameTable | ゲームテーブル |
| `<table-mask>` | GameTableMask | テーブルマスク |
| `<text-note>` | TextNote | 共有メモ |

### 2.3 XML構造例（GameCharacter）
```xml
<character>
  <data name="character">
    <data name="image">
      <data type="image" name="imageIdentifier">IMAGE_ID</data>
    </data>
    <data name="common">
      <data name="name">キャラクター名</data>
      <data name="size">1</data>
    </data>
    <data name="detail">
      <data name="リソース">
        <data type="numberResource" name="HP" currentValue="150">200</data>
        <data type="numberResource" name="MP" currentValue="80">100</data>
      </data>
      <data name="能力値">
        <data type="note" name="STR">10</data>
      </data>
    </data>
  </data>
  <chat-palette></chat-palette>
</character>
```

### 2.4 XML構造例（Terrain）
```xml
<terrain>
  <data name="terrain">
    <data name="image">
      <data type="image" name="wall">WALL_IMAGE_ID</data>
      <data type="image" name="floor">FLOOR_IMAGE_ID</data>
    </data>
    <data name="common">
      <data name="name">地形名</data>
      <data name="width">2</data>
      <data name="height">1</data>
      <data name="depth">2</data>
    </data>
  </data>
</terrain>
```

---

## 3. 出力先仕様（ResoniteLink）

### 3.1 通信プロトコル
- **プロトコル**: WebSocket
- **データ形式**: JSON
- **ポート**: ユーザー指定必須（ワールドごとに異なるため）
- **ポート設定方法**: CLIオプション `-p` / 環境変数 `RESONITELINK_PORT` / `.env`ファイル

### 3.2 主要APIメッセージ

#### スロット追加（オブジェクト生成）
```json
{
  "type": "addSlot",
  "id": "udonarium_character_001",
  "parentId": "root",
  "name": "キャラクター名",
  "position": { "x": 0.0, "y": 0.0, "z": 0.0 },
  "scale": { "x": 1.0, "y": 1.0, "z": 1.0 }
}
```

#### スロット更新
```json
{
  "type": "updateSlot",
  "id": "udonarium_character_001",
  "rotation": { "x": 0.0, "y": 45.0, "z": 0.0 }
}
```

#### テクスチャインポート
```json
{
  "type": "importTexture",
  "path": "/path/to/image.png"
}
```
※ローカルファイルパスまたはRAWデータ送信に対応

#### コンポーネント追加
```json
{
  "type": "addComponent",
  "slotId": "udonarium_character_001",
  "componentType": "MeshRenderer",
  "fields": {}
}
```

---

## 4. システムアーキテクチャ

### 4.1 モジュール構成

```
udonarium-resonite-importer/
├── src/
│   ├── index.ts                 # エントリーポイント（CLI）
│   ├── parser/
│   │   ├── ZipExtractor.ts      # ZIP解凍処理
│   │   ├── XmlParser.ts         # XML解析基盤
│   │   └── objects/
│   │       ├── ParserUtils.ts   # 共通ユーティリティ (parsePosition等)
│   │       ├── CharacterParser.ts
│   │       ├── CardParser.ts
│   │       ├── TerrainParser.ts
│   │       ├── TableParser.ts
│   │       └── TextNoteParser.ts
│   ├── domain/
│   │   ├── UdonariumObject.ts   # Udonariumオブジェクト型定義（共通）
│   │   └── ResoniteObject.ts    # Resoniteオブジェクト型定義（共通）
│   ├── converter/
│   │   ├── ObjectConverter.ts   # 変換ディスパッチ
│   │   └── objectConverters/    # 種別ごとの変換ロジック
│   │       ├── componentBuilders.ts  # QuadMesh/BoxMesh コンポーネント生成
│   │       ├── characterConverter.ts
│   │       ├── cardConverter.ts
│   │       ├── cardStackConverter.ts
│   │       ├── terrainConverter.ts
│   │       ├── tableConverter.ts
│   │       └── textNoteConverter.ts
│   ├── resonite/
│   │   ├── ResoniteLinkClient.ts    # WebSocketクライアント
│   │   ├── SlotBuilder.ts           # スロット生成 + SyncList分離
│   │   ├── AssetImporter.ts         # アセットインポート
│   │   └── registerExternalUrls.ts  # 外部URL画像登録
│   ├── gui/                     # Electron GUI
│   ├── i18n/                    # 国際化
│   └── config/
│       └── MappingConfig.ts     # 定数・マッピング設定
├── lib/
│   └── resonitelink.js/         # ResoniteLink library (submodule)
├── dist/                        # ビルド出力
├── package.json
└── tsconfig.json
```

> 補足: 型定義は `src/domain/UdonariumObject.ts` と `src/domain/ResoniteObject.ts` に集約。過去の互換ファイル（`src/converter/UdonariumObject.ts`, `src/converter/ResoniteObject.ts`）は廃止済み。

### 4.2 データフロー

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Entry                               │
│  (ZIP path + ResoniteLink port)                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ZipExtractor                               │
│  - ZIP解凍                                                       │
│  - XMLファイル一覧取得                                            │
│  - 画像アセット一覧取得                                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       XmlParser                                  │
│  - XMLタグ識別                                                    │
│  - 各オブジェクトパーサーへ振り分け                                  │
│  - UdonariumObject配列生成                                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ObjectConverter                               │
│  - UdonariumObject → ResoniteObject変換                          │
│  - 座標系変換（Y-up調整）                                          │
│  - テクスチャプレースホルダー解決                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ResoniteLinkClient                              │
│  - WebSocket接続                                                 │
│  - スロット生成リクエスト                                          │
│  - アセットインポートリクエスト                                      │
│  - コンポーネント設定                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 クラス図

```
┌──────────────────────┐      ┌──────────────────────┐
│   UdonariumObject    │      │    ResoniteObject    │
├──────────────────────┤      ├──────────────────────┤
│ - id: string         │      │ - id: string         │
│ - type: ObjectType   │─────▶│ - name: string       │
│ - name: string       │      │ - position: Vector3  │
│ - position: Vector3  │      │ - rotation: Vector3  │
│ - images: ImageRef[] │      │ - isActive?: boolean │
│ - properties: Map    │      │ - textures: string[] │
│ - (type別追加項目)    │      │ - components: []     │
└──────────────────────┘      └──────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                  ResoniteLinkClient                      │
├──────────────────────────────────────────────────────────┤
│ - ws: WebSocket                                          │
│ - port: number                                           │
│ - pendingRequests: Map<string, Promise>                  │
├──────────────────────────────────────────────────────────┤
│ + connect(): Promise<void>                               │
│ + disconnect(): void                                     │
│ + addSlot(obj: ResoniteObject): Promise<string>          │
│ + updateSlot(id: string, props: Partial): Promise<void>  │
│ + importTexture(path: string): Promise<string>           │
│ + addComponent(slotId: string, type: string): Promise    │
└──────────────────────────────────────────────────────────┘
```

---

## 5. オブジェクトマッピング

### 5.1 Udonarium → Resonite マッピング

| Udonarium | Resoniteでの表現 | 備考 |
|-----------|------------------|------|
| GameCharacter | Quad + テクスチャ | 立ち絵として表示 |
| Card | 両面Quad + 表裏テクスチャ | 裏返し対応 |
| CardStack | 複数Card + グルーピング | スタック表現 |
| Terrain | 上面+側面のQuadMesh + BoxCollider | 壁は1スロット配下で表示制御 |
| GameTable | 大型Quad + テクスチャ | テーブル天板 |
| TextNote | UIX Text | テキスト表示 |

### 5.2 座標系変換

```
Udonarium (2D, CSS座標系)     Resonite (3D, Y-up)
  +X → 右                        +X → 右
  +Y → 下                        +Y → 上
  posZ → 高さ                    +Z → 奥
  単位: px (1マス = 50px)         単位: メートル

変換式:
  resonite.x =  udonarium.x    * SCALE_FACTOR (0.02)
  resonite.y =  udonarium.posZ * SCALE_FACTOR (0.02)
  resonite.z = -udonarium.y    * SCALE_FACTOR (0.02)
```

- Udonarium は `location.x` / `location.y` / `posZ` を座標に使用
- Udonarium は端基準、Resonite は中心基準のため、各converterでオフセット補正を適用
  - terrain: `x += width/2`, `y += height/2`, `z -= depth/2`
  - character: `x += size/2`, `y += size/2`, `z -= size/2`
  - card/card-stack/text-note: `x += width/2`, `z -= height/2`
- terrain の `rotate` は Resonite の `rotation.y` に適用

### 5.3 サイズ変換

```
オブジェクト寸法は Udonarium の値をそのまま Mesh の Size に反映。
  QuadMesh.Size (float2) / BoxMesh.Size (float3)

Slot.scale は変更しない（デフォルト 1,1,1）。
インポートルートコンテナに IMPORT_GROUP_SCALE (0.1) を適用して最終サイズを調整。
  → 結果的に 1マス = 10cm

terrain の追加仕様:
- `mode = 1` の場合、壁スロット（`-walls`）を生成したまま `isActive=false`（壁非表示）
- `isLocked = false` の場合、`Grabbable` を付与
```

---

## 6. CLI仕様（Linux/上級者向け）

### 6.1 基本コマンド

```bash
# 基本使用（ポート指定必須）
udonarium-resonite-importer --input ./save.zip --port 12345

# 短縮オプション
udonarium-resonite-importer -i ./save.zip -p 12345

# 環境変数でポート指定
RESONITELINK_PORT=12345 udonarium-resonite-importer -i ./save.zip

# .envファイル使用（RESONITELINK_PORT=12345）
udonarium-resonite-importer -i ./save.zip

# オプション付き
udonarium-resonite-importer -i ./save.zip -p 12345 --scale 0.02 --dry-run

# 解析のみ（ポート不要）
udonarium-resonite-importer -i ./save.zip --dry-run
```

### 6.2 環境変数

| 環境変数 | 説明 | デフォルト |
|----------|------|------------|
| `RESONITELINK_PORT` | ResoniteLinkポート | (必須) |
| `RESONITELINK_HOST` | ResoniteLinkホスト | localhost |

`.env`ファイルでも設定可能:
```
RESONITELINK_PORT=12345
RESONITELINK_HOST=localhost
```

### 6.3 オプション一覧

| オプション | 短縮 | 説明 | デフォルト |
|------------|------|------|------------|
| `--input` | `-i` | 入力ZIPファイルパス | (必須) |
| `--port` | `-p` | ResoniteLinkポート | (必須、または環境変数) |
| `--host` | `-H` | ResoniteLinkホスト | localhost（または環境変数） |
| `--scale` | `-s` | スケール係数 | 0.02 |
| `--dry-run` | `-d` | 接続せずに解析結果のみ表示 | false |
| `--verbose` | `-v` | 詳細ログ出力 | false |
| `--lang` | `-l` | 言語 (en, ja) | システム設定 |
| `--help` | | ヘルプ表示 | |

### 6.4 出力例

```
$ udonarium-resonite-importer -i session.zip -p 12345

Udonarium Resonite Importer v1.0.0
==================================

[1/4] ZIPファイルを解凍中...
      - XMLファイル: 15件
      - 画像ファイル: 23件

[2/4] オブジェクトを解析中...
      - キャラクター: 5件
      - カード: 20件
      - 地形: 3件
      - テーブル: 1件

[3/4] ResoniteLinkに接続中...
      - 接続先: ws://localhost:7869
      - 接続成功

[4/4] オブジェクトをインポート中...
      [████████████████████████████████] 100%
      - 画像インポート: 23/23
      - スロット生成: 29/29

完了しました！
Resonite内で確認してください。
```

---

## 7. エラーハンドリング

### 7.1 エラーケース

| エラー | 対処 | ユーザーメッセージ |
|--------|------|-------------------|
| ZIPファイルが見つからない | 終了 | 「指定されたファイルが見つかりません」 |
| ZIPファイルが破損 | 終了 | 「ZIPファイルを開けません」 |
| XMLパースエラー | スキップ＆警告 | 「{ファイル名}の解析に失敗しました（スキップ）」 |
| ResoniteLink接続失敗 | リトライ(3回) | 「接続できません。Resoniteが起動しているか確認してください」 |
| 画像インポート失敗 | スキップ＆警告 | 「{画像名}のインポートに失敗しました（スキップ）」 |

### 7.2 リトライ戦略

```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,  // 1秒
  backoffMultiplier: 2,
  maxDelay: 10000      // 10秒
};
```

---

## 8. 配布形式（ユーザー層別）

### 8.1 実行形式

**Windows/macOSの非エンジニア向け**に、アプリ単体で利用できるGUI配布を優先する。  
**Linuxユーザー**にはCLI版またはAppImageを「ベストエフォート」で提供する。

1. **GUIアプリ（Electron）**
   - Windows/macOSを第一優先のサポート対象とする
   - Node.jsランタイム同梱で追加インストール不要
   - **インストーラーは使わずZIP配布を基本とする**
     - Windows: ZIP内の `Udonarium Resonite Importer.exe`
     - macOS: ZIP内の `Udonarium Resonite Importer.app`
   - Linux: AppImage（依存ライブラリ不足時はCLI利用を案内）

2. **スタンドアロンCLI実行ファイル**
   - `pkg` を使用してNode.jsランタイム込みの単一実行ファイルを生成
   - Windows: `udonarium-resonite-importer.exe`
   - macOS: `udonarium-resonite-importer-macos`
   - Linux: `udonarium-resonite-importer-linux`

3. **npmパッケージ**（開発者向け）
   ```bash
   npm install -g udonarium-resonite-importer
   ```

### 8.2 ビルドスクリプト

```json
{
  "scripts": {
    "build": "run-p build:*",
    "package:cli:win": "pkg . --targets node18-win-x64 --output dist/udonarium-resonite-importer.exe",
    "package:cli:mac": "pkg . --targets node18-macos-x64 --output dist/udonarium-resonite-importer-macos",
    "package:cli:linux": "pkg . --targets node18-linux-x64 --output dist/udonarium-resonite-importer-linux",
    "package:gui": "electron-builder --win --mac --linux"
  }
}
```

---

## 9. 将来の拡張性

### 9.1 Phase 2 機能案
- [ ] GUI版の初回セットアップ・ガイド（ResoniteLinkのポート入力支援）
- [ ] プレビュー機能（インポート前に3Dビューで確認）
- [ ] 双方向同期（Resonite → Udonarium）
- [ ] カスタムマッピング設定ファイル

### 9.2 対応オブジェクト拡張
- [ ] ダイスロール履歴
- [ ] チャットログ
- [ ] BGM/SE

---

## 10. 依存ライブラリ

| ライブラリ | 用途 | ライセンス |
|------------|------|------------|
| `adm-zip` | ZIP解凍 | MIT |
| `fast-xml-parser` | XML解析 | MIT |
| `ws` | WebSocket通信 | MIT |
| `commander` | CLI引数解析 | MIT |
| `chalk` | ターミナル色付け | MIT |
| `ora` | スピナー表示 | MIT |

---

## 11. 参考リンク

- [Udonarium GitHub](https://github.com/TK11235/udonarium)
- [ResoniteLink GitHub](https://github.com/Yellow-Dog-Man/ResoniteLink)
- [Resonite Wiki - WebSocket](https://wiki.resonite.com/WebSocket)
- [Resonite Wiki - Connecting to Other Applications](https://wiki.resonite.com/Connecting_Resonite_to_Other_Applications)
