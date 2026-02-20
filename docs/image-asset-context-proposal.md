# 画像情報の取り扱い統合（ImageAssetContext）提案（改訂）

## 目的
画像関連情報が複数 `Map` に分散していることで、変換処理の追跡コストが高くなっている。
本提案では、画像1件ごとの情報を `ImageAssetContext` に統合し、
`ResoniteObjectBuilder` 側が必要情報を一貫して参照できる設計にする。

---

## 現在の課題（再整理）
現在は以下の map が並行して使われる。

- `textureMap`（identifier -> URL / `texture-ref://...`）
- `imageAspectRatioMap`（identifier -> aspect ratio）
- `imageBlendModeMap`（identifier -> blend mode）
- `textureComponentMap`（identifier -> `texture-ref://...`）

問題点:

1. map ごとに key 正規化ルールが暗黙で、追跡が難しい
2. 同じ identifier に対する意味（URL / 参照 / metadata）が段階ごとに変わる
3. `addQuadMesh` の判断材料が呼び出し側に分散している

---

## 現在フローの調査結果

### A. ZIP内通常画像（png/jpg/gif など）
1. `AssetImporter.importImage` で `importTexture(...)` を呼び、`identifier -> resdb://...` を登録
2. `SlotBuilder.createTextureAssets` が `StaticTexture2D(URL=resdb://...)` を作成
3. その componentId を `texture-ref://...` 化し、変換時 map として使う

### B. ZIP内SVG
1. `AssetImporter.writeTempFile` が SVG を PNG 変換
2. 以降は A と同じ（`resdb://...` -> `texture-ref://...`）

### C. 既知ID（`KNOWN_IMAGES`）
1. `registerExternalUrls` で `identifier -> known url` を登録（`importTexture` は不要）
2. `createTextureAssets` が URL を持つ shared `StaticTexture2D` を作る
3. 変換時には `texture-ref://...` 参照を使う

### D. Udonarium 相対パス（`./assets/...`）
1. `registerExternalUrls` で `https://udonarium.app/...` へ変換して登録
2. 以降は C と同じ

### E. 外部URL（png/jpg など）
1. `registerExternalUrls` で URL をそのまま登録
2. 以降は C と同じ

### F. 外部URL（svg）
1. `registerExternalUrls` が `importExternalSvgUrl` を呼ぶ
2. ダウンロード -> PNG 変換 -> `importTexture` で `resdb://...` を登録
3. 以降は A/B と同じ

---

## 現状の問題有無（調査観点）

- 上記 A〜F はすべて `importedTextures` に収束できるため、shared texture 化の入口は一貫している。
- 一方で、以下は改善余地がある。
  - `filterMode` 判定が `isGifTexture(identifier, textureMap)` に依存しており、
    identifier/URL の揺れがあると判定責務が読みにくい。
  - `blendMode` と `aspectRatio` は map 参照、`filterMode` はその場推論という非対称性がある。

結論: **現状フローは破綻していないが、判定責務の分散が保守性リスク**。

---

## 提案: `ImageAssetContext` に集約

```ts
export type ImageFilterMode = 'Default' | 'Point';

export type ImageAssetInfo = {
  identifier: string;
  sourcePath?: string;

  // texture source
  textureUrl?: string;          // resdb://... or external URL
  textureReference?: string;    // texture-ref://...

  // render metadata
  aspectRatio?: number;
  blendMode?: ImageBlendMode;
  filterMode?: ImageFilterMode; // GIFなどを事前解決

  // traceability (任意)
  sourceKind?:
    | 'zip-image'
    | 'zip-svg'
    | 'known-id'
    | 'udonarium-asset-url'
    | 'external-url'
    | 'external-svg';
};

export type ImageAssetContext = {
  byIdentifier: Map<string, ImageAssetInfo>;
};
```

### Context API イメージ

- `getTextureValue(identifier)`
  - `textureReference` があればそれを優先
  - なければ `textureUrl`
- `getAspectRatio(identifier)`
- `getBlendMode(identifier)`
- `getFilterMode(identifier)`

### filterMode を context に持たせる理由
- 現状は GIF 判定と FilterMode 決定が `buildStaticTexture2DFields` 呼び出し時に散在している。
- これを `filterMode` に事前確定しておけば、
  `ResoniteObjectBuilder` / `SlotBuilder` は「値を使うだけ」に単純化できる。
- 将来 APNG/WebP 等を扱う際にも判定差し替えしやすい。

---


## 理想形（最終到達イメージ）

### 設計のゴール
- `AssetImporter` が画像ごとの `ImageAssetInfo` を直接生成・更新する。
- `ImageAssetContext` は `ImageAssetInfo` を集約する読み取り専用ビューになる。
- `ObjectConverter` / `ResoniteObjectBuilder` / `SlotBuilder` は context API だけを参照する。

### 目指すデータフロー
1. 取り込み時に `AssetImporter` が `identifier` ごとに `sourceKind` / `textureUrl` を確定
2. shared texture 化後に `textureReference` を同じ `ImageAssetInfo` に反映
3. `ImageAssetContext` が `getTextureValue/getAspectRatio/getBlendMode/getFilterMode` を提供
4. converter/builder は map を意識せず context から取得

### 残タスク（理想形との差分）
- [x] `sourceKind` を推定ではなく取り込み時イベントから確定値として保存（import/register 経路は対応済み。context 側推定は最終フォールバックとしてのみ残置）
- [x] `AssetImporter` から `ImageAssetInfo` を直接受け渡す API を追加
- [x] `textureComponentMap` など中間 map を段階的に廃止（CLI/GUI は `SlotBuilder.createTextureAssetsWithUpdater` で importer の `ImageAssetInfo` を直接更新）
- [x] context 生成ロジックを `buildImageAssetContext(...)` に一本化し、CLI/GUI から共通利用


