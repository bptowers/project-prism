# UX Streamline: Design

**Date:** 15 Oct 2026
**Branch:** `feat/ux-streamline` (stacked on `fix/briefing-figures-in-code`)
**Clickable mockup:** https://claude.ai/artifact/YNkSmG2GVHAsFLgZJDLdRq (sample data; all five tabs, light and dark)

## Why

The dashboard is one long page of about 14 stacked sections. Each has a title but
nothing says what question it answers or what to do about it. In practice it was
barely used: "too complex and too cumbersome".

**Success means the CRO and geo managers open Prism daily and act on it.** Every
choice below is judged by "does this make it simpler for them to act?" No existing
capability is removed; it is relocated.

## Users and usage

- **CRO:** portfolio view, forecast-call prep, the deals that need them personally.
- **Geo managers (NA, UK, AU/NZ):** their region, their reps, the work queue.
- **Cadence:** opened daily, but the pipeline runs every 3 days (`0 6 */3 * *`, unchanged by
  decision). Daily visits must still be worthwhile: freshness is stated plainly, the review
  queue gives daily work, and "Since last run" surfaces change when a new run lands.

## Navigation and state

- Header (unchanged) and below it a **sticky bar** with:
  - **Region selector**: All · North America · UK · AU/NZ, each with its deal count.
  - **Tabs, in this order:** Overview · CRO Brief · Deals · Pipeline Health · Competition & Change.
- **One source of truth.** A new `useDashboardView` hook owns `tab`, `region` and the Deals
  filters (`rep`, `stage`, `band`, `activity`, `riskOnly`, `lateOnly`, `hideReviewed`). It keeps
  them in the URL hash, e.g. `#deals?region=uk&rep=S.%20Hughes&activity=dormant`.
  - Links are shareable, and browser back/forward moves between views.
  - The last region is remembered per browser and used when the URL has none.
  - No router library: a small `hashchange` listener.
- **This fixes a current bug-in-spirit:** Risk Radar has its own region chips and always
  works from all deals, while the region tabs drive only the stats. After this change the
  sticky selector is the **only** region control, and every tab reads the same filtered deals.
- **Click-throughs:**

  | Click | Goes to |
  |---|---|
  | KPI tile | Deals tab, filtered to match (e.g. "At risk" → at-risk only) |
  | Bubble on the risk map | Deal detail popup (existing `DealDetailModal`) |
  | Region card | Selects that region; clicking again returns to All |
  | Stage bar (Risk by stage) | Deals, filtered to that stage |
  | Activity bucket | Deals, filtered to that bucket |
  | Rep heatmap row | Deals, filtered to that rep |
  | "Since last run" strip | Competition & Change tab |

## Panel pattern

Every panel gets the same header:

1. Small uppercase label (e.g. "ACTIVITY HEALTH")
2. A plain-English **question** ("Are reps still working these deals?")
3. A one-line **takeaway** computed **in code** from the deals in view
   ("14 deals worth $212k have been quiet for 14+ days."), never from the LLM.
   This follows the project rule that numbers come from code and prose from the LLM.

Takeaway builders live in one pure module (`hosting/src/lib/takeaways.ts`) so they're easy to unit test.

## Tabs

### Overview (landing page, about 1.5 screens)

1. **Since last run** strip: ↓ got worse · ↑ improved · newly at risk (counted from
   `deltaIntelligence`), plus "See what changed →".
2. **Briefing** clamped to 3 lines with "Read full briefing". When a region is selected
   it is labelled "Global briefing", with the note "Covers all regions, not just UK".
3. **Four KPI tiles:** Pipeline value · At risk (value + count + high) · Avg deal health ·
   Avg days since activity. "Deals at risk" and "% pipeline at risk" merge into one tile.
4. **Risk map** (bubble chart; x = days since activity, y = risk score, size = value; danger
   zone shaded) beside **risk drivers radar + revenue confidence gauge**.
   These are extracted from `RiskRadar.tsx` (`PipelineRiskMap`, `RiskDriversRadar`, gauge).
5. **Today's queue:** the top 5 late-stage deals by risk, each with a shared review button
   and progress ("2 of 5 reviewed").
6. **Region cards:** pipeline, at risk and confidence per region; clicking one filters.

**Only one confidence number lives on the Overview:** the code-computed revenue
confidence gauge. The AI's "Forecast Confidence" moves to Pipeline Health, labelled as the
AI's assessment.

### CRO Brief: "What do I need to push on this week?"

1. **Needs your intervention:** TWENTY_QUESTIONS question 10 rows (deal, action, deadline),
   with shared review buttons and progress.
2. **This week's actions:** Recommendations collapsed to one line each (priority, title,
   impact), P1 first; click to expand the description.
