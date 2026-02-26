# Udonarium Resonite Importer

Resonite ユーザーが、ユドナリウムで配布されているセーブデータを取り込んで遊ぶためのツールです。

## 紹介動画

[![紹介動画（YouTube）](https://img.youtube.com/vi/MHxobH-TkKc/maxresdefault.jpg)](https://youtu.be/MHxobH-TkKc)

動画リンク: https://youtu.be/MHxobH-TkKc

## このツールでできること

ユドナリウムのセーブ ZIP を Resonite にインポートし、盤面の見た目と配置をまとめて再現できます。
キャラクター、カードと山札、ダイス、テーブル、地形、マップマスクに対応しています。

## ユドナリウムを知らない方向け

ユドナリウムは、Web ブラウザで動くオンラインセッション用ツール（Virtual Tabletop）です。
主にボードゲーム、TTRPG、マーダーミステリーなどで使われています。

日本語圏では、ユドナリウム用のセーブデータ（ZIP）が多数配布されています。
このツールは、それらのデータを Resonite に持ち込んで遊ぶことを目的にしています。

## 使い方

### 1. アプリを入手

[Booth](https://trivr.booth.pm/items/8034445) または [GitHub Releases](https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/latest) から ZIP をダウンロードし、展開した `Udonarium Resonite Importer` を起動します。

### 2. Resonite 側を準備

Resonite を起動し（未インストールの場合は Steam から導入）、新規ワールドを作成します。
ダッシュメニューのセッションタブで「ResoniteLinkを有効化」を実行し、「ResoniteLink がポート [数字] で動作中」と表示されたら準備完了です。

Steam: https://store.steampowered.com/app/2519830

### 3. インポート実行

アプリでユドナリウムのセーブ ZIP を選択し、手順 2 のポート番号を入力して「Resoniteにインポート」を押します。

![GUI版の使用イメージ](images/gui.ja.png)

---

## 詳細情報

### インポート時の挙動

- インポートしたオブジェクトは RootSlot 直下に生成されます。
- ルートスロット名は `Udonarium Import - [ZIPファイル名]` です。
- ルートには `udonarium-resonite-importer:root` タグが付きます。
- RootSlot 直下に同タグを持つ既存スロットがある場合は、既存スロットを置き換えます。
- 置き換え時は同じ Transform（位置・回転・大きさ）で再配置します。

### 高度なオプション

通常はデフォルトのまま利用できます。必要な場合のみ変更してください。

- ルートにGrabbableを付ける（初期値: オフ）
  - 盤面全体を掴めるようにします。
- ルートスケール（初期値: 1 (m)）
  - ルートスケールを変更します。
  - 既存の `udonarium-resonite-importer:root` タグ付きスロットがある場合、そのスケールが優先されます。
  - 初期状態では 1 マス = 1 m になるよう変換します。
- テーブルと固定された地形にコライダーを付ける（初期値: オフ）
  - CharacterCollider を付与し、乗れるようにしつつ壁のすり抜けを防ぎます。
  - 固定されていない地形には付与しません。
- 半透明画像の描画方法（初期値: Cutout）
  - 半透明画像の BlendMode を一括設定します（個別設定不可）。
  - `Cutout`: 透明度しきい値未満を描画しません（切り抜き向け）。
  - `Alpha`: 透明度に応じて描画します（重なり時に奥側の表示が欠ける場合あり）。
- SimpleAvatarProtectionを付ける（初期値: オン）
  - 自分以外が保存できないようにします。
  - 誰でも保存してよいものをインポートする場合のみオフにしてください。
- ResoniteLinkホスト（初期値: localhost）
  - localhost 以外の ResoniteLink を使う場合に指定します（未検証）。

### MMC26 エントリー

- イベント: [Metaverse Maker Competition 2026](https://youtu.be/MHxobH-TkKc)
- カテゴリ: other tau
- ワールド: [[MMC26] Udonarium Resonite Importer - Resonite](https://go.resonite.com/world/G-1Nc5BgekFJQ/R-b0e1dc28-fec9-48cb-8fee-58459f3f637a)

### クレジット

- 開発者: yoshi1123_
- テスター: ankou, ifura, KTY, usaturn, Karabina
- フィードバック: lill

使用アセット:

- ユドナリウム公式アセット: https://github.com/TK11235/udonarium

使用ツール:

- Vibe Coding & 翻訳: Claude Code, GitHub Copilot, ChatGPT/Codex
- 動画編集: Davinci Resolve

動画内で使用しているアセット:

- BGM: [魔王魂](https://maou.audio/bgm_cyber13/) - CC BY 4.0 https://creativecommons.org/licenses/by/4.0/
- ユドナ用ルームデータ（テーブル数47） | ouma https://ouma.booth.pm/items/5499018
- 【D&D5版】ダンジョン＆ドラゴンズ第5版シナリオ「囚われの花嫁」 | しらたき置き場 https://nabenosoko.booth.pm/items/3694104