### ローカル作業向け TODO（次の実装順）
- [x] `AssetImporter` で `sourceKind` を推定依存にせず、登録/取り込みイベント（ZIP・known-id・外部URL・外部SVG）起点で必ず確定させる
- [x] dry-run 経路でも `ImageAssetInfo` を一時生成できる共通ヘルパーを追加し、通常 import と同一の context 入力形式に揃える
- [x] `createImageAssetContext` の map フォールバック（`textureMap` / `imageSourceKindMap`）を縮小し、`imageAssetInfoMap` 優先の API に段階移行する
- [x] `SlotBuilder` の `createTextureAssets` 戻り値を段階的に `Map<string, ImageAssetInfo>` 更新APIへ置き換え、componentId map を外部に露出しない形へ寄せる
- [x] 完了後に `BuildImageAssetContextOptions` の legacy 項目（`textureValueMap` など）を deprecated 表記し、最終的な削除計画を明記する

### Legacy削除計画（確定）
1. Phase A（現行）:
   `BuildImageAssetContextOptions` の legacy 項目（`textureValueMap` / `textureReferenceComponentMap` / `imageSourceKindMap`）は `@deprecated` + 実行時 warning で維持。
2. Phase B（次マイナー）:
   CLI/GUI/Importer からの legacy オプション利用を禁止し、`imageAssetInfoMap` を唯一の推奨入力としてドキュメント更新。
   先行措置として `UDONARIUM_IMPORTER_STRICT_DEPRECATIONS=1` で deprecated API/オプション使用時に例外化する strict モードを提供。
3. Phase C（次メジャー）:
   `BuildImageAssetContextOptions` から legacy 項目を削除し、`buildImageAssetContext(...)` は `imageAssetInfoMap` ベース API のみを公開。
4. 互換性方針:
   テストは `createImageAssetContext` の legacy フォールバック検証を段階的に縮小し、最終的に `imageAssetInfoMap` 前提ケースのみ残す。

---

## 実装方針（段階移行）

### Phase 1: Context 生成を追加（互換維持）
- `buildImageAssetContext(...)` を追加。
- 既存の `buildImageAspectRatioMap` / `buildImageBlendModeMap` / `textureComponentMap` 生成は残す。
- まずは context と旧 map を並行生成し、差分ログで検証可能にする。

### Phase 2: Builder/Converter 参照先の置換
- `convertObjectsWithTextureMap` の内部で context を使う経路を追加。
- `addQuadMesh` オプションを `textureIdentifier + imageAssetContext` ベースへ移行。
- `isGifTexture(...)` 依存を `getFilterMode(...)` 参照に置き換える。

### Phase 3: 旧 map API 廃止
- map 個別引数を削除し、context に一本化。
- key 正規化ロジックを context builder に限定。

---

## 期待効果

- 画像情報の入口/出口が1つになり、調査と変更が容易になる
- `resdb://` と `texture-ref://` の段階差を型で表現できる
- `filterMode` / `blendMode` / `aspectRatio` の判定責務を同一レイヤーへ集約できる



---

## 実装状況メモ（現時点）

- `ObjectConverter` および各 object converter は `ImageAssetContext` を受け取る形へ移行済み。
- `ResoniteObjectBuilder.addQuadMesh` も `imageAssetContext` 参照で texture/blend/filter を解決する実装に移行済み。
- `ImageAssetContext` に `byIdentifier` / `getAssetInfo(...)` を追加し、
  提案時に想定した「画像単位の情報集約」に近づけた。
- `sourceKind` は import/register イベント起点で `ImageAssetInfo` に保存する実装へ移行済み。context 側推定は後方互換の最終フォールバックとして限定。
- context 生成は `buildImageAssetContext(...)` に集約し、CLI/GUI は importer ヘルパー経由で共通利用する構成へ移行済み。
- `AssetImporter` は `ImageAssetInfo` を一次情報として保持し、shared texture 作成時は `SlotBuilder.createTextureAssetsWithUpdater(...)` と `applyTextureReference(...)` で直接更新する構成へ移行済み。
- 旧API `AssetImporter.applyTextureReferences(...)` は後方互換のため残置しつつ `@deprecated` 化済み。
- 旧API（`AssetImporter.applyTextureReferences(...)` / `SlotBuilder.createTextureAssets(...)`）は実行時に one-time warning を出す実装へ移行済み。
- `SlotBuilder.createTextureAssets(...)` は `@deprecated` を付与し、`createTextureAssetsWithUpdater(...)` への移行を明示済み。
- `UDONARIUM_IMPORTER_STRICT_DEPRECATIONS=1` の場合、deprecated API/オプション使用時は warning ではなく例外を投げる。
- CI は strict モード専用テスト（`npm run test:strict-deprecations`）を実行し、deprecated API/オプション混入を継続検知する。
- ランタイム経路（CLI/GUI の importer context 経路）で legacy warning が発火しないことをテストで固定済み。
- dry-run も `buildDryRunImageAssetInfoMap(...)` で `ImageAssetInfo` を生成し、通常 import と同じ context 入力形式で処理する構成へ移行済み。
- `BuildImageAssetContextOptions` の legacy 項目には deprecate 注釈と実行時 warning を追加済み。
