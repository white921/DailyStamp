# DailyStamp

Discord から毎日の習慣を記録し、ブラウザ上のカレンダーにスタンプを押せる Bot です。

バックエンドは Node/Express + `discord.js`、フロントエンドは React + Vite で構成しています。

## できること

- `/setup-panel` で公開パネルを設置
- ユーザーはパネルのボタンから本人専用の署名付きリンクを受け取る
- ブラウザ画面で日付と習慣を選んで `STAMP` を押す
- その月のスタンプ状況を習慣ごとのカレンダーで確認する

## セットアップ

```bash
npm install
cp .env.example .env
npm run build
```

MySQL に `daily_stamp` のようなデータベースを先に作成しておきます。

`.env` を埋めたら、まずコマンド登録を行います。

```bash
npm run register
```

その後に起動します。

```bash
npm start
```

アプリ本体を起動する前に、React フロントエンドを `npm run build` でビルドしてください。

UI を触りながら開発したいときは、別ターミナルで次を並行実行します。

```bash
npm run dev:server
npm run dev
```

UI だけ確認したいときは `.env` で `DISCORD_BOT_DISABLED=true` にすると、Bot 接続なしで Web API だけ起動できます。

## 必須環境変数

- `DISCORD_TOKEN`: Bot トークン
- `DISCORD_CLIENT_ID`: Discord Application の Client ID
- `DISCORD_GUILD_IDS`: コマンド登録先サーバー ID をカンマ区切りで指定
- `DISCORD_BOT_DISABLED`: `true` なら Discord 接続をスキップ
- `APP_BASE_URL`: Web 画面の公開 URL
- `PORT`: Web サーバー待受ポート
- `MYSQL_HOST`: MySQL ホスト
- `MYSQL_PORT`: MySQL ポート
- `MYSQL_USER`: MySQL ユーザー
- `MYSQL_PASSWORD`: MySQL パスワード
- `MYSQL_DATABASE`: 使用するデータベース名
- `LINK_TOKEN_SECRET`: Web リンク署名用シークレット

## Discord コマンド

- `/setup-panel`

## デプロイ

- Railway を想定しています
- 公開 URL を `APP_BASE_URL` に設定してください
- MySQL は Railway MySQL か外部 MySQL を接続してください
- 初回デプロイ前に `LINK_TOKEN_SECRET` を十分長いランダム文字列にしてください

## よくある詰まりどころ

- パネル経由で配るリンク先が localhost のままだと、他端末からは開けません
- コマンド説明や名前を変えたら `npm run register` が必要です
- Bot が起動してもコマンドが見えない場合は `DISCORD_GUILD_IDS` を確認してください
- 起動時に DB 接続エラーが出たら `MYSQL_*` と DB 作成有無を確認してください
