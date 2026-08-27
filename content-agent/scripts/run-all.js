#!/usr/bin/env node
// One-command full cycle: pull real data → regenerate the 5 agents' output →
// send the Telegram digest. The dashboard reads the refreshed JSON on next load.
//
// Usage: node scripts/run-all.js        (add --skip-pull to reuse existing data.json)

const { spawnSync } = require("child_process");
const path = require("path");

const steps = [
  ...(process.argv.includes("--skip-pull") ? [] : [["pull-data.js", "Pulling Instagram data via Apify"]]),
  ["run-agents.js", "Regenerating the 5 agents' output"],
  ["send-digest.js", "Sending Telegram digest"],
];

for (const [script, label] of steps) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync("node", [path.join(__dirname, script)], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nStopped: ${script} failed (exit ${r.status}).`);
    process.exit(r.status || 1);
  }
}
console.log("\nFull cycle complete ✓");
