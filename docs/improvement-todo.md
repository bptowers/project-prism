# Project Prism — Dashboard Improvement Backlog

Status: 🔲 Pending | 🔄 In Progress | ✅ Done

---

## Priority 1 — Top Picks (highest value)

- ✅ **Run trigger button** — "Run Analysis" button in Header that calls `/api/bigquery` so you don't need the GCP console
- ✅ **Rep performance heatmap** — table of reps ranked by avg health score with deal count, at-risk count, pipeline value
- ✅ **Data freshness indicator** — show "Last run X ago" relative time in the Header

## Priority 2 — Quick Wins

- ✅ **Color-adaptive stat tiles** — Avg Health Score tile shifts red/amber/green based on value (currently always green)
- ✅ **AI Briefing text highlights** — bold key numbers in the briefing prose for faster scanning
- ✅ **Deal Velocity → Avg Days Stalled** — replace the dead "—" velocity tile with a real metric computed from daysStalled
- ✅ **Delta badge on Risk Radar** — small "X deals moved to Red since last run" badge at the top of Risk Radar

## Priority 3 — Medium Effort

- ✅ **Revenue Confidence arc/gauge** — replace the bare number with a visual arc/gauge chart
- ✅ **Stage conversion rates in funnel** — add drop-off % between stages in PipelineFunnel
- ✅ **Action tracking on deal cards** — "Mark as reviewed" toggle per deal, persisted in localStorage (Firestore upgrade in Future section)
- ✅ **Drill-through from stat tiles** — clicking "Revenue at Risk" jumps to Risk Radar filtered to HIGH+MEDIUM

## Priority 4 — Larger Scope

- ✅ **Export filtered deals to CSV** — download the currently filtered deal set with health scores and actions

---

## Future / Architectural Work

- 🔲 **Show all 273 deals in Risk Radar (Firestore subcollection migration)** — currently capped at ~50 deals per region (~150 total) due to Firestore's 1MB document size limit. Fix requires moving individual deal records out of the main report document into a `/reports/{date}/deals/{opportunityId}` subcollection. Main document stays small (aggregates only); dashboard fetches deals separately. Removes the cap entirely. Est. half a day. Do as a standalone backend session — do not combine with visual work.
