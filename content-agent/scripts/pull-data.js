#!/usr/bin/env node
// Pull real Instagram data via Apify's instagram-scraper and save dashboard/data.json.
//
// Runs three actor jobs concurrently:
//   1. Profile details for me + competitors (followers, post counts)
//   2. My FULL post history (resultsType: "posts", high limit — never latestPosts)
//   3. Competitors' recent posts
// Then ranks every post by views (video plays; likes for image posts) and writes
// dashboard/data.json for the dashboard + Telegram digest.
//
// Usage: node scripts/pull-data.js
// Needs APIFY_TOKEN in content-agent/.env

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ME = "all.purpose.nutrition";
const COMPETITORS = ["palomahealth", "thyroidnation", "izabellawentzpharmd", "lisha_thyroid_rd"];
const MY_POSTS_LIMIT = 1000; // full history — her account is well under this
const COMPETITOR_POSTS_LIMIT = 25; // recent posts per competitor

// --- tiny .env reader (no dependencies) ---
function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) throw new Error(".env not found at " + envPath);
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();
const TOKEN = process.env.APIFY_TOKEN;
if (!TOKEN) throw new Error("APIFY_TOKEN missing from .env");

const API = "https://api.apify.com/v2";
const ACTOR = "apify~instagram-scraper";
const profileUrl = (h) => `https://www.instagram.com/${h}/`;

async function api(pathname, opts = {}) {
  const url = `${API}${pathname}${pathname.includes("?") ? "&" : "?"}token=${TOKEN}`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Apify ${res.status} on ${pathname}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function runActor(label, input) {
  const { data: run } = await api(`/acts/${ACTOR}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  process.stdout.write(`[${label}] started run ${run.id}\n`);
  let status = run.status;
  const started = Date.now();
  while (["READY", "RUNNING"].includes(status)) {
    if (Date.now() - started > 20 * 60 * 1000) throw new Error(`[${label}] timed out after 20 min`);
    const { data } = await api(`/actor-runs/${run.id}?waitForFinish=30`);
    status = data.status;
    process.stdout.write(`[${label}] ${status.toLowerCase()}...\n`);
  }
  if (status !== "SUCCEEDED") throw new Error(`[${label}] run ended ${status}`);
  const items = await (await fetch(`${API}/actor-runs/${run.id}/dataset/items?token=${TOKEN}&clean=true`)).json();
  process.stdout.write(`[${label}] done — ${items.length} items\n`);
  return items;
}

// views for videos/reels; images have none, so likes carry their rank
const viewsOf = (p) => p.videoPlayCount ?? p.videoViewCount ?? null;
const rankKey = (p) => viewsOf(p) ?? p.likesCount ?? 0;

function slimPost(p) {
  return {
    owner: p.ownerUsername,
    shortCode: p.shortCode,
    url: p.url,
    type: p.type, // Video | Image | Sidecar
    productType: p.productType || null, // clips = Reel
    caption: (p.caption || "").slice(0, 300),
    hook: (p.caption || "").split("\n")[0].slice(0, 120),
    views: viewsOf(p),
    likes: p.likesCount ?? null,
    comments: p.commentsCount ?? null,
    timestamp: p.timestamp,
    displayUrl: p.displayUrl || null,
  };
}

(async () => {
  const [details, myPosts, compPosts] = await Promise.all([
    runActor("profiles", {
      directUrls: [ME, ...COMPETITORS].map(profileUrl),
      resultsType: "details",
      resultsLimit: 1,
    }),
    runActor("my-posts", {
      directUrls: [profileUrl(ME)],
      resultsType: "posts",
      resultsLimit: MY_POSTS_LIMIT,
    }),
    runActor("competitor-posts", {
      directUrls: COMPETITORS.map(profileUrl),
      resultsType: "posts",
      resultsLimit: COMPETITOR_POSTS_LIMIT,
    }),
  ]);

  const profiles = Object.fromEntries(
    details.map((d) => [d.username, {
      username: d.username,
      fullName: d.fullName,
      followers: d.followersCount,
      following: d.followsCount,
      postsCount: d.postsCount,
      bio: d.biography,
      profilePic: d.profilePicUrlHD || d.profilePicUrl || null,
    }])
  );
  const me = profiles[ME];
  if (!me) throw new Error(`Profile details for ${ME} missing — got: ${Object.keys(profiles).join(", ")}`);

  const mine = myPosts.filter((p) => !p.error).sort((a, b) => rankKey(b) - rankKey(a)).map(slimPost);
  const totalViews = mine.reduce((s, p) => s + (p.views || 0), 0);
  const totalLikes = mine.reduce((s, p) => s + (p.likes || 0), 0);
  const totalComments = mine.reduce((s, p) => s + (p.comments || 0), 0);
  const engagementRate = me.followers ? ((totalLikes + totalComments) / mine.length / me.followers) * 100 : null;

  const competitors = COMPETITORS.map((h) => ({
    ...(profiles[h] || { username: h }),
    recentPosts: compPosts.filter((p) => !p.error && p.ownerUsername === h)
      .sort((a, b) => rankKey(b) - rankKey(a)).map(slimPost),
  }));

  const data = {
    generatedAt: new Date().toISOString(),
    me,
    stats: {
      followers: me.followers,
      postsAnalyzed: mine.length,
      totalViews,
      totalLikes,
      totalComments,
      avgEngagementRatePct: engagementRate ? +engagementRate.toFixed(2) : null,
    },
    topPosts: mine.slice(0, 50),
    allPosts: mine,
    competitors,
  };

  const out = path.join(ROOT, "dashboard", "data.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(data, null, 2));

  // --- human-readable proof ---
  const fmt = (n) => (n == null ? "—" : n.toLocaleString("en-US"));
  console.log(`\n@${ME} — ${fmt(me.followers)} followers, ${fmt(me.postsCount)} posts (${mine.length} analyzed)`);
  console.log(`Total views across history: ${fmt(totalViews)} | avg engagement: ${engagementRate?.toFixed(2)}%\n`);
  console.log("TOP 10 POSTS OF ALL TIME (by views):");
  mine.slice(0, 10).forEach((p, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${fmt(p.views)} views | ${fmt(p.likes)} likes | ${p.timestamp?.slice(0, 10)} | ${p.hook}`);
  });
  console.log("\nCompetitors:");
  competitors.forEach((c) => {
    const top = c.recentPosts[0];
    console.log(`  @${c.username}: ${fmt(c.followers)} followers — top recent: ${top ? `${fmt(top.views ?? top.likes)} ${top.views != null ? "views" : "likes"} | ${top.hook}` : "no posts pulled"}`);
  });
  console.log(`\nSaved ${out}`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
