#!/usr/bin/env node
// Tiny static server for the dashboard (fetch() doesn't work over file://).
// Usage: node scripts/serve.js   → http://localhost:8787

const http = require("http");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "dashboard");
const PORT = process.env.PORT || 8787;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png" };

http
  .createServer((req, res) => {
    const file = path.join(DIR, path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^([/\\])+/, "") || "index.html");
    const target = file.endsWith(path.sep) || req.url === "/" ? path.join(DIR, "index.html") : file;
    if (!target.startsWith(DIR)) { res.writeHead(403); return res.end(); }
    fs.readFile(target, (err, buf) => {
      if (err) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(target)] || "application/octet-stream" });
      res.end(buf);
    });
  })
  .listen(PORT, () => console.log(`Dashboard at http://localhost:${PORT}`));
