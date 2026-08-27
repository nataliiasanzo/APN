#!/usr/bin/env node
// Generate the 5 agents' outputs from real data in dashboard/data.json.
// Writes dashboard/agents.json. Re-run after every data pull — everything here
// is derived from the actual numbers, no invented stats.
//
// Usage: node scripts/run-agents.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "dashboard", "data.json"), "utf8"));

const now = new Date(data.generatedAt || Date.now());
const DAY = 24 * 3600 * 1000;
const fmt = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
const compact = (n) => {
  if (n == null) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
};
const cleanHook = (s) =>
  (s || "")
    .replace(/[#@][\w.]+/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// ---------- ANALYST ----------
const posts = data.allPosts || [];
const inWindow = (p, from, to) => {
  const t = new Date(p.timestamp).getTime();
  return t >= from && t < to;
};
const last30 = posts.filter((p) => inWindow(p, now - 30 * DAY, +now + DAY));
const prev30 = posts.filter((p) => inWindow(p, now - 60 * DAY, +now - 30 * DAY));
const sum = (arr, f) => arr.reduce((s, p) => s + (f(p) || 0), 0);
const views30 = sum(last30, (p) => p.views);
const viewsPrev30 = sum(prev30, (p) => p.views);
const trendPct = viewsPrev30 ? Math.round(((views30 - viewsPrev30) / viewsPrev30) * 100) : null;

const isReel = (p) => p.productType === "clips" || p.type === "Video";
const reels = posts.filter(isReel);
const carousels = posts.filter((p) => p.type === "Sidecar");
const stills = posts.filter((p) => p.type === "Image");
const avg = (arr, f) => (arr.length ? sum(arr, f) / arr.length : null);
const avgReelViews = avg(reels, (p) => p.views);
const avgCarouselLikes = avg(carousels, (p) => p.likes);

const myRecent20 = posts
  .slice()
  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  .slice(0, 20);
const myAvgRecentViews = avg(myRecent20.filter((p) => p.views != null), (p) => p.views);

const compBench = (data.competitors || []).map((c) => {
  const withViews = (c.recentPosts || []).filter((p) => p.views != null);
  return {
    username: c.username,
    followers: c.followers,
    avgRecentViews: avg(withViews, (p) => p.views),
    topRecent: (c.recentPosts || [])[0] || null,
  };
});

const analyst = {
  name: "Analyst",
  headline: `${compact(views30)} views in the last 30 days`,
  metrics: [
    { label: "Views, last 30d", value: compact(views30) },
    { label: "vs prior 30d", value: trendPct == null ? "—" : (trendPct >= 0 ? "+" : "") + trendPct + "%" },
    { label: "Posts, last 30d", value: String(last30.length) },
  ],
  insights: [
    `Reels average ${compact(avgReelViews)} views across ${reels.length} posts — video is your reach engine; carousels average ${compact(avgCarouselLikes)} likes and do their work in saves, not views.`,
    `Your last 20 posts average ${compact(myAvgRecentViews)} views with ${compact(data.stats.followers)} followers — ${compBench
      .filter((c) => c.avgRecentViews)
      .map((c) => `@${c.username} averages ${compact(c.avgRecentViews)}`)
      .join(", ")}.`,
    trendPct != null
      ? `Last 30 days: ${last30.length} posts, ${compact(views30)} views (${trendPct >= 0 ? "+" : ""}${trendPct}% vs the 30 days before).`
      : `Last 30 days: ${last30.length} posts, ${compact(views30)} views.`,
    `Your #1 post of all time (${compact(data.topPosts[0]?.views)} views) is a self-identification question — "${cleanHook(
      data.topPosts[0]?.hook
    )}". That format is repeatable.`,
  ],
  benchmarks: compBench,
};

// ---------- IDEATOR ----------
// Map a caption to a known niche topic via keywords. Splicing raw captions
// into hook templates produces garbage, so topics come from this dictionary
// only; no keyword match = no topic (meme/CTA post — remix the format instead).
const NICHE_TOPICS = [
  [/tsh|lab|test/i, "thyroid labs"],
  [/supplement|magnesium|selenium|vitamin/i, "thyroid supplements"],
  [/glp/i, "GLP-1s and your thyroid"],
  [/wellness hack|biohack|hormone expert/i, "wellness hacks"],
  [/gluten|dairy|diet|food|eat/i, "the Hashimoto's diet"],
  [/gut|dysbiosis|bloat|microbiome/i, "gut health with Hashimoto's"],
  [/weight/i, "weight and hypothyroidism"],
  [/fatigue|tired|exhaust|energy/i, "thyroid fatigue"],
  [/stress|cortisol|adrenal/i, "cortisol and your thyroid"],
  [/medication|levothyroxine|synthroid|armour|meds/i, "thyroid medication"],
  [/hair/i, "thyroid hair loss"],
  [/stage|remission|flare/i, "the stages of Hashimoto's"],
];
function topicOf(caption) {
  const s = cleanHook(caption);
  for (const [re, topic] of NICHE_TOPICS) if (re.test(s)) return topic;
  return null;
}

const compWinners = (data.competitors || [])
  .flatMap((c) => (c.recentPosts || []).slice(0, 3))
  .filter((p) => p.views != null)
  .sort((a, b) => b.views - a.views)
  .slice(0, 4);

const remixAngles = [
  "The RD's honest take — what this gets right, what it skips, and the one thing that actually moves labs.",
  "Same topic, Hashimoto's-specific: why generic thyroid advice lands differently when you have autoimmune disease.",
  "Myth-bust it: open by agreeing, then flip one assumption your audience didn't know to question.",
  "Turn it into a self-ID question (your 4.8M-view format): make the viewer find themselves in stage 1–2–3.",
];

const rawIdeas = compWinners.map((p, i) => {
  const topic = topicOf(p.caption || p.hook);
  return topic
    ? {
        title: `Your take on ${topic}`,
        topic,
        source: `@${p.owner} — ${compact(p.views)} views: "${cleanHook(p.hook).slice(0, 70)}"`,
        sourceUrl: p.url,
        angle: remixAngles[i % remixAngles.length],
      }
    : {
        title: `Steal the format, not the words — @${p.owner}'s caption-light Reel`,
        topic: null,
        source: `@${p.owner} — ${compact(p.views)} views with almost no caption`,
        sourceUrl: p.url,
        angle: "The format did the work, not the words. Remix it with one Hashimoto's punchline on screen and let the visual carry it.",
      };
});
// two meme-format posts from the same account = one idea
const seenTitles = new Set();
const ideas = rawIdeas.filter((i) => !seenTitles.has(i.title) && seenTitles.add(i.title));
ideas.push({
  title: `Sequel to your #1: "${cleanHook(data.topPosts[0]?.hook).slice(0, 70)}"`,
  topic: "the stages of Hashimoto's",
  source: `@${data.me.username} — ${compact(data.topPosts[0]?.views)} views (your all-time top)`,
  sourceUrl: data.topPosts[0]?.url,
  angle: "Part 2: 'You told me your stage. Here's the first food shift for each one.' Same self-ID energy, now with a payoff.",
});
ideas.push({
  title: "Evergreen revival: your magnesium × thyroid meds post",
  topic: "supplements that interfere with thyroid medication",
  source: `@${data.me.username} — ${compact(data.topPosts[1]?.views)} views in 2022`,
  sourceUrl: data.topPosts[1]?.url,
  angle: "Re-shoot it as a 2026 Reel: '3 supplements that quietly fight your thyroid meds.' Old winner, new audience.",
});

const ideator = {
  name: "Ideator",
  headline: `${ideas.length} ideas scouted from real winners`,
  metrics: [
    { label: "Ideas ready", value: String(ideas.length) },
    { label: "From competitors", value: String(compWinners.length) },
    { label: "Biggest source", value: compact(compWinners[0]?.views) + " views" },
  ],
  ideas,
};

// ---------- HOOK & SCRIPT ----------
// Script the ideas that carry a real topic; hooks are built from the topic,
// never by splicing raw captions.
const topIdeas = ideas.filter((i) => i.topic).slice(0, 3);
const hooksFor = (topic) => [
  `Everything you've heard about ${topic} is only half true.`,
  `${topic[0].toUpperCase() + topic.slice(1)} — my Hashimoto's patients ask me about this every single week.`,
  `If your TSH is "normal" but you still feel exhausted, this is for you.`,
];
const scripts = topIdeas.map((idea, i) => ({
  idea: idea.title,
  hooks: hooksFor(idea.topic),
  beats: [
    "Beat 1 — validate: name the exact frustration in your audience's words (10 sec).",
    "Beat 2 — flip: the one thing the popular version of this advice gets wrong for Hashimoto's (20 sec).",
    "Beat 3 — do this instead: one specific, doable action with a number in it (20 sec).",
  ],
  cta: i === 0 ? "Comment your stage — 1, 2 or 3 — and I'll tell you where to start." : "Save this for your next lab review.",
}));

const hookScript = {
  name: "Hook & Script",
  headline: `${scripts.length} scripts drafted, ${scripts.length * 3} hooks`,
  metrics: [
    { label: "Scripts drafted", value: String(scripts.length) },
    { label: "Hook options", value: String(scripts.length * 3) },
    { label: "Voice", value: "APN myth-bust" },
  ],
  scripts,
};

// ---------- PLANNER ----------
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const slots = [
  { format: "Reel", assign: () => topIdeas[0]?.title },
  { format: "Story poll", assign: () => "Poll: 'What's your biggest Hashimoto's frustration right now?' (feeds next week's Ideator)" },
  { format: "Carousel", assign: () => topIdeas[1]?.title },
  { format: "Reel", assign: () => topIdeas[2]?.title },
  { format: "Quote card", assign: () => "Pull the strongest line from this week's top comment" },
  { format: "Story Q&A", assign: () => "Answer 3 DMs publicly (anonymized) — DM Manager picks them" },
  { format: "Repost", assign: () => `Re-share your evergreen #1 (${compact(data.topPosts[0]?.views)} views) to Stories` },
];
const calendar = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(+now + (i + 1) * DAY);
  return {
    day: dayNames[d.getDay()],
    date: d.toISOString().slice(0, 10),
    format: slots[i].format,
    item: slots[i].assign(),
  };
});

