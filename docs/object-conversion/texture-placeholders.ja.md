# テクスチャ処理 設計メモ

## 概要

このプロジェクトでは、全ての画像を **共有テクスチャ** として扱います。
コンポーネント生成時のテクスチャ指定には以下の内部記法を使います。

- `texture-ref://<componentId>`

見た目は URL 風ですが、**変換パイプライン内部で使う識別子** であり、
Assets/Textures スロット内の既存 `StaticTexture2D` を参照することを意味します。

---

## identifier の種類と登録方法

Udonarium の XML は画像を `imageIdentifier` フィールドで参照します。
identifier は以下 4 種類に分類されます。

### 1. ZIP 内ファイルの identifier

Udonarium の保存ファイル（ZIP）に画像が同梱されている場合、identifier は
**拡張子を除いたファイル名（basename）** になります。

| zip 内パス | `ZipExtractor` の `file.name` | XML の identifier |
|---|---|---|
| `images/front.png` | `front` | `front` |
| `icon.gif` | `icon` | `icon` |
| `bg/table.jpg` | `table` | `table` |

`ZipExtractor` は `path.basename(entry.entryName, ext)` を `file.name` として返します。
`AssetImporter.importImage()` はこの `file.name` をキーに `importedTextures` マップへ登録し、
`ResoniteLinkClient.importTexture()` が返す `resdb:///...` 形式の URL を値に格納します。

**SVG ファイルの場合**: `sharp` で PNG 変換後にテンプファイルに書き出してからインポートします（Resonite は SVG 非対応）。

```
zip: images/front.png
  → ExtractedFile { path: 'images/front.png', name: 'front' }
  → importedTextures: Map { 'front' → 'resdb:///abc123...' }
  → StaticTexture2D.URL = 'resdb:///abc123...'

zip: images/icon.svg
  → ExtractedFile { path: 'images/icon.svg', name: 'icon' }
  → sharp(data).png() → icon.png（テンプファイル）
  → importedTextures: Map { 'icon' → 'resdb:///def456...' }
  → StaticTexture2D.URL = 'resdb:///def456...'
```

### 2. 既知 ID（KNOWN_IMAGES）

Udonarium の既定サンプルデータで使われる特定の文字列が `MappingConfig.ts` の `KNOWN_IMAGES` に登録されており、
ZIP にファイルがなくても外部 URL に解決されます。

| identifier | 対応する外部 URL |
|---|---|
| `testTableBackgroundImage_image` | `https://udonarium.app/assets/images/BG10a_80.jpg` |
| `testCharacter_1_image` | `https://udonarium.app/assets/images/mon_052.gif` |
| `testCharacter_3_image` | `https://udonarium.app/assets/images/mon_128.gif` |
| `testCharacter_4_image` | `https://udonarium.app/assets/images/mon_150.gif` |
| `testCharacter_5_image` | `https://udonarium.app/assets/images/mon_211.gif` |
| `testCharacter_6_image` | `https://udonarium.app/assets/images/mon_135.gif` |
| `none_icon` | `https://udonarium.app/assets/images/ic_account_circle_black_24dp_2x.png` |

`registerExternalUrls()` が `KNOWN_IMAGES.get(identifier).url` を `AssetImporter.registerExternalUrl()` 経由で
`importedTextures` に登録します。

```
identifier: 'testTableBackgroundImage_image'
  → registerExternalUrl('testTableBackgroundImage_image',
                        'https://udonarium.app/assets/images/BG10a_80.jpg')
  → importedTextures: Map { 'testTableBackgroundImage_image'
                            → 'https://udonarium.app/assets/images/BG10a_80.jpg' }
  → StaticTexture2D.URL = 'https://udonarium.app/assets/images/BG10a_80.jpg'
```

### 3. 相対パス（`./` 始まり）

Udonarium が Web ホスト上のリソースを参照するときに使う形式です。

