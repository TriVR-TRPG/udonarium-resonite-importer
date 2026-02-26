# Udonarium Resonite Importer

このツールは、[ユドナリウム](https://github.com/TK11235/udonarium) のセーブデータを [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) 経由で [Resonite](https://resonite.com/) にインポートするアプリです。
テーブルや地形、マップマスク、キャラクター、カード、ダイスなどの見た目と配置を Resonite 上で再現できます。

## ユドナリウムって何？

Web ブラウザ上で動くアナログゲーム支援ツール（Virtual Tabletop）です。
3D 表現ができるのが特徴で、ボードゲームやTTRPG、マーダーミステリーなどを遊ぶ際に使われます。
日本では、ユドナリウムで作成されたセーブデータの共有・配布が行われており、それらを読み込んでさまざまなゲームが遊ばれています。

## Udonarium Resonite Importer の使い方

### 1. ダウンロード

[Booth](https://trivr.booth.pm/items/8034445) あるいは [GitHub](https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/latest) でアプリの ZIP をダウンロードしてください。
ZIP は任意の場所に展開してください。

### 2. Resonite を起動して ResoniteLink を有効化

Resonite を起動してください。未インストールの場合は Steam からインストールしてください。
https://store.steampowered.com/app/2519830

Resonite を起動したら新規ワールドを作成し、ダッシュメニューのセッションタブを開いてください。
「Resoniteリンクを有効化」ボタンを押してください。
「Resoniteリンクがポート [数字] で動作中」と表示されたら、次に進みます。

### 3. アプリを起動

手順1でダウンロードしたフォルダに含まれる Udonarium Resonite Importer を起動してください。
インポートしたいユドナリウムのセーブデータと、手順2で表示されたポート番号を入力してください。
必要であれば高度なオプションを設定してください。

「Resoniteにインポート」ボタンを押すと、Resonite に盤面が再現されます。

![GUI版の使用イメージ](images/gui.ja.png)

## 細かい挙動

インポートしたオブジェクトは RootSlot 直下に生成されます。スロット名は「Udonarium Import - [ZIPファイル名]」になります。
インポートしたオブジェクトのルートには `udonarium-resonite-importer:root` タグが付きます。RootSlot 直下に同じタグを持つスロットがある場合、インポート時にそのスロットを削除し、同じ Transform（位置・回転・大きさ）で新しいスロットを配置します。

## 高度なオプション

### ルートにGrabbableを付ける

初期値：オフ
インポートした盤面全体を掴めるようにします。

### ルートスケール

初期値：1 (m)
インポートしたオブジェクトのルートスケールを変更します。前述のタグを持つスロットがある場合は、そのスケールが優先されるため、この設定は適用されません。
初期状態では、1マス=1m になるようにサイズ変換されます。

### テーブルと固定された地形にコライダーを付ける

初期値：オフ
盤面と固定された地形に CharacterCollider を付け、乗れるようにしつつ壁のすり抜けを防ぎます。
固定されていない地形には設定しません。

### 半透明画像の描画方法

初期値：Cutout
半透明を含む画像がある場合、その画像のマテリアル描画に使う BlendMode を設定できます。
ルーム内のすべての半透明画像に一括適用されます。個別設定はできません。

Cutout：透明度がしきい値未満の部分を描画しません。背景を切り抜いた画像に向いています。
Alpha：透明度に応じて描画します。複数の Alpha オブジェクトが重なると、奥側の表示が欠ける場合があります。これを避けたい場合は Cutout を使ってください。

### SimpleAvatarProtectionを付ける

初期値：オン
自分以外が保存できないように SimpleAvatarProtection を付けます。誰でも保存してよいものをインポートする場合のみオフにしてください。

### ResoniteLinkホスト

初期値：localhost
ヘッドレスセッションなど、localhost 以外の ResoniteLink を使う場合に指定する項目です。なお、動作確認はしていません。

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
