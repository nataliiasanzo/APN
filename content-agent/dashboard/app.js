// APN Content Agent dashboard. Reads data.json (real Instagram pull) and
// agents.json (the 5 agents' outputs) and renders everything client-side.
// Serve the dashboard folder over HTTP (node scripts/serve.js) — file:// blocks fetch.

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const compact = (n) => {
  if (n == null) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
};
const full = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

const AGENT_META = {
  ideator: { icon: "💡", statuses: ["scouting competitor winners", "mining your top posts", "ranking angles"] },
  hookScript: { icon: "✍️", statuses: ["drafting hooks", "writing beats", "checking voice"] },
  planner: { icon: "🗓️", statuses: ["balancing formats", "slotting the week", "checking cadence"] },
  analyst: { icon: "📈", statuses: ["crunching 999 posts", "benchmarking rivals", "spotting patterns"] },
  dmManager: { icon: "💬", statuses: ["sorting triage lanes", "drafting replies", "flagging leads"] },
};

let DATA, AGENTS;

async function load() {
  try {
    [DATA, AGENTS] = await Promise.all([
      fetch("data.json").then((r) => r.json()),
      fetch("agents.json").then((r) => r.json()),
    ]);
    render();
  } catch (e) {
    $("#app").innerHTML = `<div class="err">Couldn't load <code>data.json</code> / <code>agents.json</code>.<br>
      If you opened this file directly, serve it instead:<br>
      <code>node scripts/serve.js</code> &nbsp;then open&nbsp; <code>http://localhost:8787</code></div>`;
  }
}

