# オブジェクト変換仕様

このディレクトリには、Udonarium から Resonite へのオブジェクト変換仕様をオブジェクト種別ごとにまとめています。

[English](README.md)

## 現在の仕様

- [Terrain](terrain.ja.md): Terrain の変換ルールとコンポーネント構成
- [キャラクター (GameCharacter)](character.ja.md): Character の変換ルール（画像比率メッシュと Inventory 振り分け）
- [カード (Card)](card.ja.md): Card の変換ルール（表裏面ごとのアスペクト比を含む）
- [カードの山札 (CardStack)](card-stack.ja.md): Card Stack の変換ルールと子カード積層挙動
- [ダイス (DiceSymbol)](dice-symbol.ja.md): Dice Symbol の変換ルール（面サイズとアクティブ面制御）
- [テーブル (GameTable)](table.ja.md): Table の変換ルール（天板構造と selected による表示制御）
- [マップマスク (TableMask)](table-mask.ja.md): Table Mask の変換ルールとマテリアル挙動
- [テクスチャプレースホルダー](texture-placeholders.ja.md): `texture://` / `texture-ref://` の使い分け

## 今後追加予定

- `text-note.ja.md`（共有メモ / TextNote）

各仕様書には、以下を記載します。

1. 入力プロパティ（Udonarium）
2. 出力表現（Resonite の slot/component）
3. 座標・回転の変換ルール
4. テクスチャ・マテリアルの適用ルール
5. Collider のルール
6. 条件分岐（mode/isLocked など）
7. 既知制約とテスト観点
