# Card 変換仕様

## 1. 対象

Udonarium の `card` を Resonite の親 Slot + 表裏子 Slot 構成へ変換する仕様。

## 2. 入力フィールド（Udonarium）

- `name`
- `position.x` / `position.y` / `position.z`
- `size`（カード幅。未指定時 `1`）
- `rotate`
- `isFaceUp`
- `frontImage.identifier`
- `backImage.identifier`
- `images[]`

## 3. 座標と回転

基礎座標変換:

- `resonite.x = udonarium.x * SCALE_FACTOR`
- `resonite.y = udonarium.z * SCALE_FACTOR`
- `resonite.z = -udonarium.y * SCALE_FACTOR`

親 Slot の補正:

- `x += cardWidth / 2`
- `z -= parentHeight / 2`
- `y += 0.001`

親 Slot 回転:

- `rotation = (x: 0, y: rotate, z: isFaceUp ? 0 : 180)`

## 4. アスペクト比ルール

### 4.1 表裏の面サイズ

- 表面高さ: `frontHeight = cardWidth * frontAspect`
- 裏面高さ: `backHeight = cardWidth * backAspect`

### 4.2 フォールバック

- アスペクト比が取得できない場合は `1` を使用

### 4.3 親サイズ

- 親の高さは `parentHeight = max(frontHeight, backHeight)`
- 親位置補正と `BoxCollider` は `parentHeight` を基準にする

### 4.4 表裏で高さが異なる場合

- 小さい面は上端揃え
- 子 Slot の `position.z` を以下で調整:
  - `frontZOffset = (parentHeight - frontHeight) / 2`
  - `backZOffset = (parentHeight - backHeight) / 2`

## 5. Slot 構成

### 5.1 親 Slot

- `BoxCollider` サイズ: `(x: cardWidth, y: 0.01, z: parentHeight)`
- `Grabbable`

### 5.2 子 Slot（表）

- id: `${parentId}-front`
- position: `(0, +0.0001, frontZOffset)`
- rotation: `(90, 0, 0)`
- `QuadMesh` サイズ: `(cardWidth, frontHeight)`

### 5.3 子 Slot（裏）

- id: `${parentId}-back`
- position: `(0, -0.0001, backZOffset)`
- rotation: `(-90, 180, 0)`
- `QuadMesh` サイズ: `(cardWidth, backHeight)`

## 6. テクスチャ・マテリアル

テクスチャ選択（表面）:

1. `frontImage`
2. `backImage`
3. `images[0]`

テクスチャ選択（裏面）:

1. `backImage`
2. `frontImage`
3. `images[1]`
4. `images[0]`

BlendMode:

- 各面のテクスチャ識別子に対して `lookupImageBlendMode(...)` で解決
- 未解決時のデフォルト: `Cutout`（character / dice-symbol の `Opaque` とは異なる）

## 7. 検証ポイント

1. 表裏の `QuadMesh` がそれぞれのアスペクト比で生成される
2. 親の位置と Collider が大きい方の高さに一致する
3. 表裏サイズ不一致時に小さい面が上端揃えになる
4. `isFaceUp=false` 時に親 `rotation.z=180` になる
5. `BlendMode` のデフォルトは `Cutout`
