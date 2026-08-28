#!/usr/bin/env node
// Send the content digest to Telegram: real stats + top idea + next planned slot.
//
// Needs in content-agent/.env:
//   TELEGRAM_BOT_TOKEN=...   (from @BotFather — never commit or print it)
//   TELEGRAM_CHAT_ID=...     (auto-discovered on first run: message your bot
//                             once, run this script, and the id is saved to .env)
//
// Usage: node scripts/send-digest.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) throw new Error(".env not found at " + ENV_PATH);
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing from .env");
const API = `https://api.telegram.org/bot${TOKEN}`;

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description || res.status}`);
  return json.result;
}

async function chatId() {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  const updates = await tg("getUpdates");
  const msg = updates.reverse().find((u) => u.message?.chat?.id);
  if (!msg) throw new Error("No chat found — open Telegram, send your bot any message, then re-run.");
  const id = String(msg.message.chat.id);
  fs.appendFileSync(ENV_PATH, `TELEGRAM_CHAT_ID=${id}\n`);
  console.log("Discovered chat id and saved it to .env");
  return id;
}

const compact = (n) => {
  if (n == null) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
};
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "dashboard", "data.json"), "utf8"));
  const agents = JSON.parse(fs.readFileSync(path.join(ROOT, "dashboard", "agents.json"), "utf8"));
  const s = data.stats;
  const topIdea = agents.ideator.ideas[0];
  const nextSlot = agents.planner.calendar[0];
  const hook = agents.hookScript.scripts[0]?.hooks[0];

  const text = [
    `<b>📊 APN Content Agent — digest</b>`,
    ``,
    `👥 <b>${s.followers.toLocaleString("en-US")}</b> followers`,
    `📈 Last 30 days: <b>${esc(agents.analyst.metrics[0].value)}</b> views (${esc(agents.analyst.metrics[1].value)} vs prior 30)`,
    `🏆 Top post all-time: <b>${compact(data.topPosts[0]?.views)}</b> views`,
    `❤️ Avg engagement: <b>${s.avgEngagementRatePct}%</b>`,
    ``,
    `💡 <b>Top idea:</b> ${esc(topIdea?.title)}`,
    `<i>${esc(topIdea?.angle)}</i>`,
    hook ? `\n✍️ <b>Hook to try:</b> "${esc(hook)}"` : "",
    ``,
    `🗓️ <b>Next up (${esc(nextSlot?.day)}):</b> ${esc(nextSlot?.format)} — ${esc(nextSlot?.item)}`,
    ``,
    process.env.PULL_FAILED
      ? `⚠️ This week's data pull failed (likely Apify quota) — numbers are from the last successful pull.`
      : "",
    `Data pulled ${new Date(data.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${s.postsAnalyzed} posts analyzed`,
  ]
    .filter((l) => l !== false && l !== "" || l === "")
    .join("\n");

  const id = await chatId();
  await tg("sendMessage", { chat_id: id, text, parse_mode: "HTML", disable_web_page_preview: true });
  console.log("Digest sent to Telegram ✓");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
