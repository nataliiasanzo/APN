# Data pull — 2026-08-28

**Status: FAILED** (weekly run cycle stopped; dashboard `data.json` and `agents.json` were NOT refreshed and still hold the previous pull's data)

Console output of `node scripts/pull-data.js`:

```
=== Pulling Instagram data via Apify ===
FAILED: Apify 403 on /acts/apify~instagram-scraper/runs: {
  "error": {
    "type": "platform-feature-disabled",
    "message": "Monthly usage hard limit exceeded"
  }
}
```

The step was retried once per the run policy and failed identically both times.

## Diagnosis

This is not a code bug — the Apify account has hit its **monthly usage hard limit**, so the platform refuses to start any new actor runs (HTTP 403, `platform-feature-disabled`). Nothing in the repo can fix this.

## To resolve

- Wait for the Apify monthly usage cycle to reset, **or**
- Raise/remove the monthly usage hard limit (Apify Console → Billing → Limits), or upgrade the plan.

Once the limit clears, the next weekly run will refresh everything automatically, or run `node scripts/run-all.js` manually from `content-agent/`.
