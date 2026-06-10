# YouTube 収益化ダッシュボード（自動記録・チーム共有版）

3人で運営するチャンネルの「今の状況」と「収益化までの進捗（登録者1,000人・総再生時間4,000時間）」を、
**毎日自動で記録**して、**全員が同じURLで**見られるようにする仕組みです。

## この仕組みでできること

- **① 全自動の記録**：GitHub Actions が毎朝（日本時間6時ごろ）自動で数値を取得。あなたのPCが消えていてもGitHub側で動きます。
- **② 3人で共有**：GitHub Pages で公開URLができ、全員が同じライブ表示・同じ履歴グラフを見られます。
- **③ 再生時間も自動取得**：OAuth認証で YouTube Analytics から直近365日の総再生時間を取得。手入力は不要です。

ダッシュボード（index.html）は、自動生成される `data/latest.json` と `data/history.json` を読むだけ。
**APIキーをページに持たないので、公開しても安全**です。

---

## 全体像（ファイルの役割）

| ファイル | 役割 |
|---|---|
| `index.html` | 公開されるダッシュボード本体。data/ のJSONを読んで表示。 |
| `fetch-stats.js` | 毎日実行され、登録者・再生回数・動画・再生時間を取得して data/ に保存。 |
| `get-refresh-token.js` | 最初に一度だけ実行して「リフレッシュトークン」を取得する補助。 |
| `.github/workflows/update.yml` | 毎朝の自動実行＆手動実行のスケジュール設定。 |
| `data/` | 自動生成されるデータ置き場。 |

---

## セットアップ手順（最初に一度だけ）

> 技術的な手順が続きます。**この作業こそ Claude Code が手伝える部分**です。
> このフォルダで Claude Code を起動し、「README の手順でセットアップを手伝って」と頼むと、
> 下のコマンド実行や git 操作を一緒に進めてくれます（最後の章も参照）。

### 1. このフォルダを GitHub リポジトリにする
GitHub で空のリポジトリを作り、このフォルダの中身をすべて push します。

### 2. Google Cloud 側の準備
1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（既存でも可）。
2. 「APIとサービス」→「ライブラリ」で次の **2つを有効化**：
   - **YouTube Data API v3**
   - **YouTube Analytics API**
3. 「OAuth同意画面」を設定（ユーザー種別は「外部」でOK。テストユーザーに自分のGoogleアカウントを追加）。
4. 「認証情報」→「認証情報を作成」→「OAuthクライアントID」→ 種類は **「デスクトップアプリ」** を選択。
   - 作成後に表示される **クライアントID** と **クライアントシークレット** を控えます。

### 3. リフレッシュトークンを取得（一度だけ）
ターミナルでこのフォルダに移動して実行します（Node.js 18以降が必要）。

**Mac / Linux**
```bash
GOOGLE_CLIENT_ID=あなたのID GOOGLE_CLIENT_SECRET=あなたのシークレット node get-refresh-token.js
```
**Windows (PowerShell)**
```powershell
$env:GOOGLE_CLIENT_ID="あなたのID"; $env:GOOGLE_CLIENT_SECRET="あなたのシークレット"; node get-refresh-token.js
```
ブラウザが開くので、**チャンネルのGoogleアカウント**で「許可」。
ターミナルに表示される長い文字列（リフレッシュトークン）を控えます。

### 4. GitHub に Secrets を3つ登録
リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で登録：

| 名前 | 値 |
|---|---|
| `GOOGLE_CLIENT_ID` | 手順2のクライアントID |
| `GOOGLE_CLIENT_SECRET` | 手順2のクライアントシークレット |
| `GOOGLE_REFRESH_TOKEN` | 手順3で取得したトークン |

### 5. GitHub Pages を有効化
**Settings → Pages** で、Source を「Deploy from a branch」、ブランチを `main`（フォルダは `/root`）に設定。
数分後に公開URL（例: `https://ユーザー名.github.io/リポジトリ名/`）ができます。

### 6. 一度だけ手動実行してデータを作る
**Actions タブ → 「Update YouTube stats」→ Run workflow** を押すと、初回データが生成されます。
完了後に公開URLを開けば、ダッシュボードが表示されます。あとは毎朝自動で更新されます。

---

## 運用メモ

- **更新頻度を変えたい**：`.github/workflows/update.yml` の `cron` を編集（時刻はUTC。日本時間−9時間）。
- **目標を変えたい**：同ファイルの `SUBS_GOAL` / `HOURS_GOAL` を編集。
- **再生時間の数値について**：Analytics API の直近365日の値を使っています。YouTube Studio の収益化ページの公式値とは数%ずれることがあるので、**最終確認は必ず Studio で**行ってください（この画面は日々の伸びを追う目安です）。
- **TVに常時表示**：公開URLをブラウザで全画面（F11）にすればOK。5分ごとに最新を読み直します。
- **秘密情報**：クライアントシークレットとリフレッシュトークンは絶対に公開リポジトリのファイルに直接書かないこと（必ず Secrets に入れる）。

---

## Claude Code への渡し方

このフォルダ（リポジトリ）の中で Claude Code を起動して、こう頼んでください：

```
claude
> このリポジトリを README の手順でセットアップしたい。
> get-refresh-token.js の実行、git の初期化と push、
> その後の動作確認まで、初心者の私に合わせて一つずつ手伝って。
```

Claude Code は実際にコマンドを実行し、エラーが出れば原因を読んで直し、
git の操作（コミット・push）も代わりに進めてくれます。手作業のうち
「Google Cloud の画面操作」と「GitHub の Secrets 登録」だけはあなた自身の操作が必要ですが、
それ以外はほぼ任せられます。
