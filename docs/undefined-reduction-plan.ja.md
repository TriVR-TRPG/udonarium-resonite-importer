# undefined 利用削減計画

## 目的

TypeScript コードベースで `undefined` の明示利用を段階的に減らし、意図しない欠損値伝播や分岐の複雑化を抑制する。

## 背景

現状の本体コード（`src/**/*.ts`, `scripts/**/*.ts`, `*.test.ts` 除外）では、`undefined` の利用が広範囲に存在する。

- `undefined` 出現: 177
- `| undefined` 型注釈: 82
- `return undefined`: 53

特に以下のファイル群で集中している。

- `src/converter/imageAspectRatioMap.ts`
- `src/converter/imageAssetContext.ts`
- `src/parser/objects/ParserUtils.ts`
- `src/converter/sharedMaterial.ts`
- `src/converter/sharedMesh.ts`

## 方針

- いきなり `error` 化せず、まず `warn` で導入して差分を減らす。
- ルール追加と TypeScript オプション強化を分離し、回帰点を小さくする。
- ホットスポットから優先的にリファクタし、最後に CI ゲートを強化する。

## 実施フェーズ

### フェーズ 1: 可視化と軽量ルール導入

1. `undefined` 利用数を計測する npm スクリプトを追加する。
2. ESLint に以下を `warn` で追加する。
   - `no-undef-init`
   - `no-restricted-syntax`（`return undefined` を検出）
3. 既存 CI で lint 警告を観測し、修正優先度を決める。

成果物:

- 計測用 script 追加
- ESLint ルール追加

### フェーズ 2: TypeScript 厳格化の段階導入

1. `exactOptionalPropertyTypes` を `tsconfig.test.json` から試験導入。
2. 型エラー傾向を確認後、`cli/gui/scripts` 用 tsconfig に展開。

成果物:

- 段階導入された tsconfig 設定
- 影響箇所の修正 PR

### フェーズ 3: ホットスポットリファクタ

対象:

- `imageAspectRatioMap`
- `imageAssetContext`
- `ParserUtils`

施策:

- `return undefined` の削減（早期 return / `null` / Result 型への寄せ）
- 呼び出し側 `func(..., undefined)` の削減（引数オーバーロード・引数分離）
- `foo: T | undefined` から `foo?: T` への整理（適用可能箇所のみ）

成果物:

- ファイル単位の `undefined` 利用件数削減
- 回帰テスト維持

### フェーズ 4: 運用固定化

1. ESLint ルールを `warn` から `error` へ昇格。
2. `npm run check:validate` を品質ゲートとして維持。
3. 例外は `eslint-disable` を局所・理由付きで許可。

成果物:

- `undefined` 利用方針の運用ルール
- CI での恒久ガード

## 完了条件

- 本体コードで `undefined` の明示利用件数が継続的に減少している。
- 新規コードで不要な `undefined` 利用が lint で検出・修正される。
- 既存テスト（unit/integration）が通過し、変換仕様に回帰がない。
