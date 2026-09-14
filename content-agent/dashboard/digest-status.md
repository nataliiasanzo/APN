# Digest Status

**Status:** SENT ✓
**Run date:** 2026-09-14 (weekly scheduled run)
**Mode:** cached-data fallback (Apify limit still blocking — 4th week, see `pull-summary.md`)
**Data source:** cached Aug 27 data

The Apify pull failed again (monthly usage hard limit — unchanged two weeks into
the new month, so the account limit itself needs raising). The cycle fell back to
cached data: `agents.json` was regenerated (Ideator: 5 ideas, Scripts: 3,
Calendar: 7 days, Analyst insights: 4, DM drafts: 5) and the Telegram digest was
delivered via api.telegram.org with the ⚠️ stale-data warning line.
