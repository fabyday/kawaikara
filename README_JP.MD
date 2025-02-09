# *カワイイカラ*

<p align="center">
  <img src="./imgs/kawaikara_banner_title3.png" />
</p>
<p align="center">
  <strong>KAWAIKARA</strong>は
  <strong>Electron</strong>をベースにした
  <strong>OTTビューア</strong>です
</p>

  [![read in eng](https://img.shields.io/badge/README-ENGLISH-blue?style=for-the-badge&labelColor=gray)](./README.MD)
 [![read in kor](https://img.shields.io/badge/README-한국어-blue?style=for-the-badge&labelColor=gray)](./README_KR.MD)
  [![read in jp](https://img.shields.io/badge/README-日本語-blue?style=for-the-badge&labelColor=gray)](./README_JP.MD)
 
 
 ![Windows Support](https://img.shields.io/badge/Windows-Supported-0078D4?style=flat&logo=windows)
 ![macOS Support](https://img.shields.io/badge/macOS-Supported-0078D4?style=flat&logo=apple)
 
 [![](https://dcbadge.vercel.app/api/server/JJs974BX45?style=flat)](https://discord.gg/JJs974BX45)
 [![GitHub release](https://img.shields.io/github/release/fabyday/kawaikara.svg?logo=github)](https://github.com/fabyday/kawaikara/releases/1.1.3)
 [![GitHub downloads](https://img.shields.io/github/downloads/fabyday/kawaikara/latest/total.svg?logo=github)](https://github.com/fabyday/kawaikara/releases/latest)
 [![GitHub downloads](https://img.shields.io/github/downloads/fabyday/kawaikara/total.svg?logo=github)](https://github.com/fabyday/kawaikara/releases)
 
 ![build](https://github.com/fabyday/kawaikara/actions/workflows/publish.yaml/badge.svg)
 ![build](https://github.com/fabyday/kawaikara/actions/workflows/build-dev-branch.yaml/badge.svg)


私は友達とディスコードで放送をしたり見るのが好きな人です。しかし、ディスコード放送にはいくつか不便な点があります。ディスコードの放送は一つのプログラムウィンドウしかキャプチャできないことです。OTTをストリーミングするにはブラウザ（Chrome、Firefoxなど）を使う方法もありますが、全画面にしない場合、アドレスバーなどの不要なUIがストリーミング映像の一定の部分を占めてしまいます。体感的にこの領域はかなり大きく、目障りです。中には、友達と一緒にOTTを見ながら作業をしたいという人もいるかもしれません。この小さくて可愛いOTTビューアはそれを可能にします。

## 機能

* ~~**YouTubeの広告ブロック**~~（**ライブラリが非推奨**）
* **PiP**（ピクチャー・イン・ピクチャー）
* **フルスクリーン**から**ユーザー固定ウィンドウ**へ
* ~~**Chrome拡張（現在開発中）**~~（**キャンセル**）
* 広告なしでChzzkを視聴
* Discordで友達と一緒にOTTを視聴


## 対応サービス

- OTT
  - **Netflix**
  - **Lafetel**
  - **YouTube**
  - **Disney+**
  - **Amazon Prime**
  - **Wavve**
  - **Watcha**
  - **Coupang Play**
  - **Tving**
  - **Crunchyroll**
- 音楽
  - **Apple Music**
- ストリーミング
  - **Chzzk**
  - **Twitch**


## Discordでのリッチプレゼンス
<p align="center">
    <img src="imgs/discord_presence.png" width="30%" >
</p>

<p align="center">
     <strong>DiscordでKawaiリッチプレゼンスを使用</strong>
</p>

## DRMの問題

はい、*Electron*はライセンスの関係で_CDM_をサポートしていません。このため、*Electron*フレームワークを直接使用することができませんでした。DRM製品をサポートするために、**castlab**のElectronフォークを使用しました。


# 例
<p align="center">
  <a href="https://youtu.be/NOlJcX-sri8">
    <img src="https://img.youtube.com/vi/NOlJcX-sri8/0.jpg" width="90%" >
  </a>
</p>
<p align="center">
  <strong>Laftel</strong>のストリーミング動画の例 <a href="https://youtu.be/NOlJcX-sri8"><img alt="YouTube Video Views" src="https://img.shields.io/youtube/views/NOlJcX-sri8">
</a>
</p>



<p align="center">  
<br>
  <img src="./imgs/examples.png" align="center" width="45%">  
  <img src="./imgs/example_fullscreen_model.png" align="center" width="45%">  
</p>
<p align="center">
  <strong>Laftel</strong>のデフォルトモード（左）、フルスクリーンモード（右）
</p>

<p align="center">  
  <img src="./imgs/netflix_examples.png" align="center" width="90%">  
</p>

<p align="center">
    <strong>Netflix</strong> Rebel Moon.
</p>

<p align="center">  
  <img src="./imgs/discord_examples1.png" align="center" width="90%">  
</p>
<p align="center">
  <strong>Discordのストリーミング<br></strong>（デフォルトモード）
</p>



<p align="center"> <img src="./imgs/discord_examples2.png" align="center" width="90%"> </p> <p align="center"> <strong>Discordのストリーミング<br></strong>（フルスクリーンモード） </p>


## 使い方

<p align="center">  
  <img src="./imgs/menu.png" align="center" width="60%">  
</p>
<p align="center">
  <strong>Tab</strong>キーを使ってメニューバーを開くことができます。
<br>
</p>

1. ```Tab```キーを押してメニューを開く。
2. 使用したいサービスを選択。
3. サービスを楽しんでください！

* メニューを開く : ```Tab```
* フルスクリーンのオン/オフ : ```Alt+Enter```


## 自分のOTTビューアを作成する

これは簡単な方法です。私の方法に従ってください。*nodejs*の環境を準備する必要があります。*nvm*（Node Version Manager）と*Yarn*の使用をお勧めします。

始める前に、*castlab*に登録する必要があります。この組織（会社？）は*CDM*認証を提供しています。


다음과 같이 일본어로 번역할 수 있습니다:


**conda環境をインストールする**  
*castlab*にサインアップする  

```shell
conda create -n test_env python=3.10
conda activate test_env
pip install castlabs_evs

# castlabsアカウントを作成
python -m castlabs_evs.account signup

# サインアップ後、コンピュータでログイン
python -m castlabs_evs.account reauth -A ${your_account} -P ${your_password}

ok. それで完了です。
```

## Discordリッチプレゼンスを有効にする

ルートリポジトリに ```.env``` ファイルを作成します。

```
DISCORD_APP_ID=${ここにApp IDを記入}
DISCORD_PUB_KEY=${ここにAppの公開鍵を記入}
```



## 自分のリポジトリに公開する

このスクリプトはPowerShellで実行する必要があります。（証明書ファイルを生成する機能はPowerShellの関数を使用します。）

```shell 
yarn install # package.jsonに記載された依存関係をインストール
yarn make-cert # 自己署名証明書を作成（公式の証明書は高すぎる...）
# package_local_only をリネームして 
yarn build # これで完了です、ベイビー。
```





