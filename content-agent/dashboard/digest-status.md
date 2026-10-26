# Digest Status

**Status:** NOT SENT ✗
**Run date:** 2026-10-26 (weekly scheduled run)
**Error:** `Telegram sendMessage failed: Gateway Timeout` — failed identically on the one retry (the retry itself took over 2 minutes before timing out, so Telegram's API was unhealthy or unreachable at run time)

Everything else succeeded: the data pull was fresh and `agents.json` was
regenerated (Ideator: 6 ideas, Scripts: 3, Calendar: 7 days, Analyst insights: 4,
DM drafts: 5) — the dashboard is fully up to date. Only the Telegram delivery
failed. This looks transient on Telegram's side (a 504, not an auth error);
next Monday's run should deliver normally. To send this week's digest manually:
`cd content-agent && node scripts/send-digest.js`.
