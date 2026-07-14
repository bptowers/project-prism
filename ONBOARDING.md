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

The frontend auto-connects to the emulators in dev mode. **Access requires a Google sign-in with
a verified company-domain email** — an `AuthGate` (`hosting/src/components/auth/AuthGate.tsx`) blocks
the app until you sign in with an allowlisted account. Against the Auth emulator, `signInWithPopup`
shows a fake account chooser where you can type any test email (e.g. `test@simprogroup.com`).
Anonymous auth was removed — do **not** reintroduce it (see the auth model note below).

LLM API keys are **not** kept in plain env in production; they live in **Firebase Secret Manager**.
Locally, `functions/.env` is fine. See [CLAUDE.md](CLAUDE.md) → Environment Variables. Two tuning
values that bite if wrong: `LLM_MAX_TOKENS` (keep high — Gemini's hidden thinking tokens count
against it; too low silently truncates enrichment output) and `LLM_CONCURRENCY` (global cap on
simultaneous LLM calls; prod uses 40 — it must keep a full run inside the 540s function timeout).

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

- **Auth model — company-domain Google sign-in only.** The dashboard is gated to verified
  Google accounts on an allowlist of domains (`simprogroup.com`, `simpro.us`, `simpro.au`,
  `bigchange.com`). This is enforced in **four** places that must stay in sync: the frontend
  gate + backend `requireAuth`, and the `allowed()` regex in `firestore.rules` and `storage.rules`
  (canonical list: `hosting/src/lib/allowedDomains.ts`). **To add a domain, edit all four and
  redeploy rules + functions + hosting.** The Google provider must stay enabled and Anonymous
  must stay disabled in the Firebase console (Authentication → Sign-in method) — re-enabling
  anonymous would expose all revenue data to any browser session.

- **Log inspection.** Firebase console → Functions → Logs, or filter by `textPayload`. Useful lines:
  - `Fetched N records from BigQuery`
  - `Analysis complete: N successes, M failures`
  - `[writeDealsSubcollection] wrote N deals to /reports/{date}/deals`
  - `[trimReportForStorage] report size=… bytes` (watch this approach 1,048,576)

---

## Before you take ownership — governance checklist

Prism handles revenue and customer-adjacent data and is moving to team ownership. Treat these as
gating, not optional, and complete them before RevOps relies on the tool:

- [ ] **Post in `#simpro-internal-ai-created-tooling`** announcing the tool, its owner, and its purpose.
- [ ] **Obtain IT sign-off** for an internal tool touching revenue data (the auth change and hosting
      on the Simpro Firebase org account are the relevant safeguards to cite).
- [ ] **Name a primary owner and a backup owner.** Whoever owns it owns support; IT is advisory only.
- [ ] **Confirm the deploy account** (`brad.towers@simprogroup.com`) is transferred or a new owner
      is granted deploy access to `project-prism-489108-a9e2b`.
- [ ] **Confirm auth config** in the Firebase console: Google provider enabled, Anonymous disabled.

## What's already been done (remediation status)

A pre-handover review produced a phased remediation plan (`docs/REMEDIATION_PLAN.md`). Completed:

- **Phase 1 — trust the numbers:** enrichment phases grounded in real per-deal data; output-token
  limits raised; structured outputs with explicit failure instead of fake default scores;
  deterministic classifications computed in code (`util/dealMetrics.ts`); prompt caching.
- **Phase 2 — backend architecture:** the three write paths consolidated into one
  `processAndStoreReport` orchestrator; a single global concurrency limiter; a clean
  `provider.complete()` interface for portfolio prompts; same-day collision guard; token/cost tracking.
- **Phase 4.4 — auth:** anonymous sign-in replaced with domain-restricted Google sign-in (above).

## Deferred backlog (for the new owner)

None are blocking; all improve maintainability:

- **Shared frontend utils** — `formatCurrency` (×4) and `normalizeStage` (×2) are duplicated across
  dashboard components. Pull into `hosting/src/lib/dealUtils.ts`.
- **Split `RiskRadar.tsx`** (~1k lines) once the helpers above are extracted.
- **Strict frontend tsconfig** — enable `noUnusedLocals` / `noUnusedParameters` (backend already has them).
- **Shared type contract (Phase 3)** — frontend types, backend types, and the transformer each
  redefine the same shapes (this also duplicates the two TS allowlist copies). A single shared
  interface the transformer output `satisfies` would catch drift at compile time.
- **CI/CD + lint config (Phase 4)** — Jest tests exist on the backend now, but there's no
  `.github/workflows` pipeline and no `hosting/` ESLint. Wiring CI needs Brad to create a Firebase
  deploy secret in GitHub and move `LLM_CONCURRENCY=40` into the CI/deploy config (it currently
  only lives in the git-ignored `functions/.env`).
- **Node 22 bump** — Node 20 is decommissioned 2026-10-30; update `package.json` engines + `firebase.json` runtime before then.

## Paused ideas (not started)

- **PPTX / PDF export** of the dashboard for exec distribution (recommended approach: `pptxgenjs`, client-side).
- **Clari Copilot "Dig Deeper"** — per-deal call summaries/topics in the Deal Detail Modal. API credentials are ready.

---

*Questions for the outgoing owner: Brad Towers (brad.towers@simprogroup.com).*
