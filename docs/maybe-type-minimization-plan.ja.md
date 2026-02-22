# `Maybe` 型最小化計画

## 目的

- `Maybe<T> = T | undefined` の導入を必要最小限に抑え、型の可読性と保守性を上げる。
- `undefined` 削減の流れは維持しつつ、独自型エイリアス依存を減らす。

## 背景

- `undefined` 記述削減のために `Maybe<T>` を導入したが、以下の懸念がある。
  - 初見で意味が伝わりにくい（`T | undefined` の方が直接的）
  - ファイルごとのローカル `Maybe` 定義が増えると一貫性が崩れる
  - エディタ検索時に `undefined` の実態が見えにくくなる

## 方針

- 原則として `Maybe` を新規導入しない。
- 既存 `Maybe` は段階的に削除し、以下へ置換する。
  - 引数: optional 引数（`arg?: T`）
  - 戻り値: `T | undefined` を明示（必要な場合のみ）
  - オブジェクト: optional プロパティ（`prop?: T`）
- 「Optional は後ろに寄せる」ルールで、`arg?: T` を使いやすいシグネチャに揃える。

## 実施フェーズ

### フェーズ 1: ルール確定

- コーディング方針を明文化する。
  - `Maybe` 新規追加は禁止
  - 既存 `Maybe` は変更時に順次除去
  - required 引数の後ろに optional 引数を配置

### フェーズ 2: 既存 `Maybe` の置換

対象優先順:

1. `src/converter/imageAssetContext.ts`
2. `src/converter/imageAspectRatioMap.ts`
3. `src/converter/objectConverters/cardConverter.ts`
4. `src/parser/objects/ParserUtils.ts`
5. `src/converter/sharedMaterial.ts`

置換ルール:

- `Maybe<T>` 戻り値は `T | undefined` へ置換
- `Maybe<string>` など引数型は可能な限り `arg?: string` へ置換
- `=== undefined` / `!== undefined` は `== null` / `!= null` へ統一できる箇所を整理

### フェーズ 3: 品質ゲート

- `rg -n "type Maybe<|\\bMaybe<" src scripts` で残件を可視化
- `npm run check:validate:types:test`
- `npm run check:validate:lint`

## 完了条件

- 本体コード（`src/**/*.ts`, `scripts/**/*.ts`）で `Maybe` 型定義の新規追加がない
- 既存 `Maybe` 定義を段階的に削除できている
- 型チェックと lint が継続して通過する