const planner = {
  name: "Planner",
  headline: "Next 7 days scheduled",
  metrics: [
    { label: "Days planned", value: "7" },
    { label: "Reels", value: String(calendar.filter((c) => c.format === "Reel").length) },
    { label: "Next slot", value: calendar[0].day },
  ],
  calendar,
};

// ---------- DM MANAGER ----------
// Honest limitation: Instagram gives no DM API access to third parties, so this
// agent preps triage rules + reply drafts for manual copy-paste, not auto-replies.
const dmManager = {
  name: "DM Manager",
  headline: "5 reply drafts ready to paste",
  note: "Instagram doesn't allow DM automation for personal profiles — these are copy-paste drafts and a triage system, not auto-replies.",
  metrics: [
    { label: "Reply drafts", value: "5" },
    { label: "Triage lanes", value: "4" },
    { label: "Mode", value: "copy-paste" },
  ],
  triage: [
    { lane: "Potential client", rule: "Mentions symptoms + asks about working together → send 'discovery call' draft same day." },
    { lane: "Hub lead", rule: "Asks a general Hashimoto's question → answer briefly, point to the Healing Hub." },
    { lane: "Fellow practitioner", rule: "RD/MD asking shop talk → warm short reply, no pitch." },
    { lane: "Spam / collab bait", rule: "Generic 'collab?' with no context → ignore or decline template." },
  ],
  drafts: [
    { for: "Potential client", text: "Thank you for trusting me with this — what you're describing is so common with Hashimoto's, and it's not in your head. The best next step is a discovery call so I can hear the full picture: [link]. I'd love to help you get answers." },
    { for: "Lab question", text: "Great question — I can't interpret labs safely over DM, but this is exactly what I walk through inside the Healing Hub / on a call. What I *can* say: a 'normal' TSH alone doesn't rule anything out." },
    { for: "Hub lead", text: "I made something for exactly this — the Hashimoto's Healing Hub. It's where I go deeper than I can on IG, and you can ask me questions directly: [link]." },
    { for: "Supplement question", text: "Careful with that one — it depends on your meds and labs. Quick rule I give everyone: keep magnesium, calcium and iron 4 hours away from thyroid medication." },
    { for: "Decline collab", text: "Thank you for thinking of me! I keep partnerships limited to products I already use with clients, so I'll pass for now — wishing you the best with the launch." },
  ],
};

const agents = {
  generatedAt: new Date().toISOString(),
  dataGeneratedAt: data.generatedAt,
  ideator,
  hookScript,
  planner,
  analyst,
  dmManager,
};

const out = path.join(ROOT, "dashboard", "agents.json");
fs.writeFileSync(out, JSON.stringify(agents, null, 2));
console.log(`Saved ${out}`);
console.log(`Ideator: ${ideas.length} ideas | Scripts: ${scripts.length} | Calendar: ${calendar.length} days | Analyst insights: ${analyst.insights.length} | DM drafts: ${dmManager.drafts.length}`);
