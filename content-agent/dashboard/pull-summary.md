# Data pull — 2026-08-31

**Status: FAILED — cycle continued on cached data** (`dashboard/data.json` still holds the Aug 27 pull)

Console output of the pull step:

```
=== Pulling Instagram data via Apify ===
Incremental pull: last 60 posts, merging into 999 cached
FAILED: Apify 403 on /acts/apify~instagram-scraper/runs: {
  "error": {
    "type": "platform-feature-disabled",
    "message": "Monthly usage hard limit exceeded"
  }
}

Pull failed — continuing with cached data (digest will say so).
```

## Diagnosis

Same as the Aug 28 run: the Apify account's **monthly usage hard limit** is exhausted, so the platform refuses to start actor runs (HTTP 403, `platform-feature-disabled`). Not a code bug. The monthly cycle should reset around Sep 1; the next weekly run (Sep 7) should pull fresh data. If it fails again, raise the limit in Apify Console → Billing → Limits.

Thanks to the new fallback in `run-all.js`, the rest of the cycle still ran: `agents.json` was regenerated from cached data and the Telegram digest went out flagged as stale.
