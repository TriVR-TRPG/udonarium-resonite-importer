# texture:// / texture-ref:// 設計メモ

## 概要

このプロジェクトでは、コンポーネント生成時のテクスチャ指定に以下 2 種類の記法を使います。

- `texture://<identifier>`
- `texture-ref://<componentId>`

見た目は URL 風ですが、どちらも **変換パイプライン内部で使う識別子** です。

---

## identifier の種類と URL・zip ファイル名の関係

Udonarium の XML は画像を `imageIdentifier` フィールドで参照します。
identifier は以下 3 種類に分類されます。

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

```
zip: images/front.png
  → ExtractedFile { path: 'images/front.png', name: 'front' }
  → importedTextures: Map { 'front' → 'resdb:///abc123...' }
  → StaticTexture2D.URL = 'resdb:///abc123...'
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
```

---

## 実際のインポートフロー（index.ts）

```
[1] ZIP 抽出
    images/front.png
      → ExtractedFile { path: 'images/front.png', name: 'front', data }

[2] 外部 URL 登録（registerExternalUrls）
    例: 'testTableBackgroundImage_image'
      → importedTextures: { 'testTableBackgroundImage_image'
                            → 'https://udonarium.app/assets/images/BG10a_80.jpg' }

[3] 実ファイルをインポート（assetImporter.importImages）
    例: { 'front' → 'resdb:///abc123...' }

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

## `texture://` の役割

`texture://` は「まだ実 URL（`resdb:///...` など）が確定していないテクスチャ」を表すプレースホルダーです。

- `resolveTextureValue()` は `textureMap` が渡されない場合に `texture://<identifier>` を返す。
- `resolveTextureValue()` は `textureMap` が渡されている場合は `textureMap.get(identifier) ?? identifier` を返す（プレースホルダーは生成しない）。
- `replaceTexturesInValue()` が、オブジェクト全体を再帰的に走査してこのプレースホルダーを実 URL に置換する（`resolveTexturePlaceholders()` 経由）。
- `buildQuadMeshComponents()` では `texture://` 始まりの値を受け取ると、
  `StaticTexture2D` と `MainTexturePropertyBlock` をそのスロット（オブジェクト直下）に生成する。

### なぜ必要か

- **テスト・ライブラリ用途**: `convertObjects()`（textureMap なし版）を呼ぶと `texture://` プレースホルダーが含まれた変換結果が得られ、後から `resolveTexturePlaceholders()` で一括置換できる。
- **2 段階処理の分離**: オブジェクト変換（形状・座標）と、アセットインポート（URL 確定）を疎結合に保てる。
- **再帰オブジェクト対応**: table/terrain のような子オブジェクトを含む構造でも、後段で一括置換できる。

> **注意**: 現在の CLI フロー（`index.ts`）では、オブジェクト変換時にすでに `textureComponentMap`（`texture-ref://` マップ）が渡されるため、`texture://` プレースホルダーは生成されません。

### dry-run 時の挙動

`--dry-run` 時は空の `Map<string, string>` を `textureMap` として渡します。

```ts
// dry-run 時
convertObjectsWithTextureMap(objects, new Map<string, string>(), ...)
```

`resolveTextureValue(identifier, emptyMap)` → `emptyMap.get(identifier) ?? identifier` → identifier そのもの（例: `'front'`）

そのため dry-run 時は identifier の文字列が `StaticTexture2D.URL` に設定されます（無効な URL ですが変換結果の確認には十分）。

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

- ローカルテクスチャ（`texture://...` / identifier 直接）の場合:
  - `StaticTexture2D` をそのスロットに生成
  - 同一スロットの `MainTexturePropertyBlock.Texture` から参照
- 共有テクスチャ（`texture-ref://...`）の場合（通常の CLI インポート）:
  - Assets/Textures スロットにある共有 `MainTexturePropertyBlock` を参照
  - ローカルには重複生成しない

このため、`texture-ref://...` は「直接マテリアルの Texture フィールドに刺す」用途ではなく、
**共有 property block を選ぶためのキー**として扱います。

### なぜ必要か

- **重複コンポーネント削減**: 同一テクスチャを複数マテリアルで使うときに `StaticTexture2D` / `MainTexturePropertyBlock` を増殖させない。
- **共有を明示**: 値が URL 系なのか、共有参照なのかを文字列だけで判別できる。
- **副作用回避**: `texture://` と異なり、後段の URL 置換対象にしない（`isGifTexture()` でも参照値として扱う）。

---

## 使い分けの目安

- 実ファイル由来の識別子（`front` など）を後で URL 解決したい → `texture://...`
- 既存の共有テクスチャコンポーネントを再利用したい → `texture-ref://...`

この 2 つを分離していることで、

1. 変換フェーズは「どのテクスチャを使うか」だけ決める
2. インポート/生成フェーズは「どの URL/共有コンポーネントに張るか」を決める

という責務分離を維持できます。
