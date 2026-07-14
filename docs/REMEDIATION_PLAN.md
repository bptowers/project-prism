# Project Prism — Remediation Plan (RevOps Handover Readiness)

## Context

Project Prism is a revenue intelligence engine (Firebase Cloud Functions backend + React/Vite dashboard) that analyses Salesforce pipeline data with LLMs and renders a CRO dashboard. Brad (SE Lead, builder/owner) is handing it over to RevOps. An architectural review (July 2026) found issues in four areas: **prompting** (the enrichment phases fabricate deal names/MRR because the data they need is stripped before it reaches them; output tokens truncate; parse failures silently become fake default scores), **backend architecture** (triplicated pipeline code, unbounded LLM concurrency, no cost tracking), **frontend/type safety** (three hand-synced copies of the same types, upload errors simulated as success, no error boundary), and **operations** (no CI, no tests, no lint config, anonymous auth reads all revenue data, doc rot).

This plan turns that review into ordered, executable work. Phases 1–2 fix trust in the numbers (do these before RevOps relies on the tool). Phases 3–5 are handover hardening. Each task lists files and acceptance criteria.

> **Status (updated 2026-07-14):**
> - ✅ **Phase 1 — Trustworthiness of the numbers** — complete and deployed.
> - ✅ **Phase 2 — Backend architecture** — complete and deployed.
> - ✅ **Task 4.4 — Domain-restricted Google sign-in** — complete and deployed (anonymous auth removed).
> - ✅ **Task 4.5 — Doc repair** — complete (AGENTS.md, `.env.example` files, CLAUDE.md, ONBOARDING.md, this file, PROMPT_ARCHITECTURE.md).
> - ⬜ **Remaining:** Phase 3 (shared types, upload-error surfacing, error boundary, frontend cleanups); Phase 4 tasks 4.1–4.3 (tests/eval harness, lint + CI/CD + Node 22 bump, enrichment-status surfaced in UI); Phase 5 (optional/deferred).
> - 🆕 A post-remediation sweep found additional correctness bugs — see **[DATA_CORRECTNESS_PLAN.md](DATA_CORRECTNESS_PLAN.md)**, scheduled ahead of the CI/CD work.
> Individual completed tasks below are prefixed **[DONE]**.

**Governance note (org policy — do not skip):** this tool handles revenue/customer data and is moving to team ownership → red zone. Before final handover: post in #simpro-internal-ai-created-tooling, obtain IT approval, name a RevOps owner + backup. These are human tasks for Brad, not agent tasks, but the agent should add them to `ONBOARDING.md` as a pre-handover checklist.

**Key repo facts the executing agent needs:**
- Two independent sub-projects: `functions/` (TS, Node 20, ESM — all internal imports use `.js` extensions) and `hosting/` (Vite + React 18, `@/` → `src/`).
- Build: `cd functions && npm run build` (tsc → `lib/`); `cd hosting && npm run build` (tsc && vite build).
- Firebase project `project-prism-489108-a9e2b`; deploys are on the `brad.towers@simprogroup.com` Firebase account. Deploy from a feature branch and verify in prod before merging to main (established working convention).
- LLM providers: Factory pattern in `functions/src/llm/provider.ts`; `claude.ts`, `gemini.ts`, `openai.ts` implement `ILLMProvider`. All prompts in `functions/src/llm/prompts.ts` (~1,380 lines).
- Pipeline: Phase 1 per-deal analysis (COMPREHENSIVE_ANALYSIS_PROMPT, fatal) → code aggregation (`aggregator.ts`) → Phases 2–5 enrichment (portfolio briefing, twenty questions, competitive displacement, delta), each non-fatal.

---

## Phase 1 — Trustworthiness of the numbers (URGENT) — ✅ [DONE]

### 1.1 Ground the enrichment phases in real per-deal data
**Problem:** Phases 2–5 prompts demand deal names, reps, MRR, probabilities, days-in-stage ("name deals, name reps, quantify MRR, zero hedging") but `Aggregator.buildReportSummary()` (`functions/src/analysis/aggregator.ts:591-636`) sends only region win rates, 3 theme strings, top-5 at-risk deal names, and competitor names. The LLM fabricates the rest with confidence.

