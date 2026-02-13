# Table Mask 変換仕様

[English](table-mask.md)

## 1. 対象

Udonarium の `table-mask` を Resonite の slot/component へ変換する仕様です。

## 2. 入力フィールド（Udonarium）

- `name`
- `position.x` (`location.x`)
- `position.y` (`location.y`)
- `position.z` (`posZ`)
- `width`
- `height`
- `isLock`（属性、任意） — 注意: terrain は `isLocked`、table-mask は `isLock` と属性名が異なる
- `image.imageIdentifier`（任意）
- `common.opacity`（`numberResource.currentValue`、任意）

## 3. パーサーの扱い

`parseTableMask(...)` は以下を保持します。

- `isLock` 属性から `isLock`（boolean）を格納
- `imageIdentifier` があれば `images[0]` に格納
- `opacity.currentValue` があれば `properties.opacity` に格納

デフォルト:

- `isLock` 未指定時は `false`
- `width` 未指定時は `4`
- `height` 未指定時は `4`
- `opacity` 未指定時は変換時に 100% として扱う

## 4. 座標と回転

基本座標変換:

- `resonite.x =  udonarium.x * SCALE_FACTOR`
- `resonite.y =  udonarium.z * SCALE_FACTOR`
- `resonite.z = -udonarium.y * SCALE_FACTOR`

中心補正:

- `x += width / 2`
- `z -= height / 2`

追加変換:

- `rotation = (x: 90, y: 0, z: 0)`
- `y += 0.002`（重なりによる表示乱れ回避）

## 5. 生成コンポーネント

`applyTableMaskConversion(...)` で以下を生成します。

- `QuadMesh`（`Size = (width, height)`, `DualSided = true`）
- `XiexeToonMaterial`
- `MeshRenderer`
- `buildQuadMeshComponents(...)` によるテクスチャ関連
  - ローカル画像: `StaticTexture2D` + `MainTexturePropertyBlock`
  - 共有テクスチャ参照: `MaterialPropertyBlocks` の参照のみ
- `BoxCollider`（`Size = (width, height, 0.01)`）
- `Grabbable`（`isLock == false` の場合のみ）

## 6. マテリアル仕様

- `BlendMode = Alpha`
- `Color.profile = Linear`
- `Color.a = clamp(opacity / 100, 0..1)`
- RGB は画像有無で切替
  - 画像なし: 黒 (`r=g=b=0`)
  - 画像あり: 白 (`r=g=b=1`)

## 7. 共有マテリアル

共有化キーは `BlendMode` だけでなくマテリアル fields 全体で判定します。
そのため、画像あり/なし（Color が異なる）マスクは別マテリアルとして共有されます。

## 8. 確認ポイント

1. `opacity` が alpha に反映される
2. 画像有無で RGB が白/黒に切り替わる
3. 位置補正と回転が正しい
4. 厚み `0.01` の `BoxCollider` が付く
5. 異なるマスクマテリアルが同一参照に統合されない
6. ロック解除されたマスクに `Grabbable` が付き、ロック中は付かない