| identifier | 生成される外部 URL |
|---|---|
| `./assets/images/BG10a_80.jpg` | `https://udonarium.app/assets/images/BG10a_80.jpg` |
| `./assets/images/trump/trump_01.png` | `https://udonarium.app/assets/images/trump/trump_01.png` |

`registerExternalUrls()` が `'https://udonarium.app/'` + パス（先頭の `./` を除去）を組み立てて
`importedTextures` に登録します。

```
identifier: './assets/images/BG10a_80.jpg'
  → url = 'https://udonarium.app/assets/images/BG10a_80.jpg'
  → registerExternalUrl('./assets/images/BG10a_80.jpg', url)
  → importedTextures: Map { './assets/images/BG10a_80.jpg'
                            → 'https://udonarium.app/assets/images/BG10a_80.jpg' }
  → StaticTexture2D.URL = 'https://udonarium.app/assets/images/BG10a_80.jpg'
     （Assets/Textures スロットに共有テクスチャとして作成）
```

### 4. 絶対 URL（`http://` / `https://` 始まり）

ユーザーが外部ホストの画像を直接 URL で指定した場合の形式です。

**非 SVG URL の場合**: identifier をそのまま URL として登録します。

```
identifier: 'https://example.com/images/character.png'
  → registerExternalUrl('https://example.com/images/character.png',
                        'https://example.com/images/character.png')
  → importedTextures: Map { 'https://example.com/images/character.png'
                            → 'https://example.com/images/character.png' }
  → StaticTexture2D.URL = 'https://example.com/images/character.png'
     （Assets/Textures スロットに共有テクスチャとして作成）
```

**SVG URL の場合**: `fetch` でダウンロードし、`sharp` で PNG 変換してからインポートします（ZIP 内 SVG と同じ処理）。

```
identifier: 'https://example.com/icons/badge.svg'
  → importExternalSvgUrl('https://example.com/icons/badge.svg',
                          'https://example.com/icons/badge.svg')
  → fetch(...) → SVG バッファ取得
  → sharp(svgBuffer).png() → badge.png（テンプファイル）
  → importTexture(badge.png) → 'resdb:///ghi789...'
  → importedTextures: Map { 'https://example.com/icons/badge.svg'
                            → 'resdb:///ghi789...' }
  → StaticTexture2D.URL = 'resdb:///ghi789...'
     （Assets/Textures スロットに共有テクスチャとして作成）
```

**4 種類の identifier まとめ**:

| 種類 | 登録メソッド | 値の内容 |
|---|---|---|
| ZIP PNG/JPG/GIF | `importImage()` | `resdb:///...` |
| ZIP SVG（→PNG変換） | `importImage()` | `resdb:///...` |
| KNOWN_IMAGES | `registerExternalUrl()` | `https://...` |
| 相対パス（`./`） | `registerExternalUrl()` | `https://udonarium.app/...` |
| 絶対 URL（非SVG） | `registerExternalUrl()` | `https://...`（identifier そのまま） |
| 絶対 URL SVG（→PNG変換） | `importExternalSvgUrl()` | `resdb:///...` |

**ブレンドモードの扱い**:

`buildImageBlendModeMap()` は絶対 URL を `buildExternalProbeUrl()` でそのままプローブ対象 URL として扱い、
実際に HTTP フェッチしてアルファチャンネルを検出します。
ただしこれはオブジェクト変換前の準備処理であり、`importedTextures` への登録とは無関係です。

```
buildExternalProbeUrl('https://example.com/images/character.png')
  → 'https://example.com/images/character.png'（http/https はそのまま返す）

probeBlendModeFromExternalUrl('https://example.com/images/character.png')
  → HTTP フェッチ → アルファチャンネル判定 → 'Opaque' / 'Cutout'
  → imageBlendModeMap: { 'https://example.com/images/character.png' → 'Opaque' }
```

---

## 実際のインポートフロー（index.ts）