**Fix:**
- Extend `buildReportSummary()` (or add `buildDealTable(analyses)`) to include one compact JSON object per active deal: `{name, account, rep, region, mrr, stage, probability, healthScore, velocityAssessment, activityHealth, stakeholderCoverage, competitorThreat, riskLevel, lastActivityDate, daysInStage}`. Source: the `OpportunityAnalysis[]` already produced in Phase 1 (they carry all these fields — see `analyzer.ts:enrichAnalysis`). Thread the analyses (or a slimmed deal table) through to `enrichWithLLM`, `enrichWithTwentyQuestions`, `enrichWithCompetitiveDisplacement`, `enrichWithDeltaIntelligence` — currently they only receive the `AggregatedReport`, so either store the deal table on the report before enrichment or change the enrichment signatures.
- Budget: at ~120 tokens/deal, 500 deals ≈ 60k input tokens — fine for Claude/Gemini context windows. Cap at e.g. 600 deals and log if capped.
- Add a grounding block to `PORTFOLIO_AGGREGATION_PROMPT`, `TWENTY_QUESTIONS_PROMPT`, `COMPETITIVE_DISPLACEMENT_PROMPT`, `DELTA_INTELLIGENCE_PROMPT` in `prompts.ts`: *"Only cite deals, reps, accounts, and figures that appear verbatim in the data between the markers. If the data cannot answer a question (e.g. no quarterly targets provided for coverage ratios), answer 'not available in source data' for that item. Never estimate or invent names or MRR figures."* Soften the conflicting "do not hedge / every sentence must contain a number" instructions to apply only to claims the data supports.
- Wrap the injected deal table in the existing `[BEGIN_USER_DATA]`/`[END_USER_DATA]` convention (see `formatOpportunityForPrompt` in `prompts.ts`).
- Note: Q3 (pipeline coverage vs quarterly target) has no target data anywhere in the system. Either inject targets from a config (see 3.4) or amend Q3 to answer "not available."

**Accept when:** running the pipeline on `test-data/sample-opportunities.csv`, every deal/rep/MRR named in twentyQuestions/competitiveDisplacement output exists in the input CSV.

### 1.2 Raise output token limits
**Problem:** `getLLMConfig` (`functions/src/index.ts:105-109`) defaults `maxTokens` to 2000; only Gemini is bumped to 8192. The Twenty Questions JSON schema alone routinely exceeds 2000 tokens → truncated JSON → regex parse fails → phase silently skipped.

**Fix:** default `LLM_MAX_TOKENS` to 8192 for all providers (remove the Gemini-only special case; keep env override). Verify each provider's model supports it (claude-sonnet-4-6, gpt-4o, gemini-2.5-flash all do).

### 1.3 Structured outputs + explicit failure instead of fake defaults
**Problem:** All three providers extract JSON with `responseText.match(/\{[\s\S]*\}/)` and, on parse failure or missing fields, fall back to plausible defaults — `dealHealthScore: 50`, `velocityAssessment: "slowing"`, `activityHealth: "cooling"` (`claude.ts:parseAnalysisResponse`, `analyzer.ts:enrichAnalysis:288-292`). Failed analyses are indistinguishable from real ones.

**Fix:**
- Claude: use tool-use forced JSON (define a `record_analysis` tool whose input schema mirrors the `OpportunityAnalysis` response shape; `tool_choice: {type: "tool"}`). OpenAI: `response_format: {type: "json_schema"}`. Gemini: `responseSchema` + `responseMimeType: "application/json"`. Keep the regex path only as fallback for the enrichment phases if schemas are too dynamic there (their shapes are known — schema them too if feasible; at minimum keep regex + validate top-level keys).
- On unrecoverable parse/validation failure: return `success: false` from the provider; in `analyzer.ts`, count it as a failed record (already supported via `batchErrors`) rather than emitting a defaulted analysis. Remove the silent-default paths in `enrichAnalysis` for the classification fields — only default cosmetic/optional fields.
- Surface failure counts: they're already logged; also persist `recordsFailed` visibly (feeds 4.3).

**Accept when:** feeding a record that yields malformed output produces a logged failure and no analysis document, not a health score of 50.