function render() {
  const s = DATA.stats;
  const top = DATA.topPosts[0];
  const freshDate = new Date(DATA.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  $("#app").innerHTML = `
    <header>
      <h1>Content Agent</h1>
      <a class="handle" href="https://www.instagram.com/${esc(DATA.me.username)}/" target="_blank">@${esc(DATA.me.username)}</a>
      <span class="fresh">data pulled ${esc(freshDate)} · ${full(s.postsAnalyzed)} posts analyzed</span>
    </header>
    <div class="sub">All Purpose Nutrition · 5 agents on your content, running on real numbers</div>

    <div class="kpis">
      ${kpi("followers", "Followers", full(s.followers), "tap for competitor benchmark")}
      ${kpi("top", "Top post", compact(top?.views) + " views", '"' + esc((top?.hook || "").slice(0, 42)) + '…"')}
      ${kpi("views", "Total views", compact(s.totalViews), "across " + full(s.postsAnalyzed) + " posts")}
      ${kpi("eng", "Avg engagement", s.avgEngagementRatePct + "%", full(s.totalLikes) + " likes · " + full(s.totalComments) + " comments")}
    </div>

    <h2><span class="tick"></span>Your agents</h2>
    <div class="agents">${["ideator", "hookScript", "planner", "analyst", "dmManager"].map(agentCard).join("")}</div>

    <div class="cols">
      <section>
        <h2><span class="tick"></span>Top posts, all time</h2>
        <div class="panel" id="toplist">${topRows(DATA.topPosts.slice(0, 8))}</div>
      </section>
      <section>
        <h2><span class="tick"></span>Competitive landscape</h2>
        <div class="panel">
          <div class="thead"><span>Account</span><span>Followers</span><span>Avg views*</span></div>
          ${landscapeRows()}
          <div style="margin-top:10px;font-size:11px;color:var(--ink-3)">*avg views on recent posts (yours: last 20; theirs: last ~25)</div>
        </div>
      </section>
    </div>`;

  document.querySelectorAll(".kpi").forEach((el) => el.addEventListener("click", () => openKpi(el.dataset.kpi)));
  document.querySelectorAll(".agent").forEach((el) => el.addEventListener("click", () => openAgent(el.dataset.agent)));
  document.querySelectorAll("#toplist .row").forEach((el) => el.addEventListener("click", () => window.open(el.dataset.url, "_blank")));
  cycleStatuses();
}

const kpi = (id, label, value, hint) =>
  `<div class="kpi" data-kpi="${id}"><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>`;

function agentCard(key) {
  const a = AGENTS[key], m = AGENT_META[key];
  return `<div class="agent" data-agent="${key}">
    <div class="top">
      <div class="avatar">${m.icon}</div>
      <div><div class="name">${esc(a.name)}</div>
      <div class="status"><span class="dot"></span><span class="stext" data-agent="${key}">${esc(m.statuses[0])}</span><span class="working"><i></i><i></i><i></i></span></div></div>
    </div>
    <div class="headline">${esc(a.headline)}</div>
    ${a.metrics.map((x) => `<div class="mrow"><span class="ml">${esc(x.label)}</span><span class="mv">${esc(x.value)}</span></div>`).join("")}
    <div class="open">Open output →</div>
  </div>`;
}

function topRows(posts) {
  const max = posts[0]?.views || 1;
  return posts
    .map((p, i) => `<div class="row" data-url="${esc(p.url)}" title="open on Instagram">
      <span class="rank">${i + 1}</span>
      <span><span class="rt">${esc(p.hook || "(no caption)")}</span><br><span class="rd">${esc((p.timestamp || "").slice(0, 10))} · ${p.productType === "clips" ? "Reel" : esc(p.type)}</span></span>
      <span class="bar" style="width:${Math.max(2, Math.round(((p.views || 0) / max) * 100))}%"></span>
      <span class="rv">${compact(p.views)}</span>
    </div>`)
    .join("");
}

function landscapeRows() {
  const rows = [
    { username: DATA.me.username, followers: DATA.stats.followers, avgRecentViews: null, you: true },
    ...AGENTS.analyst.benchmarks,
  ];
  const mine = AGENTS.analyst.insights[1].match(/average ([\d.]+[KM]?) views/);
  rows[0].avgLabel = mine ? mine[1] : "—";
  return rows
    .map((r) => `<div class="crow">
      <span class="cn"><a href="https://www.instagram.com/${esc(r.username)}/" target="_blank">@${esc(r.username)}</a>${r.you ? '<span class="you">YOU</span>' : ""}</span>
      <span class="cf">${compact(r.followers)}</span>
      <span class="cv">${r.you ? r.avgLabel : compact(r.avgRecentViews)}</span>
    </div>`)
    .join("");
}

// ---------- drill-downs ----------
function openModal(icon, title, bodyHtml) {
  const dlg = $("#modal");
  dlg.innerHTML = `<div class="mhead"><div class="avatar">${icon}</div><h3>${esc(title)}</h3>
    <button class="close" aria-label="close">✕</button></div><div class="mbody">${bodyHtml}</div>`;
  $(".close", dlg).addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
}

function openKpi(id) {
  if (id === "followers") {
    openModal("🏁", "Where you sit in the niche",
      AGENTS.analyst.benchmarks.map((c) => `<div class="item"><div class="it">@${esc(c.username)} — ${full(c.followers)} followers</div>
        <div class="ib">Avg recent views: <b>${compact(c.avgRecentViews)}</b>${c.topRecent ? ` · top recent: "${esc((c.topRecent.hook || "").slice(0, 80))}" (${compact(c.topRecent.views ?? c.topRecent.likes)})` : ""}</div></div>`).join(""));
  } else if (id === "eng") {
    openModal("❤️", "Engagement breakdown",
      `<div class="item"><div class="ib">${full(DATA.stats.totalLikes)} likes and ${full(DATA.stats.totalComments)} comments across ${full(DATA.stats.postsAnalyzed)} posts.
       Average engagement per post ÷ followers = <b>${DATA.stats.avgEngagementRatePct}%</b>.</div></div>` +
      AGENTS.analyst.insights.map((i) => `<div class="item"><div class="ib">${esc(i)}</div></div>`).join(""));
  } else {
    openModal("🏆", id === "top" ? "Your top 25 posts by views" : "Where the views live",
      DATA.topPosts.slice(0, 25).map((p, i) => `<div class="item"><div class="it">${i + 1}. ${compact(p.views)} views · ${compact(p.likes)} likes</div>
        <div class="is">${esc((p.timestamp || "").slice(0, 10))} · ${p.productType === "clips" ? "Reel" : esc(p.type)}</div>
        <div class="ib">${esc((p.caption || "").slice(0, 160))}</div>
        <a href="${esc(p.url)}" target="_blank">open on Instagram →</a></div>`).join(""));
  }
}

function openAgent(key) {
  const a = AGENTS[key], m = AGENT_META[key];
  let html = a.note ? `<div class="note">${esc(a.note)}</div>` : "";
  if (key === "ideator") {
    html += a.ideas.map((i) => `<div class="item"><div class="it">${esc(i.title)}</div>
      <div class="is">source: ${esc(i.source)}${i.sourceUrl ? ` — <a href="${esc(i.sourceUrl)}" target="_blank">view</a>` : ""}</div>
      <div class="ib">${esc(i.angle)}</div></div>`).join("");
  } else if (key === "hookScript") {
    html += a.scripts.map((s) => `<div class="item"><div class="it">${esc(s.idea)}</div>
      <div class="ib"><b>Hook options</b><ul>${s.hooks.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
      <b style="display:block;margin-top:8px">Beats</b><ul>${s.beats.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      <b style="display:block;margin-top:8px">CTA</b> ${esc(s.cta)}</div></div>`).join("");
  } else if (key === "planner") {
    html += a.calendar.map((c) => `<div class="item"><div class="it">${esc(c.day)} <span class="chip">${esc(c.format)}</span></div>
      <div class="is">${esc(c.date)}</div><div class="ib">${esc(c.item)}</div></div>`).join("");
  } else if (key === "analyst") {
    html += a.insights.map((i) => `<div class="item"><div class="ib">${esc(i)}</div></div>`).join("");
  } else if (key === "dmManager") {
    html += `<b style="font-size:13px">Triage lanes</b>` +
      a.triage.map((t) => `<div class="item"><div class="it">${esc(t.lane)}</div><div class="ib">${esc(t.rule)}</div></div>`).join("") +
      `<b style="font-size:13px">Reply drafts (copy-paste)</b>` +
      a.drafts.map((d) => `<div class="item"><div class="it">${esc(d.for)}</div><div class="ib">${esc(d.text)}</div></div>`).join("");
  }
  openModal(m.icon, a.name + " — output", html);
}

// little "working" animation: rotate status text per agent
function cycleStatuses() {
  let tick = 0;
  setInterval(() => {
    tick++;
    document.querySelectorAll(".stext").forEach((el) => {
      const list = AGENT_META[el.dataset.agent].statuses;
      el.textContent = list[tick % list.length];
    });
  }, 2600);
}

load();