```
[1] ZIP 抽出
    images/front.png
      → ExtractedFile { path: 'images/front.png', name: 'front', data }
    images/icon.svg
      → ExtractedFile { path: 'images/icon.svg', name: 'icon', data }

[2] 外部 URL 登録（registerExternalUrls）
    KNOWN_IMAGES / 相対パス / 非 SVG 絶対 URL:
      → importedTextures: { identifier → url }
    SVG 絶対 URL:
      → fetch → sharp → importTexture → importedTextures: { identifier → 'resdb:///...' }

[3] ZIP 内ファイルをインポート（assetImporter.importImages）
    PNG/JPG/GIF: そのままインポート
    SVG: sharp で PNG 変換 → インポート
      → importedTextures: { 'front' → 'resdb:///abc123...' }
                          { 'icon'  → 'resdb:///def456...' }

[4] Assets/Textures スロットに共有テクスチャを作成（slotBuilder.createTextureAssets）
    各 identifier ごとに:
      スロット名 = identifier（例: 'front'）
      StaticTexture2D( URL = textureUrl )
        ID: udon-imp-<uuid>-static-texture
      MainTexturePropertyBlock( Texture → StaticTexture2D )
        ID: udon-imp-<uuid>-main-texture-property-block
    → textureReferenceMap: { 'front' → 'udon-imp-<uuid>-static-texture' }

[5] texture-ref:// マップを生成
    textureComponentMap: { 'front' → 'texture-ref://udon-imp-<uuid>-static-texture' }

[6] オブジェクト変換（convertObjectsWithTextureMap）
    resolveTextureValue('front', textureComponentMap)
      → 'texture-ref://udon-imp-<uuid>-static-texture'

[7] コンポーネント組み立て（buildQuadMeshComponents）
    textureValue = 'texture-ref://...' を検知:
      → ローカルに StaticTexture2D は作らない
      → MeshRenderer.MaterialPropertyBlocks
           → 共有 MainTexturePropertyBlock (udon-imp-<uuid>-main-texture-property-block) を参照
```

---

## `texture-ref://` の役割

`texture-ref://` は「既存の共有テクスチャコンポーネント（`StaticTexture2D`）を再利用する」ための内部記法です。

- `parseTextureReferenceId()` が `texture-ref://` から componentId を取り出す。
- `buildQuadMeshComponents()` は `texture-ref://` を検知すると、
  - 新しい `StaticTexture2D` と `MainTexturePropertyBlock` を **ローカルには生成しない**。
  - `MeshRenderer.MaterialPropertyBlocks` に、共有側 `MainTexturePropertyBlock`
    （`toSharedTexturePropertyBlockId(sharedTextureId)` の結果、つまり `<slotId>-main-texture-property-block`）
    への参照を設定する。

### MainTexturePropertyBlock について

現在は、`XiexeToonMaterial` のテクスチャ割り当ては `MainTexturePropertyBlock` 経由で統一しています。

- 共有テクスチャ（`texture-ref://...`）の場合（通常の CLI インポート）:
  - Assets/Textures スロットにある共有 `MainTexturePropertyBlock` を参照
  - ローカルには重複生成しない

`texture-ref://...` は「直接マテリアルの Texture フィールドに刺す」用途ではなく、
**共有 property block を選ぶためのキー**として扱います。

### なぜ必要か

- **重複コンポーネント削減**: 同一テクスチャを複数マテリアルで使うときに `StaticTexture2D` / `MainTexturePropertyBlock` を増殖させない。
- **共有を明示**: 値が URL 系なのか、共有参照なのかを文字列だけで判別できる。

---

## dry-run 時の挙動

`--dry-run` 時は空の `Map<string, string>` を `textureMap` として渡します。

```ts
// dry-run 時
convertObjectsWithTextureMap(objects, new Map<string, string>(), ...)
```

`resolveTextureValue(identifier, emptyMap)` → `emptyMap.get(identifier) ?? identifier` → identifier そのもの（例: `'front'`）

そのため dry-run 時は identifier の文字列が `StaticTexture2D.URL` に設定されます（無効な URL ですが変換結果の確認には十分）。
