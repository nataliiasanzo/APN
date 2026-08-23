---
name: llm-council
description: Convene a council of independent agents that answer a hard question separately, blind-review and rank each other's anonymized answers, then synthesize one vetted answer. Fights sycophancy and one-angle reasoning — use when the user wants a real answer instead of agreement. Two modes — default (5 Claude sub-agents with different lenses) and cross-vendor (real GPT/Gemini/Claude/Grok via OpenRouter, faithful to karpathy/llm-council). Trigger on "/llm-council", "convene the council", "ask the council", "run this through the council", "get a multi-model / second opinion", "stress-test this", "don't just agree with me", "argue both sides and tell me who's right", "is this actually a good idea", or any moment they want a decision pressure-tested rather than rubber-stamped. Use cross-vendor mode on "cross-vendor", "real models", "different providers", "use openrouter", "faithful council", or a `--cross-vendor` / `--openrouter` flag.
---

# LLM Council

A 3-stage pipeline (after karpathy/llm-council) that produces a vetted answer instead of a sycophantic one. Independent agents answer **blind**, then **blind-review and rank** each other's work, then the main loop (you, as Chairman) **synthesizes**. The win is blind peer review across independent reasoners — judge on merit, no one knows whose answer is whose.

**The question** is whatever the user passed (the `/llm-council` argument, or the thing they asked you to run through the council). If it's vague, ask one clarifying question first — a sharp question is worth more than five answers to a fuzzy one.

## Stage 0 — sanity check (do this before anything else)

If the question is trivial — a lookup, a one-liner, anything with an uncontested answer — tell the user a council is overkill and just answer it. A council costs 10+ model calls; spend them on questions with genuine judgment involved.

## Two modes — pick one before Stage 1

- **Default (Claude council).** Five `opus` sub-agents, different lenses. Fast, free, no external calls, no question leaves Anthropic. This is what you run unless the user asks for the other one. Follow **Stages 1–3** below.
- **Cross-vendor (faithful council).** Real different providers — GPT, Gemini, Claude, Grok — via OpenRouter, exactly as karpathy/llm-council intended. Use it when the user says "cross-vendor", "real models", "different providers", "use openrouter", "faithful council", or passes `--cross-vendor` / `--openrouter`. This **sends their question to OpenAI/Google/xAI** and costs money, so it's opt-in only — never silently upgrade the default into it. Jump to **Cross-vendor mode** near the bottom, then come back for Stage 3.

The real win of cross-vendor is catching **correlated blind spots** — things every Claude gets wrong the same way. The default catches weak reasoning and one-angle answers but shares Claude's blind spots; the faithful council doesn't.

**Members answer from model knowledge only.** Don't give them web-research or file-reading tasks unless the user explicitly asks for a "researched" council; if they do, every member gets the same research instruction.

---

## Stage 1 — Independent answers (5 members, in parallel)

Spawn **all five Agent calls in a single message** (one block, five tool calls) so they run concurrently — never serialize them. Each is a `general-purpose` agent on **`opus`** — every seat gets the smartest model. Give each the **same question** plus its lens. Members never see each other.

