TESTING


KAWAIKARA

GO!GO! ハングル README

私は友達と一緒にDiscordで配信を楽しんでいます。そして、そのサービスは私にとても合っています。しかし、いくつかの問題があります。Discordでは単一のプログラムウィンドウしか取得できず、多くのストリーミングサービスはDRMを使用しています。ブラウザを使ってOTTストリーミングを視聴することも可能ですが、ブラウザでの視聴は画面スペースを無駄にしてしまいます。（フルスクリーンではなく、アドレスバーやスクロールバーなどのUIを削除したいだけです。）
そのため、私は超コンパクトで最適なOTTストリーミングビューアを開発することにしました。

特徴

YouTube用広告ブロッカー

PiP（ピクチャー・イン・ピクチャー）

ユーザー固定ウィンドウでのフルスクリーン表示

Chrome拡張機能（現在開発中）

対応サービス

OTT

Netflix

Lafetel

YouTube

Disney Plus

Amazon Prime

Wavve

Watcha

Coupang Play

Tving

音楽

Apple Music（接続問題あり）

ストリーミング

Chzzk

Twitch

DiscordでのRich Presence

DRMの問題

はい、Electron はライセンス上の理由により CDM をサポートしていません。そのため、Electron フレームワークを直接使用することはできません。DRMを使用する製品をサポートするために、CastLabs のElectronフォークを使用しました。

使用例

使い方

リリース版をダウンロード

altキーを押してメニューバーを表示できます。

自分のOTTビューアを構築する

これは簡単な方法です。私の手順に従ってください。Node.js の環境を準備する必要があります。nvm（Node Version Manager）と yarn の使用をおすすめします。

開始する前に、DRM対応のために CastLabs に登録する必要があります。

conda create -n test_env python=3.10
conda activate test_env
pip install castlabs_evs

# CastLabsアカウントの作成
python -m castlabs_evs.account signup

# サインアップ後、コンピュータでログイン
python -m castlabs_evs.account reauth -A ${your_account} -P ${your_password}

Discord Rich Presence を有効にする

リポジトリのルートディレクトリに .env ファイルを作成してください。

DISCORD_APP_ID=${ここにApp IDを入力}
DISCORD_PUB_KEY=${ここにApp Public Keyを入力}

自分のリポジトリで公開する

このスクリプトはPowerShell上で実行してください。（証明書生成機能がPowerShellの関数を使用しています。）

yarn install # package.json のすべての依存関係をインストール
yarn make-cert # 自己署名証明書を作成（公式証明書は高額...）
yarn build # これで完了！

