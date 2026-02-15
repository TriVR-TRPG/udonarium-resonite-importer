# オブジェクト変換仕様

このディレクトリには、Udonarium から Resonite へのオブジェクト変換仕様をオブジェクト単位でまとめます。

[English](README.md)

## 現在の仕様

- [Terrain](terrain.ja.md): Terrain の変換ルールとコンポーネント構成
- [Card](card.ja.md): Card の変換ルール（表裏個別アスペクト比を含む）
- [Table Mask](table-mask.ja.md): Table Mask の変換ルールとマテリアル挙動
- [テクスチャプレースホルダー](texture-placeholders.ja.md): `texture://` / `texture-ref://` の使い分け

## 追加予定

- `character.ja.md`
- `card-stack.ja.md`
- `table.ja.md`
- `text-note.ja.md`

各仕様書には以下を記載します。

1. 入力プロパティ（Udonarium）
2. 出力表現（Resonite の slot/component）
3. 座標と回転の変換ルール
4. テクスチャ/マテリアルの適用ルール
5. Collider のルール
6. 条件分岐（mode/isLocked など）
7. 既知制約とテスト観点