| Member | model | Lens (what it's told to prioritize) |
|---|---|---|
| Pragmatist | `opus` | What actually works under real constraints. Bias to action and the concrete next move. |
| Red-teamer | `opus` | Attack the premise. Where does this fail? Is the question itself wrong or missing something? |
| Domain rigorist | `opus` | Technical correctness and precision. Name the real tradeoffs exactly; no hand-waving. |
| First-principles | `opus` | Ignore convention and best-practice. Reason up from fundamentals; question defaults. |
| Generalist | `opus` | Breadth. Connect angles, weigh the whole picture, answer plainly. |

Diversity comes from the **lenses**, not from weaker models — a dumber model is noise, not a fresh perspective.

Prompt template for each member:

> You are one member of an expert council answering a question independently. Your job is to give your **genuine best answer** — the lens below is what you should *emphasize*, not a character to perform.
>
> **Your lens:** {lens}
>
> **Question:** {question}
>
> Give a direct, well-reasoned answer. State your key assumptions and the strongest objection to your own position. Be specific and concise — no preamble, no hedging. You may use read-only tools if you genuinely need a fact to answer well, but lead with reasoning.
>
> Return only your answer.

Collect the five answers verbatim.

**If a member's Agent call fails or returns null:** continue with the remaining answers as long as at least 2 survive, and name the dropped seat in the final report. If fewer than 2 survive, abort the council, tell the user why, and answer the question directly yourself.

---

## Stage 2 — Blind peer review + ranking (5 reviewers, in parallel)

Label the surviving Stage-1 answers `Response A`, `Response B`, … **and strip all identity** (no lens names, no model names). Keep your own private map of label → member for the notes later. Never reveal that mapping to a reviewer.

Spawn **five reviewer Agent calls in one message**, all on **`opus`** (judging answer quality is harder than producing it — never cheap out on the judges). Each reviewer sees **all** the anonymized answers, including, unlabeled, its own — that's expected; the anonymization is the control for self-preference, and reviewers are fresh stateless spawns anyway.

Rotate the order the responses are pasted in for each reviewer (reviewer 1 sees A,B,C…; reviewer 2 sees B,C,…,A) so position bias doesn't favor one seat. The letters themselves stay fixed.

Reviewer prompt template:

> You are evaluating anonymized answers to this question:
>
> **Question:** {question}
>
> {Response A … Response E, each as "Response X:\n{answer}"}
>
> Your task:
> 1. Evaluate each response individually — what it does well, what it does poorly — judging on **accuracy and insight only**, not style or length.
> 2. Note any important point that ALL the answers missed.
> 3. Then give a final ranking, best to worst.
>
> Format the ending EXACTLY like this:
>
> ```
> FINAL RANKING:
> 1. Response C
> 2. Response A
> 3. Response E
> 4. Response B
> 5. Response D
> MISSED: <one sentence, or "none">
> ```
>
> Only response labels in the ranking section — no extra text there.

**Parsing ballots.** If a reviewer's reply has no parseable `FINAL RANKING:` block, re-prompt that reviewer once with a reminder of the required format. If it's still unparseable, drop that ballot and say so in the report — never guess or reconstruct a ranking from prose.

**Scoring (Borda).** With N ranked responses, 1st place earns N points, 2nd earns N−1, … last earns 1. Sum across all valid ballots. A 5-seat council with 5 ballots therefore tops out at 25 points and bottoms at 5.

**Ties.** Break a tie by head-to-head count (how many reviewers ranked one seat above the other); if still tied, by more first-place votes; if still tied, report it as a tie. Always state which tiebreak you used.

---

## Stage 3 — Chairman synthesis (you, the main loop)

You now hold all the answers and all the reviews. Do **not** just pick the #1 answer, and do **not** drift back toward whatever the user originally implied — synthesize on **merit and consensus**.

- Build the final answer from the strongest reasoning across all members, grafting good points even from low-ranked answers.
- Fold in anything the reviewers flagged as missed by everyone.
- Where the council genuinely splits, **say so and take a position** — don't average the disagreement into mush.
- If the Red-teamer (or anyone) showed the question's premise is wrong, **that leads.** The council exists to push back, not rubber-stamp.

---

## Output format

Lead with the answer. Keep the council note tight. Report in exactly this shape — final answer first, mechanics after the rule:

```
**Council's answer**

{your synthesis}

---
**Council ranking:** 1. {member} — {pts} · 2. {member} — {pts} · 3. {member} — {pts}  ({M} ballots, best = {N} pts{, tiebreak note if used})
**Disagreements & gaps:** {1–3 bullets, or the single line "The council was in broad agreement."}
```

Close by offering to show the raw member answers; keep the full transcripts out of the reply unless asked.

### Example of a great result

For `/llm-council Should an early-stage startup default to Postgres or a NoSQL store?`:

> **Council's answer**
>
> Default to Postgres. At early stage your schema will change weekly, and a relational store with strong constraints catches modeling mistakes while they're still cheap… {2–4 more paragraphs: when NoSQL genuinely wins, migration escape hatches, the one-line recommendation restated}
>
> ---
> **Council ranking:** 1. Pragmatist — 21 pts · 2. Rigorist — 18 · 3. First-principles — 14 · 4. Generalist — 12 · 5. Red-teamer — 10  (5 ballots, best = 25 pts)
> **Disagreements & gaps:** the Red-teamer alone argued document stores are fine if the team already knows Mongo; every member initially ignored managed-service cost, which I folded in.
>
> Want to see the five raw answers? I kept the full transcripts.

---

## Cross-vendor mode (faithful council via OpenRouter)

Only when the user opted in (see "Two modes"). This replaces Stages 1–2 with a real multi-provider fan-out; **Stage 3 is unchanged** — you still synthesize as Chairman.

The script `scripts/council_openrouter.py` (pure stdlib) does the work: it calls every council model in parallel for its independent answer (Stage 1), then sends each model all the **anonymized** answers and parses its `FINAL RANKING` (Stage 2), then prints one JSON blob — answers (de-anonymized back to their model), reviews, and the aggregate ranking.

**Run it** from the project dir (so it finds `.env`):

```
python3 ~/.claude/skills/llm-council/scripts/council_openrouter.py "the exact question"
```

Default lineup is the original Karpathy council, editable as `COUNCIL_MODELS` at the top of the script:

| Seat | OpenRouter slug |
|---|---|
| GPT | `openai/gpt-5.5` |
| Gemini | `google/gemini-3.1-pro-preview` |
| Claude | `anthropic/claude-opus-4.8` |
| Grok | `x-ai/grok-4.3` |

Then:

1. **Read the JSON.** `members[]` already maps each answer back to its real model. `aggregate_ranking[]` is best-first by average peer rank.
2. **Be Chairman (Stage 3, same rules as above).** Synthesize on merit and consensus across vendors — graft strong points even from low-ranked seats; where vendors genuinely split, say so and take a side; if any model showed the premise is wrong, that leads.
3. **Output (same format as above),** but in the council note name the **models** (`GPT > Claude > Grok > Gemini`), and call out anything where the vendors **diverged** — that divergence is the whole point of paying for this mode.

Handling the script's output:
- `error` field present → relay it. The common one is a missing `OPENROUTER_API_KEY`: tell the user to add `OPENROUTER_API_KEY=sk-or-...` to the project `.env` (get it at openrouter.ai/keys), then re-run.
- `failures[]` non-empty → one or more model slugs failed (often a renamed/retired slug returning HTTP 404). Note which seat dropped; if ≥2 members still answered, the council is still valid. Fix by editing `COUNCIL_MODELS`.
- Want a single-model chairman instead of you? Pipe the question + answers to one more `--models` call. Not the default — you, the orchestrator with full context, are the better Chairman.

---

## Do-nots

- **Never** reveal the letter↔member mapping to Stage-2 reviewers, and never let a member see another's answer before Stage 2.
- **Never** serialize Agent calls within a stage — one message, parallel calls.
- **Never** fabricate, infer, or "repair" a ranking from an unparseable ballot; drop it and disclose.
- **Never** silently upgrade the default council into cross-vendor mode — it sends the question off-Anthropic and costs money.
- **Never** run the council on a trivial question without flagging that it's overkill first.
- **Never** present the synthesis as your own independent judgment — it is the council's answer, and the ranking section is part of the deliverable.
- **Never** paste full member transcripts into the main reply unprompted.

## Notes & limits

- **Default mode shares Claude's blind spots.** Every member is Claude, so it catches weak reasoning, bad assumptions, and one-angle answers — but not blind spots all Claude models share. Reach for **cross-vendor mode** when the stakes justify the API cost and you specifically want a non-Claude check on the premise.
- **Cross-vendor sends the question off-Anthropic** to OpenAI/Google/xAI via OpenRouter and costs real tokens. Opt-in only.
- **Duplicated seats.** If the user wants more members than there are lenses, reuse a lens rather than dropping to a weaker model — these are still independent samples. Name the seats (Pragmatist #1, Pragmatist #2) everywhere so the ranking stays legible.
- Ties in Borda totals are common with small councils; that's why the tiebreak order above is fixed rather than ad hoc.
- If only one model is available, say so and just answer directly — a council of one is not a council.
- Member count and lenses (default) / model list (cross-vendor) are easy to tune — the defaults are defaults, not laws. For a quick gut-check, 3 members is fine; for a high-stakes call, keep the full council.
