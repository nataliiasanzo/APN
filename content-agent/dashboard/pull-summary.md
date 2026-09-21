# Data pull — 2026-09-21

**Status: FAILED — cycle continued on cached data** (`dashboard/data.json` still holds the Aug 27 pull; failed identically on one retry)

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

## Diagnosis — still needs your action

**Fifth consecutive failed pull** (Aug 28, Aug 31, Sep 7, Sep 14, Sep 21), always the same 403 `platform-feature-disabled` / "Monthly usage hard limit exceeded". Three weeks into September this is definitively not a billing-cycle rollover: the account's **monthly usage hard limit is set at or below the cost of a single pull**, or the plan/credit is exhausted.

**To fix:** Apify Console → Billing → Limits → raise or remove the "monthly usage hard limit" (or top up / upgrade the plan). One weekly incremental pull is three small actor runs.

The dashboard and digest have been running on the same cached Aug 27 data for a month now.
