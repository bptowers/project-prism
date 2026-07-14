# Project Prism — Data Correctness Pass (pre-CI/CD)

## Context

A post-remediation code sweep (July 2026, after Phases 1/2/4.4/4.5 of `REMEDIATION_PLAN.md`
shipped) found a cluster of correctness bugs that mean **numbers shown on the live dashboard are
wrong today**, plus a set of small trust/UX fixes. This pass fixes those before CI/CD work
(REMEDIATION_PLAN 4.1–4.2), following the project's standing rule: trust in the numbers first.

Every finding below was verified against the actual code (file:line refs current as of commit
`c1e94d2`). All are independent of the remaining REMEDIATION_PLAN phases.

**Key repo facts the executing agent needs:**
- Two sub-projects: `functions/` (TS, Node 20, ESM — internal imports use `.js` extensions) and
  `hosting/` (Vite + React 18, `@/` → `src/`). Build: `cd functions && npm run build && npm test`;
  `cd hosting && npm run build`.
- Production data source is **BigQuery via Fivetran** (columns are lowercase snake_case), pulled
  by `fetchFromBigQuery` / the scheduler. CSV upload is the secondary path.
- Deploy from a feature branch, verify in prod (Brad runs an analysis + exports logs), then merge.
  Firebase account: `brad.towers@simprogroup.com`. No PRs — merge locally, commit, push.
- Deterministic deal metrics live in `functions/src/util/dealMetrics.ts`; they consume
  `lastActivityDate`, `updatedDate`, `nextStep` from `OpportunityRecord`.

---

## Tier 1 — Correctness bugs (the data is wrong)

### T1.1 Fix BigQuery field mapping — deal-health inputs resolve empty/wrong on the primary data source
**Problem:** `functions/src/pipeline/bigquerySource.ts:48-59`:
- `updatedDate: ["_fivetran_synced", "LastModifiedDate", "Last_Modified_Date"]` — `_fivetran_synced`
  is the Fivetran sync timestamp (effectively "now" on every run), not Salesforce
  LastModifiedDate. It feeds `daysSinceLastModified` → stage-age stall detection in
  `dealMetrics.ts`, which therefore can never fire.
- `lastActivityDate: ["LastActivityDate", "Last_Activity_Date"]`, `nextStep: ["NextStep",
  "Next_Step"]`, `billingState`, `billingCountry` list only CamelCase names — but Fivetran
  lowercases to snake_case, so these resolve **empty** on the production table. Result: nearly
  every BQ deal classifies `activityHealth: "cooling"`, `velocity: "slowing"`, never stalled,
  and the dashboard shows the hardcoded fallback days-stalled.

**Fix:**
- Reorder `updatedDate` to prefer the real column: `["last_modified_date", "LastModifiedDate",
  "Last_Modified_Date", "_fivetran_synced"]` (keep `_fivetran_synced` as last-resort fallback).
- Add lowercase snake_case candidates as the FIRST entry of each affected field:
  `last_activity_date`, `next_step`, `billing_state`, `billing_country`.
- **Verify against the real schema first**: the repo already has the planned INFORMATION_SCHEMA
  discovery approach (see memory/BQ notes — `LastModifiedDate` was previously found missing from
  the table, which is why ORDER BY was removed). Before hardcoding candidates, run the pipeline
  once with diagnostic logging of `Object.keys(row)` on the first row (or have Brad run
  `SELECT column_name FROM \`<project>.<dataset>\`.INFORMATION_SCHEMA.COLUMNS WHERE table_name='<table>'`)
  and match candidates to columns that actually exist. If `last_modified_date` genuinely doesn't
  exist in the table, document that and keep `_fivetran_synced` with a code comment explaining
  the known distortion.

**Accept when:** a prod run's logs show non-null `lastActivityDate`/`nextStep` for most records;
the Activity Health widget shows a realistic spread across buckets (not ~everything "cooling");
days-stalled figures vary per deal instead of a constant fallback.

### T1.2 Fix AU/NZ region collision in the transformer
**Problem:** `functions/src/transforms/reportTransformer.ts:139-142` writes
`result[normalizeRegionKey(key)] = transformRegion(...)`, and `normalizeRegionKey` (:438+) maps
both `au` and `nz` to `"au"`, while `csvParser.ts:352-353` emits them as distinct region keys.
When both exist in a run, the last one iterated **overwrites** the other — the AU dashboard tab
shows only AU or only NZ stats/funnel/themes. (Global view and deals subcollection unaffected.)