### 1.4 Compute deterministic classifications in code, not the LLM
**Problem:** `activityHealth`, `velocityAssessment`, and stall detection are pure date/threshold arithmetic, currently delegated to the LLM with long prompt caveats ("if Last Activity unavailable, don't default to dark…"). This adds cost, run-to-run variance, and the fabricated `daysStalled` map in `reportTransformer.ts:228,367` (`dark→45, dormant→22, cooling→10, else→2`) presented in the UI as real days.

**Fix:**
- Add a pure function (suggest `functions/src/analysis/dealMetrics.ts`): from `OpportunityRecord` dates compute `daysSinceLastActivity` (fallback: `updatedDate`), `daysInStage`/`daysSinceCreated`, `activityHealth` (7/14/30-day buckets per the existing prompt rules), `velocityAssessment` (2/4/8-day rules), `isStalled`. Unit-test it (first tests in the repo — see 4.1).
- Pass computed values into the per-deal prompt as stated facts (extend `formatOpportunityForPrompt`); delete the "CLASSIFY THESE FIRST" derivation instructions from `COMPREHENSIVE_ANALYSIS_PROMPT` for these two fields (keep `stakeholderCoverage`/`competitorThreat` with the LLM — they need notes interpretation). Override whatever the LLM returns for the code-computed fields in `enrichAnalysis`.
- Replace the synthetic `daysStalled` map in `reportTransformer.ts` with the real `daysSinceLastActivity`.

**Accept when:** two consecutive runs on the same CSV produce identical activityHealth/velocity classifications; dashboard "days stalled" matches CSV dates.

