# texture:// / texture-ref:// 設計メモ

## 概要

このプロジェクトでは、コンポーネント生成時のテクスチャ指定に以下 2 種類の記法を使います。

- `texture://<identifier>`
- `texture-ref://<componentId>`

見た目は URL 風ですが、どちらも **変換パイプライン内部で使う識別子** です。

## `texture://` の役割

`texture://` は「まだ実 URL（`resdb:///...` など）が確定していないテクスチャ」を表すプレースホルダーです。

- `resolveTextureValue()` は `textureMap` がない場合に `texture://<identifier>` を返す。
- `replaceTexturesInValue()` が、オブジェクト全体を再帰的に走査してこのプレースホルダーを実 URL に置換する。
- `buildQuadMeshComponents()` / `buildBoxMeshComponents()` では、`texture://...`（または最終 URL）を受け取ると `StaticTexture2D` と `MainTexturePropertyBlock` を同一スロットに生成する。

### なぜ必要か

- **dry-run 対応**: Resonite 側に接続せず変換結果だけ確認する場合でも、テクスチャ欄に「何を参照する予定か」を保持できる。
- **2 段階処理の分離**: オブジェクト変換（形状・座標）と、アセットインポート（URL 確定）を疎結合に保てる。
- **再帰オブジェクト対応**: table/terrain のような子オブジェクトを含む構造でも、後段で一括置換できる。

## `texture-ref://` の役割

`texture-ref://` は「既存の共有テクスチャコンポーネント（`StaticTexture2D`）を再利用する」ための内部記法です。

- `parseTextureReferenceId()` が `texture-ref://` から componentId を取り出す。
- `buildQuadMeshComponents()` / `buildBoxMeshComponents()` は `texture-ref://` を検知すると、
  - 新しい `StaticTexture2D` と `MainTexturePropertyBlock` を **ローカルには生成しない**。
  - `MeshRenderer.MaterialPropertyBlocks` に、共有側 `MainTexturePropertyBlock`（`<sharedTextureId>-main-texture-property-block`）への参照を設定する。

### MainTexturePropertyBlock について

現在は、`XiexeToonMaterial` のテクスチャ割り当ては `MainTexturePropertyBlock` 経由で統一しています。

- ローカルテクスチャ（`texture://...` / 実 URL）の場合:
  - `StaticTexture2D` を生成
  - 同一スロットの `MainTexturePropertyBlock.Texture` から参照
- 共有テクスチャ（`texture-ref://...`）の場合:
  - 共有スロットにある `MainTexturePropertyBlock` を参照
  - ローカルには重複生成しない

このため、`texture-ref://...` は「直接マテリアルの Texture フィールドに刺す」用途ではなく、**共有 property block を選ぶためのキー**として扱います。

### なぜ必要か

- **重複コンポーネント削減**: 同一テクスチャを複数マテリアルで使うときに `StaticTexture2D` / `MainTexturePropertyBlock` を増殖させない。
- **共有を明示**: 値が URL 系なのか、共有参照なのかを文字列だけで判別できる。
- **副作用回避**: `texture://` と異なり、後段の URL 置換対象にしない（`isGifTexture()` でも参照値として扱う）。

## 使い分けの目安

- 実ファイル由来の識別子（`front.png` など）を後で URL 解決したい → `texture://...`
- 既存の共有テクスチャコンポーネントを再利用したい → `texture-ref://...`

この 2 つを分離していることで、

1. 変換フェーズは「どのテクスチャを使うか」だけ決める
2. インポート/生成フェーズは「どの URL/共有コンポーネントに張るか」を決める

という責務分離を維持できます。
