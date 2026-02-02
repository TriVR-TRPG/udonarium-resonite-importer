# Claude Code 引き継ぎメモ

## 現在の状態

### 完了した作業
- TypeScriptプロジェクトの初期設定
- CLI版の実装（ZIPパース、XML解析、ResoniteLink接続）
- GUI版（Electron）の基本実装
- ESLint + Prettier の導入
- tsconfig分離（CLI用・GUI用）
- strictモードでのビルド成功

### ファイル構成
```
src/
├── index.ts                 # CLIエントリーポイント
├── config/
│   └── MappingConfig.ts     # 座標変換設定
├── parser/
│   ├── ZipExtractor.ts      # ZIP解凍
│   ├── XmlParser.ts         # XML解析
│   └── objects/             # 各オブジェクトパーサー
├── converter/
│   ├── UdonariumObject.ts   # Udonarium型定義
│   ├── ResoniteObject.ts    # Resonite型定義
│   └── ObjectConverter.ts   # 変換ロジック
├── resonite/
│   ├── ResoniteLinkClient.ts    # WebSocketクライアント
│   ├── SlotBuilder.ts           # スロット生成
│   └── AssetImporter.ts         # アセットインポート
└── gui/
    ├── main.ts              # Electronメインプロセス
    ├── preload.ts           # プリロードスクリプト
    ├── renderer.ts          # レンダラースクリプト
    ├── types.ts             # 共有型定義
    ├── electron.d.ts        # Electron型宣言
    ├── index.html           # GUI HTML
    └── styles.css           # GUI スタイル
```

### ビルドコマンド
```bash
npm run build        # CLI版ビルド
npm run build:gui    # GUI版ビルド
npm run build:all    # 両方ビルド
npm run lint         # ESLintチェック
npm run format       # Prettierフォーマット
```

## 未実装・改善が必要な点

### 高優先度
1. **ResoniteLinkプロトコルの実装確認**
   - 現在の実装は推測に基づいている
   - 実際のResoniteLinkの仕様を確認して修正が必要

2. **Electronのテスト**
   - 現環境でElectronがインストールできていない（ネットワークエラー）
   - `npm install`を再実行してElectronをインストール後にテストが必要

3. **XMLパーサーの検証**
   - 実際のUdonariumセーブデータでのテストが必要
   - 対応オブジェクト: character, card, card-stack, terrain, table, table-mask, text-note

### 中優先度
4. **エラーハンドリングの強化**
   - 接続リトライロジックの実装
   - ユーザーへのエラーメッセージ改善

5. **GUI版のUX改善**
   - ドラッグ&ドロップ対応
   - 設定の保存/読み込み

### 低優先度
6. **テストの追加**
   - ユニットテスト（Jest等）
   - E2Eテスト

7. **ドキュメント**
   - README.mdにGUI版の説明追加
   - 開発者向けドキュメント

## 技術的なメモ

### TypeScript設定
- `tsconfig.cli.json`: CLI用（DOM除外）
- `tsconfig.gui.json`: GUI用（DOM含む）
- 両方strict: trueで設定

### Electron IPC通信
- `select-file`: ファイル選択ダイアログ
- `analyze-zip`: ZIPファイル解析
- `import-to-resonite`: Resoniteへインポート
- `import-progress`: 進捗通知（メイン→レンダラー）

### 座標系変換
```
Udonarium (2D)       Resonite (3D)
+X → 右               +X → 右
+Y → 下               +Y → 上
                      +Z → 奥

resonite.x = udonarium.x * 0.02
resonite.y = 0
resonite.z = -udonarium.y * 0.02
```

## 次のステップ候補
1. Electronインストール後のGUI動作確認
2. ResoniteLinkの実機テスト
3. サンプルのUdonariumセーブデータでの検証
4. パッケージング（electron-builder）のテスト