**Fix:** when the normalized key already exists in `result`, **merge** the region reports before
transforming (sum counts/values, concatenate arrays, recompute rates weighted by deal count) —
or pre-merge the raw `report.regions` entries that normalize to the same key and transform once.
Pre-merging raw regions is the cleaner option (one code path).

**Accept when:** a CSV containing both AU and NZ deals produces an AU tab whose total deal count
equals AU+NZ, and a unit test covers the merge.

### T1.3 Replace the fabricated ProcessingFooter with real run telemetry
**Problem:** `hosting/src/components/layout/ProcessingFooter.tsx:16-31` hardcodes
"347 opportunities analyzed", "Claude Opus 4 · 42s processing", "Feb 3, 2026 at 06:00 UTC" and an
87% data-quality bar — rendered unconditionally on the live dashboard (`App.tsx`, last widget).
Invented telemetry presented as real, on a tool whose pitch is trustworthy numbers.

**Fix:** thread real fields from the report doc into `ProcessingFooter` props: records processed
(`recordsProcessed`/deal count), provider + model, report `createdAt`/`generatedAt`, and the real
data-quality score (`dataQuality` on the report, which exists on `AggregatedReport`). If a field
isn't available on the frontend report shape, add it to the transformer output. Hide the footer
entirely when showing sample data. (This is display-only wiring; the fuller per-phase enrichment
status remains REMEDIATION_PLAN 4.3.)

**Accept when:** the footer figures match the corresponding `/reports/{date}` and
`/executions/{id}` values for the current run, and no hardcoded constants remain.

### T1.4 Remove (or gate) the permanently-empty Win/Loss Themes widgets
**Problem:** `functions/src/analysis/aggregator.ts:252-253` deliberately stubs theme extraction to
`[]` ("themes field removed — only active deals analyzed, win/loss theme extraction unused") —
the pipeline analyzes open opportunities only, so win/loss themes have no source data. But the
dashboard still renders Win Themes and Loss Themes panels that are empty on every run.

