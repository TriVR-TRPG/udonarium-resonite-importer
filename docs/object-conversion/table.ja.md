# Table 変換仕様

[English](table.md)

## 1. 対象

Udonarium の `game-table` オブジェクトを Resonite の slot/component へ変換する仕様です。

## 2. 入力フィールド（Udonarium）

- `name`
- `width`
- `height`
- `gridType`
- `gridColor`
- `imageIdentifier`（天板画像、任意）
- `selected`（任意）
- `children`（配下オブジェクト: terrain / table-mask）

## 3. パーサー挙動

`parseGameTable(...)` は `GameTable` へ正規化します。

保持される値:

- `type = "table"`
- `position = (0, 0, 0)`（table 自体は原点基準）
- 天板画像識別子がある場合は `images[0]` に保持
- 配下の terrain / table-mask オブジェクトを `children` に収集
- `selected` がある場合は `selected` に保持

デフォルト値:

- `width = 20`
- `height = 15`
- `gridType = "SQUARE"`
- `gridColor = "#000000"`

## 4. 座標・回転変換

ルート slot:

- 共通座標変換:
  - `resonite.x =  udonarium.x * SCALE_FACTOR`
  - `resonite.y =  udonarium.z * SCALE_FACTOR`
  - `resonite.z = -udonarium.y * SCALE_FACTOR`
- table ルートの回転は強制的に `(0, 0, 0)`

天板子 slot（`-surface`）:

- `position = (width / 2, 0, -height / 2)`
- `rotation = (90, 0, 0)`

これにより、table コンテナの座標安定性を保ちつつ、天板メッシュを table 平面に一致させます。

## 5. スロット構造

table ルート slot:

- ルート自身には component を持たない
- 子として以下を持つ:
  1. `-surface`（天板表示）
  2. 変換済みの table 配下オブジェクト（terrain / table-mask）

天板 slot（`-surface`）:

- `QuadMesh`（`Size = (width, height)`）
- `XiexeToonMaterial`
- `MeshRenderer`
- `buildQuadMeshComponents(...)` による任意のテクスチャ関連コンポーネント
- `BoxCollider`（`Size = (width, height, 0)`）

## 6. テクスチャ・マテリアル

- 天板の画像識別子は `images[0]?.identifier`
- `resolveTextureValue(...)` でテクスチャ値を解決
  - ローカルプレースホルダ: `texture://<identifier>`
  - 共有参照: `texture-ref://<identifier>`
- `BlendMode` は画像 alpha 情報（`lookupImageBlendMode(...)`）から決定
  - 見つからない場合は `Opaque`

## 7. 複数テーブル時の表示制御

オブジェクト変換後、table slot の `isActive` を次の条件で調整します。

- table が `0` または `1` 個: 何も上書きしない
- table が `2` 個以上かつ `selected=true` が 0 件: 何も上書きしない
- table が `2` 個以上かつ `selected=true` が 1 件以上:
  - `selected=true` の table は `isActive = true`
  - それ以外の table は `isActive = false`

これにより、複数 table があるデータでは選択中 table のみ表示されます。

## 8. 確認ポイント

1. `-surface` が `(width/2, 0, -height/2)` に配置される
2. table ルート回転が `(0,0,0)` に固定される
3. `-surface` に `QuadMesh` と `BoxCollider` が付与される
4. table 配下オブジェクトが `-surface` の後続子として変換される
5. `BlendMode` が画像 alpha 情報に従い、未定義時は `Opaque`
6. 複数 table データで `selected=true` の table が表示、他は非表示になる
