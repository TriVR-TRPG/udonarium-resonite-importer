# Maybe型 利用最小化計画

## 目的

- `Maybe<T>` エイリアス依存を減らし、型定義を読んだだけで欠損値方針が分かる状態にする。
- 欠損値の表現を `null` / optional / 型推論に整理し、`Maybe` の横断的な伝播を抑える。

## 現状（2026-02-22）

- 本体コードの `undefined` 明示利用は 0（`npm run -s metrics:undefined:count`）。
- ただし以下4ファイルで `type Maybe<T> = T | null;` が残っている。
  1. `src/converter/imageAspectRatioMap.ts`
  2. `src/converter/imageAssetContext.ts`
  3. `src/converter/sharedMaterial.ts`
  4. `src/parser/objects/ParserUtils.ts`

## 基本方針

- 新規の `type Maybe<T>` 追加は禁止。
- 既存 `Maybe<T>` は段階的に次へ置換する。
  1. 戻り値: `T | null` を直接記述
  2. 引数: `arg?: T` または `arg: T | null` を用途で使い分け
  3. フィールド: `prop?: T` を優先（必要時のみ `prop: T | null`）
- 置換時は API 互換性を崩さず、呼び出し側を同時に調整する。

## 実施フェーズ

### フェーズ1: 低リスク置換

対象:

- `src/converter/sharedMaterial.ts`
- `src/parser/objects/ParserUtils.ts`

作業:

- `Maybe<T>` 型エイリアスを削除。
- シグネチャを `T | null` へ直接展開。
- `null` 判定を `== null` / `!= null` に統一。

### フェーズ2: 変換系コンテキストの置換

対象:

- `src/converter/imageAssetContext.ts`

作業:

- `ImageAssetContext` インターフェースから `Maybe` を除去。
- `getAssetInfo` / `resolveTextureValue` / `lookupAspectRatio` の型を直接記述。
- 呼び出し側（converter / resonite）で型崩れが出ないことを確認。

### フェーズ3: 画像マップ系の置換

対象:

- `src/converter/imageAspectRatioMap.ts`

作業:

- `Maybe` 依存の戻り値を `T | null` または推論型へ置換。
- `Promise<Maybe<T>>` を `Promise<T | null>` に統一。

### フェーズ4: 運用固定化

作業:

- `rg -n "type Maybe<|\\bMaybe<" src` をCIチェック項目として運用（最初は手動監視）。
- `docs/undefined-policy.ja.md` に「`Maybe` 新規追加禁止」を追記。

## 検証

- `npm run -s check:validate:types:test`
- `npm run -s check:validate:lint`
- `rg -n "type Maybe<|\\bMaybe<" src`

## 完了条件

- `src/**` に `type Maybe<T>` 宣言が存在しない。
- `Maybe<` 参照が 0。
- lint / type check が通過している。
