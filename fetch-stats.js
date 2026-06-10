// ============================================================
//  fetch-stats.js
//  毎日 GitHub Actions から実行され、以下を取得して data/ に保存します。
//   - 登録者数・総再生回数・動画数（YouTube Data API）
//   - 直近の動画（サムネ・再生・高評価・コメント）
//   - 直近365日の総再生時間＝収益化の4,000時間に対応（YouTube Analytics API）
//  外部ライブラリは不要です（Node.js 18以降の標準機能だけで動きます）。
//
//  必要な環境変数（GitHubのSecretsから渡されます）:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN
//  任意: SUBS_GOAL（既定1000） / HOURS_GOAL（既定4000）
// ============================================================
const fs = require("fs");
const path = require("path");

// リフレッシュトークンを使って、その都度アクセストークンを取得
async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("アクセストークン取得に失敗: " + JSON.stringify(data));
  return data.access_token;
}

async function api(url, token) {
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const data = await res.json();
  if (!res.ok) throw new Error("APIエラー " + url + " : " + JSON.stringify(data));
  return data;
}

// 日本時間の YYYY-MM-DD
function jstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const token = await getAccessToken();

  // ---- チャンネル情報（自分のチャンネル）----
  const chRes = await api(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
    token
  );
  const ch = chRes.items && chRes.items[0];
  if (!ch) throw new Error("チャンネルが取得できませんでした。認可したアカウントを確認してください。");

  const subs = Number(ch.statistics.subscriberCount || 0);
  const views = Number(ch.statistics.viewCount || 0);
  const videoCount = Number(ch.statistics.videoCount || 0);
  const uploads = ch.contentDetails.relatedPlaylists.uploads;

  // ---- 直近の動画 ----
  let recentVideos = [];
  const pl = await api(
    "https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=8&playlistId=" + uploads,
    token
  );
  const ids = pl.items.map((i) => i.contentDetails.videoId).filter(Boolean).join(",");
  if (ids) {
    const vids = await api(
      "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=" + ids,
      token
    );
    recentVideos = vids.items.map((v) => ({
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      thumb: (v.snippet.thumbnails.medium || v.snippet.thumbnails.default || {}).url || "",
      views: Number(v.statistics.viewCount || 0),
      likes: Number(v.statistics.likeCount || 0),
      comments: Number(v.statistics.commentCount || 0),
    }));
  }

  // ---- 直近365日の総再生時間（収益化の4,000時間に対応する近似値）----
  // ※ YouTube Studio の収益化ページの公式値とは数%ずれることがあります（目安として使用）
  let hours = 0;
  try {
    const a = await api(
      "https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE" +
        "&startDate=" + jstDate(-364) + "&endDate=" + jstDate(0) +
        "&metrics=estimatedMinutesWatched",
      token
    );
    const minutes = a.rows && a.rows[0] ? Number(a.rows[0][0]) : 0;
    hours = Math.round(minutes / 60);
  } catch (e) {
    console.warn("再生時間の取得をスキップしました:", e.message);
  }

  // ---- 保存 ----
  const dataDir = path.join(__dirname, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const date = jstDate(0);
  const histPath = path.join(dataDir, "history.json");
  let history = [];
  try { history = JSON.parse(fs.readFileSync(histPath, "utf8")); } catch {}
  const entry = { date, subs, views, videos: videoCount, hours };
  const last = history[history.length - 1];
  if (!last || last.date !== date) history.push(entry);
  else history[history.length - 1] = entry;
  fs.writeFileSync(histPath, JSON.stringify(history, null, 2));

  const latest = {
    updatedAt: new Date().toISOString(),
    channel: {
      title: ch.snippet.title,
      handle: ch.snippet.customUrl || "",
      thumb: (ch.snippet.thumbnails.medium || ch.snippet.thumbnails.default || {}).url || "",
    },
    subs, views, videos: videoCount, hours,
    subsGoal: Number(process.env.SUBS_GOAL || 1000),
    hoursGoal: Number(process.env.HOURS_GOAL || 4000),
    recentVideos,
  };
  fs.writeFileSync(path.join(dataDir, "latest.json"), JSON.stringify(latest, null, 2));

  console.log("更新完了:", entry);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
