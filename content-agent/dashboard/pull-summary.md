# Data pull — 2026-09-14

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

**Fourth consecutive failed pull** (Aug 28, Aug 31, Sep 7, Sep 14), all with the same 403 `platform-feature-disabled` / "Monthly usage hard limit exceeded". Two weeks into September the error is unchanged, so this is not a billing-cycle rollover issue: the account's **monthly usage hard limit is set at or below what one pull costs** (or the plan is out of credit entirely).

**To fix:** Apify Console → Billing → Limits → raise or remove the "monthly usage hard limit" (or top up / upgrade the plan). One weekly incremental pull is three small actor runs, so even a modest limit should suffice once it's not zero.

Until then every weekly digest keeps reporting the cached Aug 27 numbers with the ⚠️ stale-data warning.
