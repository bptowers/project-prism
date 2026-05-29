# Project Prism — Onboarding (Start Here)

Welcome. You're taking ownership of **Project Prism**, a Global Revenue Intelligence Engine.
This page is the day-one entry point: how to run it, how to ship it, and the gotchas that
aren't obvious from the code. For depth, follow the links — don't expect this page to repeat them.

---

## What this is

Prism ingests Salesforce opportunity data, runs it through an LLM (Claude / Gemini / OpenAI),
and produces a structured revenue-intelligence dashboard — deal risk, pipeline health,
competitive signals, and CRO-level questions. It's a **React dashboard** (`hosting/`) backed by
**Firebase Cloud Functions** (`functions/`), with **Firestore** as the store and **BigQuery** as
the upstream data source.

---

## Read these in order

1. **This file** — orientation, quick start, operational gotchas.
2. **[CLAUDE.md](CLAUDE.md)** — technical conventions, architecture, pipeline internals, Firestore schema. The single most detailed technical reference.
3. **[docs/Project-Prism-Handover-v5.md](docs/Project-Prism-Handover-v5.md)** — strategic context (why this exists, Pete's CRO framing), the risk-signal taxonomy, and the prompt-engineering guide.
4. **[docs/prism-dashboard-reference-guide.docx](docs/prism-dashboard-reference-guide.docx)** — what each dashboard widget means and why it's there (good for talking to RevOps / leadership).

---

## Quick start (local)

```bash
# 1. Install both sub-projects
cd functions && npm install
cd ../hosting && npm install

# 2. Configure env (copy and fill in)
cp functions/.env.example functions/.env     # LLM keys, BigQuery config
cp hosting/.env.example hosting/.env          # VITE_FIREBASE_* config

# 3. Run the full stack locally
#    Terminal A — Firebase emulators (functions + Firestore + auth + storage):
npm run serve            # from repo root
#    Terminal B — Vite dev server:
cd hosting && npm run dev
```

The frontend auto-connects to the emulators in dev mode and **signs in anonymously** on load
(`hosting/src/lib/firebase.ts`). Anonymous auth is sufficient for the dashboard — that's by design.

LLM API keys are **not** kept in plain env in production; they live in **Firebase Secret Manager**.
Locally, `functions/.env` is fine. See [CLAUDE.md](CLAUDE.md) → Environment Variables.

---

## Deploy

```bash
firebase deploy                 # builds BOTH (predeploy hooks) and deploys everything
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only storage  # storage.rules only
```

⚠️ **Account gotcha:** Prism's Firebase project (`project-prism-489108-a9e2b`) is on
**`brad.towers@simprogroup.com`**, not a personal Google account. Run `firebase login` and confirm
the active account before deploying, or you'll deploy to the wrong project (or fail).

**Team practice:** deploy from a feature branch and verify in production *before* merging to main.

---

## Operational runbook / gotchas

These were learned the hard way — read before you debug.

- **Cloud Run invoker 401.** Every HTTP function (`onRequest`) must declare `invoker: "public"`
  in its config. A deploy can otherwise strip the public-invoker IAM binding, and then *every*
  dashboard button (Run Analysis, upload, report fetch) returns **401 before the code even runs**.
  Security is still enforced — each function has app-level `requireAuth` checking a Firebase ID token.
  If buttons suddenly 401 after a deploy, check this first.

- **GCP Scheduler 401.** The scheduled `runWeeklyAnalysis` trigger (cron `0 6 */3 * *`, every 3 days)
  has had token-verification 401s — a separate IAM issue from the invoker one. If the dashboard's
  "last run" looks stale, just trigger a fresh run from the **Run Analysis** button in the dashboard
  (that path is authenticated through the frontend and works reliably).

- **Gemini "No JSON found in response" is non-fatal.** A handful of these per run is normal — that
  deal is skipped and the run still completes (e.g. "Analysis complete: 271 successes, 0 failures").
  Don't treat it as a broken run.

- **Firestore 1 MiB limit → deals subcollection.** Per-deal records live in
  `/reports/{date}/deals/{opportunityId}`, written *before* the main doc is trimmed. The main
  `/reports/{date}` doc holds aggregates only. `hosting/src/hooks/useFirestore.ts` re-merges the
  subcollection into the report at read time. **Do not** re-embed the full deal array in the main
  doc — that's the bug the subcollection migration fixed (it was silently capping at ~150 deals).

- **Log inspection.** Firebase console → Functions → Logs, or filter by `textPayload`. Useful lines:
  - `Fetched N records from BigQuery`
  - `Analysis complete: N successes, M failures`
  - `[writeDealsSubcollection] wrote N deals to /reports/{date}/deals`
  - `[trimReportForStorage] report size=… bytes` (watch this approach 1,048,576)

---

## Deferred backlog (for the new owner)

From a pre-handover code review. None are blocking; all improve maintainability:

- **Backend write-path consolidation** — `functions/src/index.ts` has 3 near-identical write paths
  (`onCSVUpload`, `runWeeklyAnalysis`, `fetchFromBigQuery`). Extract one shared `persistReport` helper
  so a fix lands once, not three times.
- **Shared frontend utils** — `formatCurrency` (×4) and `normalizeStage` (×2) are duplicated across
  dashboard components. Pull into `hosting/src/lib/dealUtils.ts`.
- **Split `RiskRadar.tsx`** (~1k lines) once the helpers above are extracted.
- **Strict frontend tsconfig** — enable `noUnusedLocals` / `noUnusedParameters` (backend already has them).
- **Type drift** — frontend types, backend types, and the transformer each redefine the same shapes.
  Make the transformer output `satisfies` a single shared interface to catch drift at compile time.
- **ESLint config + first unit tests** — devDeps are installed but there's no `.eslintrc` and no tests.
- **Node 22 bump** — Node 20 is decommissioned 2026-10-30; update `package.json` engines + `firebase.json` runtime before then.

## Paused ideas (not started)

- **PPTX / PDF export** of the dashboard for exec distribution (recommended approach: `pptxgenjs`, client-side).
- **Clari Copilot "Dig Deeper"** — per-deal call summaries/topics in the Deal Detail Modal. API credentials are ready.

---

*Questions for the outgoing owner: Brad Towers (brad.towers@simprogroup.com).*
