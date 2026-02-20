# Terrain 変換仕様
[English](terrain.md)

## 1. 対象
Udonarium の `terrain` を Resonite の slot/component へ変換する仕様です。

## 2. 入力フィールド（Udonarium）
- `name`
- `position.x` (`location.x`)
- `position.y` (`location.y`)
- `position.z` (`posZ`)
- `width`
- `height`
- `depth`
- `rotate`
- `mode`
- `isLocked`
- `wallImage`
- `floorImage`

## 3. 座標と軸の対応
基本座標変換:
- `resonite.x =  udonarium.x * SCALE_FACTOR`
- `resonite.y =  udonarium.z * SCALE_FACTOR`
- `resonite.z = -udonarium.y * SCALE_FACTOR`

サイズ軸対応:
- `width  -> X`
- `height -> Y`
- `depth  -> Z`

Udonarium（端基準）から Resonite（中心基準）への補正:
- `x += width / 2`
- `y += height / 2`（`mode !== 1` の場合）
- `y += height`（`mode === 1` の場合、上面を地面高さに合わせるため）
- `z -= depth / 2`

## 4. 回転
- `rotate` は Resonite の `rotation.y` にそのまま反映
- 最終回転: `rotation = (x: 0, y: rotate, z: 0)`

## 5. スロット構成
terrain ルート:
- `BoxCollider`
- `isLocked == true` の場合、`BoxCollider.CharacterCollider = true`
- `isLocked == false` の場合のみ `Grabbable`
- 子スロット構成は `mode` によって異なる

`mode !== 1`（壁あり）の場合:

`-top`:
- 位置: `(0, height/2, 0)`
- 回転: `(90, 0, 0)`
- サイズ: `(width, depth)` の `QuadMesh`（上面テクスチャ）

`-bottom`:
- 位置: `(0, -height/2, 0)`
- 回転: `(-90, 0, 0)`
- サイズ: `(width, depth)` の `QuadMesh`（上面テクスチャと同一）

`-walls`（コンテナ、アクティブ）:
- 子に `-front/-back/-left/-right` を生成
- `-front`: pos `(0, 0, -depth/2)`, rot `(0, 0, 0)`, size `(width, height)`
- `-back`: pos `(0, 0, depth/2)`, rot `(0, 180, 0)`, size `(width, height)`
- `-left`: pos `(-width/2, 0, 0)`, rot `(0, 90, 0)`, size `(depth, height)`
- `-right`: pos `(width/2, 0, 0)`, rot `(0, -90, 0)`, size `(depth, height)`

`mode === 1`（壁なし）の場合:

`-top`:
- 位置: `(0, 0, 0)`
- 回転: `(90, 0, 0)`
- サイズ: `(width, depth)` の `QuadMesh`（上面テクスチャ）

`-top-back`:
- 位置: `(0, 0, 0)`
- 回転: `(-90, 0, 0)`
- サイズ: `(width, depth)` の `QuadMesh`（上面テクスチャと同一）

`-walls`: **生成しない**

## 6. コンポーネント
`BoxCollider` サイズ（ルートに付与）:
- `mode !== 1`: `(width, height, depth)`
- `mode === 1`: `(width, 0, depth)`（平面コライダー）

各面の描画は `buildQuadMeshComponents(...)` を使用し、以下を生成:
- `QuadMesh`
- `XiexeToonMaterial`
- `MeshRenderer`
- ローカル画像使用時は `StaticTexture2D` と `MainTexturePropertyBlock` も生成

共有アセット化のフェーズで、テクスチャ/マテリアル参照は共有参照に置換されます。

## 7. テクスチャ選択優先順
上面（`-top`）:
1. `floorImage.identifier`
2. `wallImage.identifier`
3. `images[0].identifier`

壁面（`-front/-back/-left/-right`）:
1. `wallImage.identifier`
2. `floorImage.identifier`
3. `images[0].identifier`

## 8. 確認ポイント
1. サイズ軸対応（`width/x`, `height/y`, `depth/z`）
2. `mode !== 1` 時の中心補正: `y += height/2`
3. `mode === 1` 時の中心補正: `y += height`
4. `rotate` が Y 回転に反映されること
5. `mode !== 1` 時は `-top`・`-bottom`・`-walls`（+壁面4枚）が生成される
6. `mode === 1` 時は `-top`・`-top-back` のみ生成され `-walls` は生成されない
7. `isLocked == true` で `BoxCollider.CharacterCollider = true`
8. `isLocked == false` で `Grabbable` が付くこと
9. 上面/壁面のテクスチャ優先順が想定どおりであること
