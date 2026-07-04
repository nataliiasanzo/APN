---
name: llm-council
description: Convene a council of multiple LLMs to deliberate on a question, then synthesize one answer. Each council member is a different model (opus, sonnet, haiku) that answers independently; members then peer-review and rank each other's anonymized answers; a chairman model writes the final synthesized answer. Use when the user wants higher-quality, less-biased answers to a hard or open-ended question by aggregating multiple model opinions (e.g. "/llm-council <question>", "ask the council", "get a council answer").
---

# LLM Council

Convene a council of LLMs to deliberate on a question and produce a single,
synthesized answer that is better and less biased than any single model's.

This implements the "LLM council" pattern (popularized by Andrej Karpathy):
fan out to several models, have them critique each other anonymously, then let
a chairman synthesize the final answer.

The council members are **real, distinct models**, spawned as Claude Code
subagents via the `Agent` tool using the `model` override. Available models:
`opus`, `sonnet`, `haiku`. (`fable` exists but is access-restricted and is not
part of the default council; only include it if the user explicitly asks.)

## Inputs

- The **question** is everything passed as arguments to the skill (the text
  after `/llm-council`). If no question is given, ask the user for one before
  proceeding.
- Optional knobs the user may state in plain language (use defaults otherwise):
  - **Council members** — default: `opus`, `sonnet`, `haiku`. If the user asks
    for more seats than there are models, duplicate seats (see guardrails).
  - **Chairman** — default: `opus`. The chairman model may also hold a council
    seat; its Stage-1 answer competes anonymously like any other.
  - **Rounds** — default: `1`. A round is Stage 1 + Stage 2. With `rounds: 2`,
    after the first Stage 2 each member receives all critiques and rankings and
    writes a **revised** answer; the revised answers go through Stage 2 again,
    and only the final round's ranking feeds Stage 3. More than 2 rounds is
    almost never worth the cost — say so if asked.
- **Members answer from model knowledge only.** Do not give them web-research
  or file-reading tasks unless the user explicitly asks for a "researched"
  council; if they do, every member gets the same research instruction.

## Procedure

**Stage 0 — sanity check.** If the question is trivial (a lookup, a one-liner,
anything with an uncontested answer), tell the user a council is overkill and
answer it directly. A council costs 7+ model calls; spend them on questions
with genuine judgment involved.

Run the three stages in order. Within a stage, make all `Agent` calls in a
**single message** so the members run concurrently — never serialize them.

### Stage 1 — Dispatch (independent first opinions)

For each council member, spawn one `Agent` (subagent_type `claude`) with that
member's `model`. Give every member the **same** prompt:

