#!/usr/bin/env node
// One-command full cycle: pull real data → regenerate the 5 agents' output →
// send the Telegram digest. The dashboard reads the refreshed JSON on next load.
//
// Usage: node scripts/run-all.js        (add --skip-pull to reuse existing data.json)

const { spawnSync } = require("child_process");
const path = require("path");

const env = { ...process.env };

// A failed pull (e.g. Apify quota) downgrades the run to cached data instead of
// killing it — the digest still goes out, flagged as stale.
if (!process.argv.includes("--skip-pull")) {
  console.log("\n=== Pulling Instagram data via Apify ===");
  const r = spawnSync("node", [path.join(__dirname, "pull-data.js")], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("\nPull failed — continuing with cached data (digest will say so).");
    env.PULL_FAILED = "1";
  }
}

for (const [script, label] of [
  ["run-agents.js", "Regenerating the 5 agents' output"],
  ["send-digest.js", "Sending Telegram digest"],
]) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync("node", [path.join(__dirname, script)], { stdio: "inherit", env });
  if (r.status !== 0) {
    console.error(`\nStopped: ${script} failed (exit ${r.status}).`);
    process.exit(r.status || 1);
  }
}
console.log("\nFull cycle complete ✓");
