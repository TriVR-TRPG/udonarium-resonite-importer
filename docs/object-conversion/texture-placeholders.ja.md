# texture:// / texture-ref:// 設計メモ

## 概要

このプロジェクトでは、コンポーネント生成時のテクスチャ指定に以下 2 種類の記法を使います。

- `texture://<identifier>`
- `texture-ref://<componentId>`

見た目は URL 風ですが、どちらも **変換パイプライン内部で使う識別子** です。

## `texture://` の役割

`texture://` は「まだ実 URL（`resdb:///...` など）が確定していないテクスチャ」を表すプレースホルダーです。

- `resolveTextureValue()` は `textureMap` がない場合に `texture://<identifier>` を返す。
- `replaceTexturesInValue()` / `resolveTexturePlaceholders()` が、オブジェクト全体を再帰的に走査してこのプレースホルダーを実 URL に置換する。

### なぜ必要か

- **dry-run 対応**: Resonite 側に接続せず変換結果だけ確認する場合でも、テクスチャ欄に「何を参照する予定か」を保持できる。
- **2 段階処理の分離**: オブジェクト変換（形状・座標）と、アセットインポート（URL 確定）を疎結合に保てる。
- **再帰オブジェクト対応**: table/terrain のような子オブジェクトを含む構造でも、後段で一括置換できる。

## `texture-ref://` の役割

`texture-ref://` は「同じスロット内の既存 `StaticTexture2D` コンポーネント ID を参照する」ための内部記法です。

- `parseTextureReferenceId()` が `texture-ref://` から componentId を取り出す。
- `buildQuadMeshComponents()` / `buildBoxMeshComponents()` は `texture-ref://` を検知すると、
  - 新しい `StaticTexture2D` を生成せず
  - マテリアルの `Texture` / `AlbedoTexture` を既存 componentId に直接 `reference` 接続する。

### なぜ必要か

- **重複コンポーネント削減**: 同一テクスチャを複数マテリアルで使うときに `StaticTexture2D` を増殖させない。
- **共有を明示**: 値が URL なのか、既存コンポーネント参照なのかを文字列だけで判別できる。
- **副作用回避**: `texture://` と異なり、後段の URL 置換対象にしない（`isGifTexture()` でも参照値として扱う）。

## 使い分けの目安

- 実ファイル由来の識別子（`front.png` など）を後で URL 解決したい → `texture://...`
- 同一オブジェクト内で既存テクスチャコンポーネントを再利用したい → `texture-ref://...`

この 2 つを分離していることで、

1. 変換フェーズは「どのテクスチャを使うか」だけ決める
2. インポート/生成フェーズは「どの URL/コンポーネントに張るか」を決める

という責務分離を維持できます。