3. **CRO questions 1–9 as a card grid:** each card shows a code-computed count and value
   from its rows, the first 2 lines of the AI answer, and "View N →" to expand its table.
   Rows filter by the selected region; when a region is selected, a note says the written
   answers cover all regions. Deal names open the deal popup where they match a report deal.
4. **If enrichment didn't generate these sections**, say so plainly (existing `NotGeneratedPanel`).

### Deals: "Which deals need work, and who owns them?"

- The full list moved out of Risk Radar, with filters: **rep** (searchable dropdown, narrowed to
  the region), stage, risk band, activity bucket, late-stage only and hide reviewed, plus CSV export.
- Active filters show as removable chips.
- **Rep summary line** when a rep is selected: deals · pipeline · at risk · confidence vs region average.
- The rep filter is **not** on the Overview. A typical rep's 8–15 deals are too few for useful
  charts, and the Overview stays simple.

### Pipeline Health: "Where is the pipeline weak, and who needs help?"

- Risk by stage (stacked high/medium/low bars, clickable)
- Activity health (Active 0–6, Cooling 7–13, Dormant 14–29, Dark 30+; clickable)
- Forecast integrity (shaky Commit/Contract Review deals, plus the AI forecast confidence, labelled)
- Pipeline funnel
- Rep heatmap, full width, sorted worst-confidence first, clickable

### Competition & Change: "What moved, and who are we up against?"

1. **What changed** first: a direction badge; Got worse / Improved / Newly at risk columns,
   each deal with the reason it moved; early warnings.
2. **Competition:** one card per competitor: deals and value in view, where they win, counter-play.

## Shared deal reviews

"Mark reviewed" becomes a team signal instead of a per-browser flag.

- **Storage:** top-level `/dealReviews/{dealKey}` with fields
  `{ reviewedBy, reviewedByName, reviewedAt, riskAtReview }`.
  - `dealKey` is `opportunityId`, falling back to the deal name as today. It is encoded so
    `/` and other characters are safe in a document ID.
  - The UI listens to it with `onSnapshot`, so ticks appear live for everyone.
- **Persistence:** a tick stays until someone removes it (decided over resetting each run).
  - **Safeguard:** if the deal's current risk is higher than `riskAtReview`, the deal shows a
    **"Worse since review"** badge and counts as not done in queues.
- **Who:** any allowlisted user can tick or un-tick. The UI shows "✓ Reviewed by Brad Towers · 15 Oct 2026".
- **Security rules:** the first client-writable path in `firestore.rules`.
  - read: `allowed()`
  - create/update: `allowed()`, plus all of:
    - `request.resource.data.reviewedBy == request.auth.token.email`
    - `reviewedAt == request.time`
    - `riskAtReview` is a number from 0 to 100
    - `keys().hasOnly([...the four fields])`
  - delete: `allowed()`
  - Everything else stays `allow write: if false`.
- **Migration:** today's localStorage ticks (`prism-deal-reviews`) are not migrated; the key is retired.

## Theme

Light by default, with dark mode via the existing header toggle.
- **Change:** `ThemeProvider.getInitialTheme` currently follows the OS
  `prefers-color-scheme` on first visit. It will return the stored choice, otherwise `'light'`.
- **Cleanup:** remove the OS-change listener. It's dead code, because the effect always writes localStorage.
- **New colours:** all new UI uses the existing CSS variables in `global.css`. A few text tokens
  for coloured text on tinted backgrounds are added for both themes so contrast holds in dark mode
  (the mockup has the values).

## Honesty rules (carried over)

- Aggregate figures and takeaways are computed in code. LLM prose is shown as prose and
  labelled "global" when a region filter can't apply to it.
- No invented values: empty states say what's missing ("CRO questions weren't generated for this run").
- Dates render as "15 Oct 2026".

## Out of scope

- Changing the run cadence (stays every 3 days).
- Per-region AI briefings (a backend prompt change).
- Notifications (email/Slack nudges after a run).
- New charts. Everything reuses or splits existing widgets.

## Testing

- **Unit (vitest):**
  - the takeaway builders
  - `useDashboardView` URL parse/serialise and round-trip
  - deal filtering (region, rep, stage, band, activity)
  - the "worse since review" rule
  - the theme default
- **Component:**
  - each tab renders with live-shaped data and with the enrichment sections missing
  - existing widget tests keep passing
- **Security rules:** add `@firebase/rules-unit-testing` against the Firestore emulator.
  - an allowed user can write their own review
  - writes are rejected for: off-domain users, someone else's email, extra fields
  - writes to `/reports` stay denied
- **Manual:** each tab in light and dark, at desktop and phone width, against a real report
  via the emulator, then on the production deploy before merging.

## Rollout

1. `fix/briefing-figures-in-code`: deploy functions, verify, merge to `main`.
2. `feat/ux-streamline`:
   - push (as `bptowers`)
   - `firebase deploy --only hosting,firestore:rules` (as `brad.towers@simprogroup.com`)
   - verify in production
   - merge to `main`
