# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Gemini, etc.) working in this repository.

## Canonical reference

**The authoritative technical guide for this repo is [`CLAUDE.md`](CLAUDE.md).** It is the
single source of truth for architecture, the pipeline, the Firestore schema, environment
variables, and conventions — and it is the file kept up to date. Read it first. This file
exists only so agents that look for `AGENTS.md` by convention are pointed to the right place;
it deliberately does **not** duplicate `CLAUDE.md`, because a stale duplicate is what previously
left this file full of find-replace corruption ("Codex" in place of "Claude") and a wrong
schedule. Do not re-expand it into a second copy — update `CLAUDE.md` instead.

For day-one orientation (quick start, deploy account gotcha, operational runbook, handover
checklist) read [`ONBOARDING.md`](ONBOARDING.md).

## One-paragraph orientation

Project Prism is a Global Revenue Intelligence Engine: it ingests Salesforce opportunity data
(CSV upload or BigQuery), analyses each deal with an LLM (Claude / Gemini / OpenAI, swappable
via the Factory pattern in `functions/src/llm/provider.ts`), aggregates the results in code, runs
up to five non-fatal LLM enrichment passes, and stores a structured report in Firestore that a
React/Vite dashboard renders. Backend is Firebase Cloud Functions v2 (TypeScript, Node 20, ESM —
all internal imports use `.js` extensions); frontend is in `hosting/`. Access is restricted to
verified company-domain Google accounts (see `CLAUDE.md` → Key Conventions → auth).

## Build & test (see CLAUDE.md for detail)

```bash
cd functions && npm install && npm run build && npm test   # backend (tsc → lib/, Jest)
cd hosting  && npm install && npm run build                # frontend (tsc && vite build → dist/)
```

## Ground rules for agents

- Follow the conventions in `CLAUDE.md` exactly (ESM `.js` import extensions, Secret Manager for
  keys, the multi-phase enrichment pattern, the Firestore 1 MiB handling).
- Never hardcode API keys or secrets. Live keys live in Firebase Secret Manager; local dev uses
  the git-ignored `functions/.env`.
- The domain allowlist is duplicated in four files that must be kept in sync — see
  `hosting/src/lib/allowedDomains.ts` for the list of locations.
- Deploy from a feature branch and verify in production before merging to `main`. The Firebase
  deploy account is `brad.towers@simprogroup.com`, not a personal account.