**Fix (decision made — remove, don't wire):** since the data source filters to open deals,
win/loss themes cannot be populated. Remove the two theme panels from `App.tsx`'s 3-col grid
(keep Market Signals; adjust the grid), and delete the now-dead `topWinThemes`/`topLossThemes`
plumbing in the transformer/frontend types **only if** trivially separable — otherwise leave the
fields empty and just drop the UI. Note the removal in ONBOARDING.md's backlog ("re-add if a
closed-deal analysis source is introduced").

**Accept when:** no permanently-empty widgets render; frontend builds clean.

### T1.5 Fix `accountName` mapped to the opportunity-name column
**Problem:** `functions/src/pipeline/csvParser.ts:578` — default mapping sets
`accountName: "Opportunity_Name"`, so every CSV record's account name is the opportunity name
(shown on risk cards, used in PII detection and priority-5 region matching). An `"Account_Name"`
entry already exists in `COLUMN_ALTERNATIVES` but is unused.

**Fix:** set `accountName: "Account_Name"` in `getDefaultSalesforceMapping()`; confirm
`COLUMN_ALTERNATIVES` covers the real export's header variants. Check the BigQuery field map has
a sensible `accountName` candidate list too (add `account_name` if missing).

**Accept when:** parsing `test-data/sample-opportunities.csv` yields distinct
accountName/opportunityName where the CSV has both columns.

---

## Tier 2 — Quick trust/UX wins

### T2.1 Stop the "No live data yet" flash on load
**Problem:** `hosting/src/App.tsx:132` gates the empty state on `!showingContent` only; while the
Firestore query is in flight (`loading === true`), returning users see the "upload your first
CSV" call-to-action before the dashboard pops in.

**Fix:** gate the empty state on `!loading && !showingContent`; while loading, render a simple
skeleton/centered spinner in the content area (reuse the existing loading style).

### T2.2 Rename the mislabeled "Revenue at Risk" stat card
**Problem:** the card titled "Revenue at Risk" (`hosting/src/components/dashboard/StatsRow.tsx:40`)
displays a **deal count** (`reportTransformer.ts:168-173` emits a count string; `App.tsx:89` sets
a count in filtered mode) with count-based color bands.

**Fix (minimal):** retitle to "Deals at Risk" (and retitle/differentiate the existing
percentage card, e.g. "% of Pipeline at Risk") — do NOT try to compute real at-risk revenue in
this pass. Keep color bands consistent with a count.

### T2.3 Handle UTF-8 BOM in CSV parsing
**Problem:** `functions/src/pipeline/csvParser.ts:34` calls `parse()` without `bom: true`;
BOM-prefixed Salesforce exports corrupt the first header (`﻿Opportunity_ID`), every row then
fails validation, and the upload silently produces zero analyses.

**Fix:** add `bom: true` to the parse options. Add a unit test parsing a BOM-prefixed fixture.

### T2.4 Confirmation dialog on "Run Analysis"
**Problem:** `hosting/src/components/layout/Header.tsx:35-67` — one click fires a full billable
BigQuery + multi-phase LLM run (minutes of wall-clock, real cost, same-day report overwrite risk).

**Fix:** add a lightweight confirm step (inline "Run full analysis? Takes ~5 min and re-generates
today's report. [Run] [Cancel]" — a small popover or two-click confirm on the same button is
fine; no new modal framework). Keep the existing run-state feedback.

### T2.5 Align panel-header meta counts with widget-body definitions
**Problem:** `App.tsx` computes header meta strings with different predicates than the widgets:
- Forecast Integrity: `App.tsx:201` counts `confidence > 60 && healthScore < 40`, widget
  (`ForecastIntegrity.tsx:17-19`) also includes `riskLevel === 'HIGH'` — header and body disagree.
- Activity Health: `App.tsx:198` labels all `daysStalled >= 14` "dormant", widget
  (`ActivityHealth.tsx:22-27`) splits dormant (14–29) vs dark (30+).

**Fix:** export the classification helpers from each widget module (or a small
`hosting/src/lib/dealClassifiers.ts`) and use them in both places. One definition per concept.

---

## Explicitly deferred (Tier 3 — note, don't do now)

Log these in ONBOARDING.md's backlog if not already implied: Firestore retention/TTL for
`/analyses/*` and `/executions/*`; Retry-After-aware rate-limit backoff (currently fixed 60s);
region substring false positives ("restaurant" → au); locale-aware `parseAmount` (European
formats corrupt 1000×); PII regex over-matching + detect/scrub field mismatch; BigQuery WHERE
clause hardcoding columns outside the field map; modal/card keyboard + screen-reader
accessibility; RiskRadar "Show all" virtualization; enrichment widgets vanishing silently
(placeholder empty states — complements 4.3); stale "Every Monday" comment in `index.ts:205-208`
(fix opportunistically if touching that file).

---

## Execution order & dependencies

1. **T1.1 first, alone** — it needs schema discovery against the real BigQuery table and its own
   prod verification run (this is the finding most likely to visibly change dashboard output).
2. Then the remaining backend fixes as one batch: T1.2, T1.5, T2.3 (all csvParser/transformer,
   all unit-testable locally).
3. Then the frontend batch: T1.3, T1.4, T2.1, T2.2, T2.4, T2.5.
4. Single feature branch (`fix/data-correctness`) is fine for 2–3; T1.1 may warrant its own
   branch + deploy + verification first since its effect on prod output is the largest.

## Verification

1. `cd functions && npm run build && npm test` — green, with new tests for the region merge (T1.2),
   BOM fixture (T2.3), and accountName mapping (T1.5).
2. `cd hosting && npm run build` — green.
3. Emulator run on `test-data/sample-opportunities.csv`: AU tab shows AU+NZ combined; account
   names differ from opportunity names; no theme panels; footer shows real (emulator) run values.
4. **Prod verification (the important one, after T1.1 deploys from branch):** Brad triggers Run
   Analysis, exports logs; confirm non-null `lastActivityDate`/`nextStep` mapping, realistic
   Activity Health distribution, per-deal days-stalled variation. Compare before/after report docs.
5. Merge to main only after prod verification, per repo convention.

## Out of scope for the executing agent
- Running the INFORMATION_SCHEMA query against the production BigQuery table (Brad, or via a
  deployed diagnostic log line).
- Judging whether the post-T1.1 Activity Health distribution "looks right" — Brad sanity-checks
  against known deals.
