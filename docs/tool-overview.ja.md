# Udonarium Resonite Importer

このツールは [ユドナリウム](https://github.com/TK11235/udonarium) のセーブデータを [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) を使って [Resonite](https://resonite.com/) へインポートできるアプリです。
テーブルや地形、マップマスク、キャラクター、カード、ダイスなどの見た目を Resonite で再現できます。

## ユドナリウムって何？

Web ブラウザ上で動くアナログゲーム支援ツール（Virtual Tabletop）です。
3D 表現ができるのが特徴で、ボードゲームやTTRPG、マーダーミステリーなどを遊ぶ際に使われます。
主に日本では、ユドナリウム上で作成したセーブデータを共有・配布されており、それを読み込むことで様々なゲームが遊ばれています。

## Udonarium Resonite Importer の使い方

### 1. ダウンロード

[Booth](https://trivr.booth.pm/items/8034445) あるいは [GitHub](https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/latest) でアプリのzipをダウンロードしてください。
zipは任意の場所に展開してください。

### 2. Resonite を起動して ResoniteLink を有効化

Resonite を起動してください。インストールがまだの人は Steam からインストールしてください。
https://store.steampowered.com/app/2519830

Resonite を起動後、新規ワールドを作成してください。その後、ダッシュメニューのセッションタブを開きます。
「ResoniteLinkを有効化」ボタンを押してください。
「Resoniteリンクがポート [数字] で動作中」と表示されたら次に進みます。

### 3. アプリを起動

1.でダウンロードしたzipの中にある Udonarium Resonite Importer を起動してください。
インポートしたいユドナリウムのセーブデータと、2.で表示されているポート番号を入力します。
必要であれば高度なオプションを設定してください。

Resoniteにインポート！ボタンを押すと、Resoniteに盤面が再現されます。

![GUI版の使用イメージ](images/gui.ja.png)

## 細かい挙動

インポートしたオブジェクトは RootSlot 直下に生成されます。Slot名は「Udonarium Import - [zipファイル名]」になります。
インポートしたオブジェクトのルートには `udonarium-resonite-importer:root` のタグが付きます。 RootSlot 直下にこのタグを持つスロットがあれば、インポート実行時にそのスロットを削除し、同じ Transform (位置、回転、大きさ) でインポートしたスロットを配置します。

## 高度なオプション

### ルートにGrabbableを付ける

初期値：オフ
インポートしたオブジェクトの盤面を持てるようにします。

### ルートスケール

初期値：1(m)
インポートしたオブジェクトのルートのスケールを変更します。前述のタグを持つスロットがある場合は、そのスケールを優先するため、この設定は使われません。
初期値は1マス1mになるように大きさを変換しています。

### テーブルと固定した地形にコライダーを付ける

初期値：オフ
盤面と固定した地形にCharacterColliderを付け、上に乗ったり壁の中に入れないようにします。
固定されていない地形には設定しません。

### 半透明画像の描画方法

初期値：Cutout
使用されている画像に半透明要素があった場合に、その画像のマテリアルを描画する際の BlendMode を設定できます。
ルーム内の全ての半透明画像に対して一括で設定します。個別に設定することはできません。

Cutout：半透明部分を、透明度が一定以上であれば描画しません。背景を透明に切り抜いている画像などに使うと良いでしょう。
Alpha：透明度に応じて描画します。この方式の場合、複数のAlphaオブジェクトが重なったときに、後ろに隠れたモノが消えてしまう挙動になってしまいます。消えてほしくない場合はCutoutを使ってください。

### SimpleAvatarProtectionを付ける

初期値：オン
自分以外が保存できないように SimpleAvatarProtection を付けます。誰でも保存していいものをインポートするときのみオフにしてください。

### ResoniteLinkホスト

初期値：localhost
ヘッドレスセッションなどで ResoniteLink が使える場合に使えるかもしれない設定項目です。動作確認はしていません。

## MMC26 エントリー

このツールは [Metaverse Maker Competition 2026](https://youtu.be/MHxobH-TkKc) にエントリーした作品です。
カテゴリ：other tau
ワールド： [[MMC26] Udonarium Resonite Importer - Resonite](https://go.resonite.com/world/G-1Nc5BgekFJQ/R-b0e1dc28-fec9-48cb-8fee-58459f3f637a)

## クレジット

開発者： yoshi1123\_
テスター： ankou, ifura, KTY, usaturn, Karabina
フィードバック： lill

使用アセット：

- ユドナリウム公式アセット: https://github.com/TK11235/udonarium

使用ツール：

- Vibe Coding & 翻訳: Claude Code, GitHub Copilot, ChatGPT/Codex
- 動画編集: Davinci Resolve

動画内で使用しているアセット

- BGM：[魔王魂](https://maou.audio/bgm_cyber13/) - CC BY 4.0 https://creativecommons.org/licenses/by/4.0/
- ユドナ用ルームデータ（テーブル数４７） | ouma https://ouma.booth.pm/items/5499018
- 【D&D5版】ダンジョン＆ドラゴンズ第5版シナリオ「囚われの花嫁」 | しらたき置き場 https://nabenosoko.booth.pm/items/3694104
