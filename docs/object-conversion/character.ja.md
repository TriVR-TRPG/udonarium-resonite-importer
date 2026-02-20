# Character 変換仕様

[English](character.md)

## 1. 対象

Udonarium の `character` を Resonite の slot/component に変換する仕様です。

## 2. 入力フィールド（Udonarium）

- `name`
- `position.x`（`location.x`）
- `position.y`（`location.y`）
- `position.z`（`posZ`）
- `location.name`（任意）
- `size`
- `rotate`（任意）
- `roll`（任意）
- `images[0].identifier`（任意）

## 3. 座標・回転変換

基礎座標変換:

- `resonite.x =  udonarium.x * SCALE_FACTOR`
- `resonite.y =  udonarium.z * SCALE_FACTOR`
- `resonite.z = -udonarium.y * SCALE_FACTOR`

回転:

- `rotation = (x: 0, y: rotate ?? 0, z: roll ?? 0)`

中心補正:

- `x += width / 2`
- `z -= width / 2`
- `y += visualHeight / 2`

ここで:

- `width = size`
- 画像あり: `visualHeight = width * aspectRatio`
- 画像なし: `visualHeight = size`

## 4. メッシュサイズとアスペクト比

画像あり:

- 横幅は常に `size`
- 縦幅は画像比率で計算:
  - `height = size * aspectRatio`
- `aspectRatio` は `imageAspectRatioMap` から解決
- 解決できない場合は `1`

画像なし:

- メッシュを生成しない

## 5. コンポーネント

### 5.1 画像あり

生成されるコンポーネント:

- `QuadMesh`（`Size = (size, size * aspectRatio)`, `DualSided = true`）
- `XiexeToonMaterial`
- `MeshRenderer`
- `buildQuadMeshComponents(...)` が生成するテクスチャ関連
- `BoxCollider`（`Size = (size, size * aspectRatio, 0.05)`）
- `Grabbable`（常に付与）

### 5.2 画像なし

生成されるコンポーネント:

- `BoxCollider`（`Size = (size, size, 0.05)`）
- `Grabbable`（常に付与）

## 6. テクスチャ・マテリアル

画像入力:

- `images[0]?.identifier` を使用

テクスチャ解決:

- `resolveTextureValue(...)` で local/shared 参照を解決

BlendMode:

- 画像 alpha 情報（`lookupImageBlendMode(...)`）に従う
- 未解決時は `Opaque`

## 7. Inventory への振り分け（SlotBuilder）

slot 作成時（converter 外）に `location.name` で振り分けられます。

- ルート直下に `Inventory` を作成
- `Inventory/table` は必ず作成され、`isActive=true`
- それ以外の `Inventory/<location.name>` は必要時に作成され、`isActive=false`
- character slot は対応する `Inventory/<location.name>` の子になる

## 8. 確認ポイント

1. `rotate` が Y 回転、`roll` が Z 回転に反映される
2. 画像あり時のメッシュ横幅が常に `size`
3. 画像あり時のメッシュ縦幅が画像比率に従う
4. 画像なし時に mesh/material/renderer が生成されない
5. Collider は常に生成される
6. `Grabbable` は画像あり/なしにかかわらず常に付与される
7. `location.name` に応じて `Inventory` 配下へ配置される
