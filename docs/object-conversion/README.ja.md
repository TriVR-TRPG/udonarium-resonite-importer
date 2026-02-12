# オブジェクト変換仕様

このディレクトリには、Udonarium から Resonite へのオブジェクト変換仕様をオブジェクト種別ごとにまとめます。

[English](README.md)

## 現在の仕様

- `terrain.ja.md`: Terrain の変換ルールとコンポーネント構成
- `texture-placeholders.ja.md`: `texture://` / `texture-ref://` の使い分けと導入理由

## 今後追加予定

- `character.ja.md`
- `card.ja.md`
- `card-stack.ja.md`
- `table.ja.md`
- `text-note.ja.md`

各仕様書では以下を記載します。

1. 入力プロパティ（Udonarium 側）
2. 出力表現（Resonite の slot/component 構造）
3. 座標・回転の変換ルール
4. テクスチャ／マテリアル適用ルール
5. コライダー設定
6. 条件分岐（mode/isLocked など）
7. 制約事項とテスト観点