> You are a member of an expert council answering a question independently.
> Do not hold back — give your most complete, correct, and well-reasoned
> answer. State key assumptions and flag anything uncertain. Keep it under
> ~600 words. Your final message must be the answer itself — no preamble, no
> meta-commentary.
>
> QUESTION:
> {the user's question}

Collect each member's returned answer. Label them internally with neutral
identifiers — **Response A, Response B, Response C, …** in seat order — and
keep a private map of which model produced which letter. Do **not** reveal the
mapping to the reviewers in Stage 2.

**If a member's Agent call fails or returns null:** continue with the
remaining answers if at least 2 survive, and name the dropped seat in the
final report. If fewer than 2 survive, abort the council, tell the user why,
and answer the question directly yourself.

### Stage 2 — Peer review & ranking (anonymized)

For each surviving council member, spawn one `Agent` with that member's
`model`. Give each reviewer **all** the Stage-1 answers, anonymized as
Response A/B/C/… (including, unlabeled, their own — that's expected; the
anonymization is the control for self-preference). Rotate the order in which
the responses are pasted for each reviewer (reviewer 1 sees A,B,C; reviewer 2
sees B,C,A; …) so position bias doesn't favor one seat; the letters themselves
stay fixed. Ask:

> Below are anonymous answers from a council of experts to the same question.
> Evaluate them on accuracy, completeness, and reasoning. For each, give one
> sentence of justification for where you rank it. Then note any important
> point that ALL answers missed. End your reply with exactly these two lines:
>
> RANKING: <letters best to worst, e.g. B > A > C>
> MISSED: <one sentence, or "none">
>
> QUESTION:
> {the user's question}
>
> {Response A: …}
> {Response B: …}
> {…}

**Parsing ballots.** If a reviewer's reply has no parseable `RANKING:` line,
re-prompt that reviewer once with a reminder of the required format. If it's
still unparseable, drop that ballot and say so in the report — never guess or
reconstruct a ranking from prose.

**Scoring (Borda).** With N ranked responses, 1st place earns N points, 2nd
earns N−1, … last earns 1. Sum across all valid ballots. So a 3-seat council
with 3 ballots has a maximum score of 9 and a minimum of 3.

**Ties.** Break a tie by head-to-head count (how many reviewers ranked one
seat above the other); if still tied, by more first-place votes; if still
tied, report it as a tie. Always state which tiebreak you used.

### Stage 3 — Chairman synthesis

Spawn one `Agent` with the **chairman** `model`. Provide the original question,
all Stage-1 answers (you may now de-anonymize internally), the aggregated
rankings, and the noted gaps. Ask:

> You are the chairman of an expert council. Using the council's answers and
> their peer rankings below, write the single best final answer to the
> question. Reconcile disagreements, prefer well-supported claims, incorporate
> any points the council noted were missing, and do not merely average — judge.
> Produce a clear, self-contained answer. Do not mention the council or the
> deliberation process inside the answer itself.

The chairman's output is the council's final answer.

## Output format

Report to the user in exactly this shape — final answer first, mechanics
after the rule:

```
**Council's answer**

{chairman's synthesis, verbatim}

---
**Council ranking:** 1. {model} — {pts} · 2. {model} — {pts} · 3. {model} — {pts}  ({M} ballots, best = {N} pts{, tiebreak note if used})
**Disagreements & gaps:** {1–3 bullets, or the single line "The council was in broad agreement."}
```

Close by offering to show the raw member answers; keep the full transcripts
out of the reply unless asked.

### Example of a great result

For `/llm-council Should an early-stage startup default to Postgres or a
NoSQL store?`:

> **Council's answer**
>
> Default to Postgres. At early stage your schema will change weekly, and a
> relational store with strong constraints catches modeling mistakes while
> they're still cheap… {2–4 more paragraphs: when NoSQL genuinely wins,
> migration escape hatches, the one-line recommendation restated}
>
> ---
> **Council ranking:** 1. sonnet — 8 pts · 2. opus — 7 · 3. haiku — 3  (3 ballots, best = 3 pts)
> **Disagreements & gaps:** opus alone argued document stores are fine if the
> team already knows Mongo; all three initially ignored managed-service cost,
> which the chairman folded in.
>
> Want to see the three raw answers? I kept the full transcripts.

## Do-nots

- **Never** reveal the letter↔model mapping to Stage-2 reviewers, and never
  let a member see another's answer before Stage 2.
- **Never** serialize Agent calls within a stage — one message, parallel calls.
- **Never** fabricate, infer, or "repair" a ranking from an unparseable
  ballot; drop it and disclose.
- **Never** include `fable` unless the user explicitly asks for it.
- **Never** run the council on a trivial question without flagging that it's
  overkill first.
- **Never** present the synthesis as your own independent judgment — it is
  the council's answer, and the ranking section is part of the deliverable.
- **Never** paste full member transcripts into the main reply unprompted.

## Notes & guardrails

- If only one model is available, say so and just answer directly — a council
  of one is not a council.
- **Duplicated-model seats.** When the user wants more members than there are
  available models, seat the same model more than once (e.g. 2× opus). These
  are still independent samples and that's fine, but name the seats
  (opus #1, opus #2) everywhere — in the private map and in the final
  ranking — so the report stays legible. Expect duplicated seats of the
  strongest model to cluster near the top; "1. opus #1 / 2. opus #2" is
  expected, not a glitch.
- Ties in Borda totals are common with small councils; that's why the
  tiebreak order above is fixed rather than ad hoc.
