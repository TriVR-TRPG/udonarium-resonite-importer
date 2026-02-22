# undefined 利用ポリシー

## 対象

- 本体コード: `src/**/*.ts`, `scripts/**/*.ts`
- テストコード: `**/*.test.ts`
- ドキュメント: `docs/**/*.md`

## 基本方針

- 本体コードでは `undefined` の明示利用を原則禁止する。
- 欠損値は次の優先順で扱う。
  1. optional 引数・optional プロパティ（`foo?: T`）
  2. `null` による明示的な欠損
  3. 型推論に任せた暗黙 `undefined`（必要最小限）

## 本体コードのルール

- `return undefined` は禁止。
- `foo = undefined` 初期化は禁止。
- 比較は `x != null` を優先し、`undefined` 単独比較は避ける。
- 引数スキップ目的の `func(a, undefined, c)` は禁止し、引数順や API を見直す。
- `type Maybe<T>` の新規追加は禁止（欠損は `null` / optional / 直接 union で表現）。

## テストコードの例外

- `undefined` を仕様として検証するケースのみ許可する。
  - 例: 外部 API 互換性テスト、既存バグ回帰テスト
- 許可する場合は、テスト名またはコメントで「`undefined` を検証する理由」を明記する。

## ドキュメント記述

- コード例は `undefined` より `null`・optional 記法を優先する。
- `undefined` を記述する場合は、互換性要件か仕様上の必要性を明記する。

## 運用

- CI では ESLint の `no-undef-init` と `no-restricted-syntax`（`return undefined`）を `error` で運用する。
- 本体コードで例外が必要な場合のみ、局所的な `eslint-disable` を理由付きで許可する。
- 継続監視として、新規差分で `npm run -s metrics:undefined:count` が増えていないことを確認する。
