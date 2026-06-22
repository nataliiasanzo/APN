---
name: llm-council
description: Convene a council of multiple LLMs to deliberate on a question, then synthesize one answer. Each council member is a different model (opus, sonnet, haiku, fable) that answers independently; members then peer-review and rank each other's anonymized answers; a chairman model writes the final synthesized answer. Use when the user wants higher-quality, less-biased answers to a hard or open-ended question by aggregating multiple model opinions (e.g. "/llm-council <question>", "ask the council", "get a council answer").
---

# LLM Council

Convene a council of LLMs to deliberate on a question and produce a single,
synthesized answer that is better and less biased than any single model's.

This implements the "LLM council" pattern (popularized by Andrej Karpathy):
fan out to several models, have them critique each other anonymously, then let
a chairman synthesize the final answer.

The council members are **real, distinct models**, spawned as Claude Code
subagents via the `Agent` tool using the `model` override. Available models:
`opus`, `sonnet`, `haiku`, `fable`.

## Inputs

- The **question** is everything passed as arguments to the skill (the text
  after `/llm-council`). If no question is given, ask the user for one before
  proceeding.
- Optional knobs the user may state in plain language (use defaults otherwise):
  - **Council members** — default: `opus`, `sonnet`, `haiku`, `fable`.
  - **Chairman** — default: `opus`.
  - **Rounds** — default: a single deliberation round (Stages 1–3 below).

## Procedure

Run the three stages in order. Within a stage, make all `Agent` calls in a
**single message** so the members run concurrently.

### Stage 1 — Dispatch (independent first opinions)

For each council member, spawn one `Agent` (subagent_type `claude`) with that
member's `model`. Give every member the **same** prompt:

> You are a member of an expert council answering a question independently.
> Do not hold back — give your most complete, correct, and well-reasoned
> answer. State key assumptions and flag anything uncertain.
>
> QUESTION:
> {the user's question}

Collect each member's returned answer. Label them internally with neutral
identifiers — **Response A, Response B, Response C, …** — and keep a private
map of which model produced which letter. Do **not** reveal the mapping to the
reviewers in Stage 2.

### Stage 2 — Peer review & ranking (anonymized)

For each council member, spawn one `Agent` with that member's `model`. Give
each reviewer **all** the Stage-1 answers, anonymized as Response A/B/C/…
(including, unlabeled, their own), and ask:

> Below are anonymous answers from a council of experts to the same question.
> Evaluate them on accuracy, completeness, and reasoning. Rank them from best
> to worst by their letter, and for each give one sentence of justification.
> Then note any important point that ALL answers missed.
>
> QUESTION:
> {the user's question}
>
> {Response A: …}
> {Response B: …}
> {…}

Aggregate the rankings (e.g. Borda-style: best gets N points down to 1) to get
a council consensus ordering. Keep the justifications and any "missed points."

### Stage 3 — Chairman synthesis

Spawn one `Agent` with the **chairman** `model`. Provide the original question,
all Stage-1 answers (you may now de-anonymize internally), the aggregated
rankings, and the noted gaps. Ask:

> You are the chairman of an expert council. Using the council's answers and
> their peer rankings below, write the single best final answer to the
> question. Reconcile disagreements, prefer well-supported claims, incorporate
> any points the council noted were missing, and do not merely average — judge.
> Produce a clear, self-contained answer.

The chairman's output is the council's final answer.

## Reporting to the user

Present, in this order:

1. **Final answer** (the chairman's synthesis) — lead with this.
2. **Council ranking** — the consensus order with each model named and its
   points, e.g. `1. sonnet (11 pts) · 2. opus (9) · …`.
3. **Notable disagreements or gaps** — 1–3 bullets on where members diverged or
   what they collectively missed, if anything noteworthy.

Keep the transcript of every member's full answer out of the main reply unless
the user asks to see the raw responses; offer to show them.

## Notes & guardrails

- If only one model is available, say so and just answer directly — a council
  of one is not a council.
- Stages 1 and 2 each parallelize across members; never serialize them.
- Members must answer **independently** in Stage 1 — do not let one member see
  another's answer before Stage 2.
- Scale down for simple questions: if the question is trivial, tell the user a
  council is overkill and answer directly instead of burning four models on it.
