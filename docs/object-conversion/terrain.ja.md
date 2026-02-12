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
- `y += height / 2`
- `z -= depth / 2`

## 4. 回転
- `rotate` は Resonite の `rotation.y` にそのまま反映
- 最終回転: `rotation = (x: 0, y: rotate, z: 0)`

## 5. スロット構成
terrain ルート:
- `BoxCollider`
- `isLocked == false` の場合のみ `Grabbable`
- 子に `-top` と `-walls` を持つ

`-top`:
- 位置: `(0, height/2, 0)`
- 回転: `(90, 0, 0)`
- サイズ: `(width, depth)` の `QuadMesh`

`-walls`:
- `mode === 1` のとき `isActive = false`
- それ以外は `isActive = true`
- 子に `-front/-back/-left/-right` を生成

壁面:
- `-front`: pos `(0, 0, -depth/2)`, rot `(0, 0, 0)`, size `(width, height)`
- `-back`: pos `(0, 0, depth/2)`, rot `(0, 180, 0)`, size `(width, height)`
- `-left`: pos `(-width/2, 0, 0)`, rot `(0, 90, 0)`, size `(depth, height)`
- `-right`: pos `(width/2, 0, 0)`, rot `(0, -90, 0)`, size `(depth, height)`

## 6. コンポーネント
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
2. 中心補正（`+width/2`, `+height/2`, `-depth/2`）
3. `rotate` が Y 回転に反映されること
4. `mode === 1` で壁が非表示になること
5. `isLocked == false` で `Grabbable` が付くこと
6. 上面/壁面のテクスチャ優先順が想定どおりであること