### 1.5 Prompt caching
**Fix:** in `claude.ts`, send `SYSTEM_PROMPT` as a system content block with `cache_control: {type: "ephemeral"}` (it's ~6-8k tokens sent on every one of up to 500+ calls; ~90% input-cost cut on that portion). Requires system as array-of-blocks form. Gemini/OpenAI: leave as-is (implicit caching) — do not over-engineer.

---

## Phase 2 — Backend architecture — ✅ [DONE]

### 2.1 Extract the triplicated pipeline
**Problem:** `onCSVUpload`, `runWeeklyAnalysis`, `fetchFromBigQuery` (`functions/src/index.ts:143-653`) each repeat ~80 lines: per-region funnel → transform → `writeDealsSubcollection` → trim → `set(merge)` → enrich (Phase 2–5) → re-transform → trim → `update` → execution status.

**Fix:** one `async function processAndStoreReport(records, context, llmConfig, dataSource?)` in `index.ts` (or new `pipeline/orchestrator.ts`) containing the full sequence; the three entry points reduce to input acquisition + a call. Preserve exact behaviours: merge:true semantics, base-report-before-enrichment write, non-fatal enrichment, `logDocSize` calls.

### 2.2 Real concurrency control
**Problem:** "5 at a time" is per-batch but all batches run in one `Promise.all` (`analyzer.ts:137`) → 500 records = ~100 concurrent LLM calls, throttled only by a racy `lastRequestTime` in each provider (`claude.ts:260-271`).

**Fix:** replace batch-of-batches with a single global limiter (add `p-limit` dep, or a ~10-line inline semaphore to avoid new deps) sized via env `LLM_CONCURRENCY` (default 8). Delete `enforceRateLimit` from providers; rely on limiter + existing retry/backoff (`processRecord` already handles `LLMRateLimitError`). Keep total wall-clock inside the 540s CSV-trigger timeout — 500 records × ~8s ÷ 8 concurrent ≈ 8.3 min is too slow, so default concurrency 12–16 and document the trade-off, OR raise `onCSVUpload` `timeoutSeconds` toward the max and log elapsed time per run.

### 2.3 Clean provider interface for portfolio prompts
**Problem:** enrichment phases smuggle full prompts through `provider.analyze([dummyRecord], prompt)` with the prompt in `notes` (`aggregator.ts:432-442, 475-483, 513-521, 562-570`).

**Fix:** add `complete(userPrompt: string, options?: {maxTokens?})` to `ILLMProvider` (`provider.ts`) returning `{text, tokensUsed}`; implement in all three providers (reuse each provider's client + SYSTEM_PROMPT); replace the four dummy-record call sites. Delete `injectReportSummary` if unused after.

### 2.4 Same-day run collision guard
**Problem:** report doc keyed by date + `merge:true`; two runs the same day interleave into a chimera (second run's base write lands mid-first-run's enrichment).

**Fix (minimal):** at pipeline start, write `{activeExecutionId: context.executionId, pipelineStatus: "running"}` to the report doc; before each enrichment `update`, read it back and skip the write (log a warning) if `activeExecutionId` changed. Set `pipelineStatus: "complete"` at end. Do NOT re-key the collection — the frontend and history queries depend on date keys.

### 2.5 Cost tracking
**Problem:** `tokensUsed` is returned by every provider call and dropped.

**Fix:** accumulate input/output tokens on `ExecutionContext` (extend type in `types.ts`), sum across Phase 1 + enrichment, write to `/executions/{id}` and log a per-run total with an approximate $ figure (price table per provider/model as a small const — mark clearly as approximate). Feeds the dashboard footer later (optional).

---

## Phase 3 — Type safety & frontend correctness

### 3.1 Single source of truth for shared types
**Problem:** three hand-synced definitions: `functions/src/types.ts`, local duplicates in `functions/src/transforms/reportTransformer.ts:8-95`, and `hosting/src/lib/types.ts`. Drift risks e.g. `riskLevel.toUpperCase() as "HIGH"|"MEDIUM"|"LOW"` (`reportTransformer.ts:221,360`) producing `"NONE"` outside the union.

**Fix (pragmatic, no monorepo tooling):** create `shared/types.ts` at repo root containing the frontend-facing contract (`RegionData`, `RiskDeal`, `Stats`, `TwentyQuestionsData`, `CompetitiveDisplacementData`, `DeltaIntelligenceData`, `ReportDocument`). Both tsconfigs include it (`functions/tsconfig.json` needs `rootDir` adjustment or a relative import with `.js` extension quirk — verify tsc output paths still work; if ESM path pain is prohibitive, fall back to a documented copy-check script that diffs the two files in CI). Transformer return types reference the shared types (`satisfies`), deleting the local duplicates. Handle the `"none"` risk level explicitly (map to `"LOW"` or filter out).
- Add runtime validation with `zod` on the frontend for the genuinely untyped LLM payloads (`twentyQuestions`, `competitiveDisplacement`, `deltaIntelligence`) at the Firestore read in `useRegion.ts:123-130` — invalid payload → render the widget's empty state, not a crash.

### 3.2 Stop simulating upload success on failure
**Problem:** `hosting/src/hooks/useUpload.ts:88-93` catches upload errors and fakes a successful completion ("simulating upload"). Also a hardcoded 120s "processing complete" timer (`:70-73`).

**Fix:** on error, set an `error` state and show it in `UploadModal`. Replace the fixed timer with an `onSnapshot` listener on today's `/reports/{date}` doc (complete when `createdAt`/`enrichedAt` updates past upload time), with the timer as fallback timeout that reports "still processing — check back" rather than success.

### 3.3 Error surfacing in the dashboard
**Fix:** (a) add a top-level React error boundary component wrapping the widget area in `App.tsx` (per-section boundaries around the enrichment widgets ideal, one global minimum); (b) destructure and render the `error` from `useLatestReport` (currently returned by the hook, never consumed); (c) fix the `Number.parseInt(...) ?? fallback` NaN bug (`App.tsx:43`) — use `Number.isFinite` check.

### 3.4 Externalize market/stage intelligence (enables RevOps self-service)
**Problem:** `REGIONAL_MARKET_INTELLIGENCE`, `SIMPRO_STAGE_REFERENCE`, competitor lists, 14-day-cycle benchmarks are hardcoded in `prompts.ts`; changing "JobLogic is the UK primary" requires a TS deploy.

**Fix:** move the two blocks into a Firestore doc `/config/promptContext` (fields: `regionalIntelligence: string`, `stageReference: string`, optional `quarterlyTargets` for Q3 coverage). Load at pipeline start with the current hardcoded strings as fallback + seed script (`functions/scripts/seedPromptConfig.ts`). Compose `SYSTEM_PROMPT` at runtime instead of module load. Document the edit procedure in ONBOARDING.md ("edit in Firebase console → next run picks it up").

### 3.5 Smaller frontend cleanups (batch, low risk)
- Split `RiskRadar.tsx` (~1030 lines) into its five sub-components under `components/dashboard/riskRadar/`.
- Deduplicate `formatCurrency`, `normalizeStage`, `regionLabel`, and the stat-banding logic (`useRegion.ts:5-43` vs `App.tsx:71-98`) into `hosting/src/lib/format.ts` / `lib/dealStats.ts`.
- Fix `regionCounts` regex-parsing a number out of a display string (`useRegion.ts:144-154`) — have the transformer emit the numeric field.
- Delete dead code: `useReportHistory` hook, orphaned components not imported by `App.tsx` (`MarketSignals`, `TrendChart`, `CompetitorIntel`, `ThemeChart` — confirm unused first), and either remove the unused `getReport`/`getReportHistory`/`uploadCSV` HTTP functions + their `firebase.json` rewrites or document why they stay (they are deployed, public-invoker, auth-gated attack surface the SPA never calls).
- Enable `noUnusedLocals`/`noUnusedParameters` in `hosting/tsconfig.json` and fix fallout.

---

## Phase 4 — Operations, CI, and observability

### 4.1 Tests + eval harness (the keystone for prompt maintainability)
- Add `jest.config` (ts-jest, ESM) to `functions/` — the deps are already installed but there is no config and zero test files; `npm test` currently finds nothing.
- Unit tests: `dealMetrics.ts` (from 1.4), `csvParser` field mapping + region detection, `validator` PII scrubbing, `trimReportForStorage`/`capJsonSize`, `buildReportSummary`/deal table.
- **Eval harness:** `functions/eval/` with (a) `golden-deals.json` — 15–20 synthetic deals with expected ranges (`healthScore: [40,60]`, expected `activityHealth`, expected risk tier keywords); seed from `test-data/sample-opportunities.csv` + the existing `docs/health-score-spot-check.docx` expectations; (b) `npm run eval` script that runs COMPREHENSIVE_ANALYSIS_PROMPT against them via the real provider and reports pass/fail per deal. Run manually + in CI on prompt changes (needs `ANTHROPIC_API_KEY` secret in CI; make the CI eval job optional/manual-trigger to control cost).

### 4.2 Lint + CI/CD
- Add `eslint.config.js` (flat config, typescript-eslint) to `functions/` — the script exists but no config, so `npm run lint` currently fails. Add ESLint to `hosting/` with a matching script.
- `.github/workflows/ci.yml`: on PR → install, `tsc --noEmit` both packages, lint both, `npm test` (functions). On push to `main` → build + `firebase deploy --only functions,hosting` using a `FIREBASE_TOKEN`/service-account secret (Brad must create the secret; agent writes the workflow and documents the secret setup step in ONBOARDING.md).
- Bump functions runtime `nodejs20` → `nodejs22` in `firebase.json` + `engines` in `functions/package.json` (Node 20 decommissioned 2026-10-30). Verify local build under 22.

### 4.3 Enrichment status surfaced (kill the silent-failure mode)
- In the orchestrator (2.1), record per-phase outcomes: `enrichmentStatus: {phase2: "ok"|"failed: <msg>", phase3: …, phase4: …, phase5: "ok"|"skipped-no-previous"|…}` + `recordsFailed`/`recordsProcessed` onto the report doc.
- Frontend: show it in `ProcessingFooter` (e.g. "Analysis: 271/271 deals · Enrichment: 4/4 phases ✓" or a warning icon with which phase failed).
- Alerting: add a `docs/MONITORING.md` (or ONBOARDING.md section) with the exact `gcloud` commands / console steps to create a log-based alert on `status: "failed"` executions (agent can't create the alert without prod access; document it precisely for Brad).

### 4.4 Auth: replace anonymous with domain-restricted Google sign-in — ✅ [DONE]
**Problem:** `hosting/src/lib/firebase.ts:34` uses anonymous auth; `firestore.rules` requires only `request.auth != null` — any anonymous session reads all revenue/competitive data. `storage.rules` lets any anonymous user write CSVs to `/uploads/*` (which triggers a billable LLM pipeline).

**Fix:** switch to `signInWithPopup(GoogleAuthProvider)`; gate the app on a signed-in state with a minimal sign-in screen. Enforce domain in `firestore.rules` and `storage.rules`: `request.auth.token.email.matches('.*@simprogroup[.]com$')` && `email_verified` (belt-and-braces alongside a `hd` parameter hint on the provider). Update `requireAuth` in `functions/src/index.ts` to also check the token's email domain. **Manual prerequisite for Brad:** enable the Google provider in Firebase console. Keep emulator/dev path working (`import.meta.env.DEV` can retain anonymous auth against emulators).

### 4.5 Doc repair — ✅ [DONE]
- `AGENTS.md`: fix the find-replace corruption ("Codex" → "Claude"/`claude.ts` at lines ~7, 75, 114-117), wrong schedule ("Mon 6am" → every 3 days, cron `0 6 */3 * *`), stale App.tsx layout description, "npm test works" claim (true after 4.1). — *Done: AGENTS.md collapsed to a thin pointer to `CLAUDE.md` to end the duplication that caused the corruption.*
- `.env.example`: align with what `index.ts`/`bigquerySource.ts` actually read (`CLAUDE_MODEL` default `claude-sonnet-4-6`, add `BQ_PROJECT_ID`/`BQ_DATASET`/`BQ_TABLE`/`BQ_LOCATION`, `LLM_CONCURRENCY`); create the per-package `functions/.env.example` and `hosting/.env.example` that ONBOARDING.md already tells people to copy.
- `PROMPT_ARCHITECTURE.md`: refresh after Phase 1 changes (grounding rules, code-computed classifications, structured outputs, config-loaded market intelligence).
- `ONBOARDING.md`: add pre-handover governance checklist (IT approval, #simpro-internal-ai-created-tooling post, named owner + backup), CI secret setup, monitoring alert setup, prompt-config edit procedure, eval-harness usage.
- Confirm `sample-data/` and `test-data/` CSVs are fully synthetic (grep for real-looking emails/companies); scrub or regenerate if not. Remove `firestore-debug.log` from the tree if tracked.

---

## Phase 5 — Deferred / optional (note, don't block handover)
- Message Batches API for the per-deal pass (50% cost cut, removes timeout pressure) — larger refactor to async job pattern; do after Phase 2 stabilizes.
- Staging Firebase project (`prism-staging`) + deploy targets — requires Brad to create the project.
- React Query/SWR or reactive subcollection listener in `useFirestore.ts` (deals fetch is currently a non-reactive one-shot `getDocs` inside the doc snapshot callback).
- Move inline styles to a styling system.

---

## Execution order & dependencies
1. Phase 1 tasks 1.2 → 1.4 → 1.1 → 1.3 → 1.5 (1.4's computed metrics feed 1.1's deal table; 1.3 builds on 1.1's final shapes).
2. Phase 2: 2.3 first (interface change touches all providers), then 2.1, 2.2, 2.4, 2.5.
3. Phase 3 and 4.1/4.2 can proceed in parallel with Phase 2. 4.3 depends on 2.1. 4.4 and 4.5 are independent.
4. Deploy checkpoints: after Phase 1 (verify report quality on a real CSV), after Phase 2 (verify full run + timing/cost logs), after 4.4 (verify sign-in). Deploy from a feature branch first per repo convention; Firebase login must be `brad.towers@simprogroup.com`.

## Verification (end-to-end)
1. `cd functions && npm run build && npm test && npm run lint` — all green (tests/lint exist after 4.1/4.2).
2. `npm run serve` (emulators) + `cd hosting && npm run dev`; upload `test-data/sample-opportunities.csv`; confirm: report renders, enrichment status shows 4/4 phases (or explains skips), every deal/rep named in Twenty Questions exists in the CSV, days-stalled figures match CSV dates, deliberately malformed CSV upload shows an error (not fake success).
3. `npm run eval` — golden deals within expected ranges; run twice, classifications identical.
4. Break-glass test: temporarily set `LLM_MAX_TOKENS=200` and confirm phases report "failed" in the footer instead of silently disappearing.
5. Prod (feature branch deploy): run a real CSV, check `logDocSize` output, token/cost log on `/executions/{id}`, and dashboard on the live site with Google sign-in from a simprogroup.com account (and rejection of a non-domain account).

## Out of scope for the executing agent (Brad's manual tasks)
- IT approval + #simpro-internal-ai-created-tooling post + naming backup owner.
- Firebase console: enable Google auth provider; create CI deploy secret; create monitoring alert (agent documents exact steps).
- Buy-vs-build conversation with RevOps (Clari/Gong/Einstein overlap).
