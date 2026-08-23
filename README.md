# Sanzo — Claude Code configuration

Shared Claude Code setup for All Purpose Nutrition. Everything lives under
`.claude/` and is picked up automatically by any Claude Code session opened on
this repository (web, desktop, or CLI).

## Contents

| Path | What it is |
|---|---|
| `.claude/skills/llm-council/` | `/llm-council` — runs a question past five independent agents, has them blind-review each other, then synthesizes one vetted answer. Optional cross-vendor mode calls GPT/Gemini/Claude/Grok via OpenRouter. |
| `.claude/output-styles/` | Response styles from [attention-span](https://github.com/alexgreensh/attention-span): **Attention-kind** (default), **Spartan**, **Rundown**. |
| `.claude/commands/style.md` | `/style` — switch the active output style from a picker. |
| `.claude/settings.json` | Project settings. Sets `Attention-kind` as the default output style. |

## Switching output style

Run `/style` and pick from the list, or edit `outputStyle` in
`.claude/settings.json`. Set it to `null` to go back to Claude's default.

## Cross-vendor council setup

`/llm-council --cross-vendor` needs an OpenRouter key. Add it to a `.env` file
in the project root (already git-ignored):

```
OPENROUTER_API_KEY=sk-or-...
```

Get one at [openrouter.ai/keys](https://openrouter.ai/keys). Default mode needs
no key and makes no external calls.

## Attribution

The files in `.claude/output-styles/` and `.claude/commands/style.md` are from
[alexgreensh/attention-span](https://github.com/alexgreensh/attention-span)
v0.7, licensed AGPL-3.0. The `llm-council` skill follows the council pattern
popularized by [karpathy/llm-council](https://github.com/karpathy/llm-council).
