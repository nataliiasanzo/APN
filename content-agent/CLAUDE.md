# Content Agent — All Purpose Nutrition

## Who I am
- **Name:** Nataliia Sanzo, RD — the Nashville Thyroid Expert®
- **Brand:** All Purpose Nutrition
- **Instagram:** [@all.purpose.nutrition](https://www.instagram.com/all.purpose.nutrition/)
- **Niche:** Hashimoto's & thyroid health, gut health, functional nutrition. I help people with Hashimoto's feel like themselves again through food, labs, and lifestyle — not fear or restriction.
- **Voice:** Clinical but warm. Evidence-based, myth-busting, zero fear-mongering. Every piece of content should make someone rethink something they thought they knew.
- **Offers:** 1:1 nutrition care, the Hashimoto's Healing Hub (paid Circle community — members are "HashiStars").

## My competitors (exact niche)
| Handle | Who they are |
|---|---|
| [@palomahealth](https://www.instagram.com/palomahealth/) | Telehealth thyroid company — polished, high-volume educational content |
| [@thyroidnation](https://www.instagram.com/thyroidnation/) | Thyroid community/aggregator account |
| [@izabellawentzpharmd](https://www.instagram.com/izabellawentzpharmd/) | Izabella Wentz, PharmD — the biggest personal brand in Hashimoto's |
| [@lisha_thyroid_rd](https://www.instagram.com/lisha_thyroid_rd/) | Fellow thyroid RD — closest direct comparable |

## The 5 agents
1. **Ideator** — scouts content ideas from my top posts + competitors' recent winners.
2. **Hook & Script** — turns ideas into hooks and teleprompter-ready scripts in my voice.
3. **Planner** — plans a daily content calendar.
4. **Analyst** — analyses my real stats (views, engagement, what's working).
5. **DM Manager** — drafts replies and triages my DMs.

## Project layout
- `scripts/` — Node scripts (data pull, Telegram digest, scheduled run)
- `dashboard/` — self-contained dashboard (`index.html` + small JS files + `data.json`)
- `.env` — secrets (Apify token, Telegram token/chat id). **Gitignored. Never print, never commit.**

## How it runs
- Full cycle: `node scripts/run-all.js` → pulls data (Apify) → regenerates agents.json → sends the Telegram digest. Dashboard: `node scripts/serve.js` → http://localhost:8787.
- A weekly cloud Routine (Mondays ~8am Central) spawns a fresh session in the "APN full network" environment, runs the full cycle, and commits the refreshed `dashboard/data.json` + `agents.json` to this branch.

## Rules
- Real data only — rank posts by actual views from the full post history (`instagram-scraper` with `resultsType: posts`), never the `latestPosts` field of the profile scraper.
- Plain readable files, no black-box services.
- One step at a time; verify against what's really on screen before moving on.
