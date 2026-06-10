// ============================================================
//  get-refresh-token.js
//  「リフレッシュトークン」を一度だけ取得するための補助スクリプトです。
//  これで得たトークンを GitHub の Secret (GOOGLE_REFRESH_TOKEN) に登録すると、
//  以降は GitHub Actions が自動でデータを取得できるようになります。
//
//  使い方（ターミナルで）:
//    1) Google Cloud で「デスクトップアプリ」のOAuthクライアントを作る
//    2) その client_id / client_secret を環境変数に入れて実行:
//       Mac/Linux:
//         GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node get-refresh-token.js
//       Windows(PowerShell):
//         $env:GOOGLE_CLIENT_ID="xxx"; $env:GOOGLE_CLIENT_SECRET="yyy"; node get-refresh-token.js
//    3) 開いたブラウザでチャンネルのGoogleアカウントを選び「許可」
//    4) ターミナルに表示される refresh token をコピー
// ============================================================
const http = require("http");
const { exec } = require("child_process");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("先に GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を環境変数に設定してください。");
  process.exit(1);
}

const PORT = 8080;
const REDIRECT = "http://localhost:" + PORT;
const SCOPE = [
  "https://www.googleapis.com/auth/yt-analytics.readonly", // 再生時間（Analytics）
  "https://www.googleapis.com/auth/youtube.readonly",       // 登録者・動画など（Data API）
].join(" ");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  const code = u.searchParams.get("code");
  if (!code) { res.end("認可コードが受け取れませんでした。"); return; }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const data = await r.json();
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  if (data.refresh_token) {
    res.end("<h2>取得できました。ターミナルに戻ってトークンをコピーしてください。</h2>");
    console.log("\n================ GOOGLE_REFRESH_TOKEN ================\n");
    console.log(data.refresh_token);
    console.log("\n=====================================================\n");
    console.log("この値を GitHub の Secret 'GOOGLE_REFRESH_TOKEN' に登録してください。");
  } else {
    res.end("<pre>" + JSON.stringify(data, null, 2) + "</pre>");
    console.error("refresh_token が返りませんでした:", data);
  }
  setTimeout(() => server.close(), 500);
});

server.listen(PORT, () => {
  console.log("ブラウザで次のURLを開いて許可してください（自動で開かない場合は手動で）:\n");
  console.log(authUrl + "\n");
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(opener + ' "' + authUrl + '"', () => {});
});
