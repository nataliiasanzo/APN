#!/usr/bin/env node
// Build dashboard/artifact.html: the dashboard as one self-contained file
// (data + agents inlined, app.js inlined) for publishing as a claude.ai
// Artifact or opening directly without a server.
//
// Usage: node scripts/build-artifact.js

const fs = require("fs");
const path = require("path");

const DASH = path.join(__dirname, "..", "dashboard");
const read = (f) => fs.readFileSync(path.join(DASH, f), "utf8");

const data = JSON.parse(read("data.json"));
delete data.allPosts; // the UI only uses stats/topPosts/competitors — keep the file light
const agents = JSON.parse(read("agents.json"));

const embed = `<script>window.APN_EMBED=${JSON.stringify({ data, agents }).replace(/<\//g, "<\\/")}</script>`;
const appJs = `<script>${read("app.js").replace(/<\//g, "<\\/")}</script>`;

// The Artifact host wraps the file in its own doctype/head/body skeleton, so
// emit only the head contents + body contents, no document shell of our own.
const src = read("index.html").replace('<script src="app.js"></script>', embed + "\n" + appJs);
const headInner = src.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>/g, "").trim();
const bodyInner = src.match(/<body>([\s\S]*?)<\/body>/)[1].trim();
const html = headInner + "\n" + bodyInner + "\n";
const out = path.join(DASH, "artifact.html");
fs.writeFileSync(out, html);
console.log(`Saved ${out} (${Math.round(html.length / 1024)} KB)`);
