# Project Prism — Intelligence Architecture & System Prompt Strategy

**Author:** Brad Towers (SE Lead, UK/ANZ) + AI Strategy Partner
**Date:** 11 February 2026
**Status:** Living Document — Update as platform evolves
**Classification:** Internal / Confidential

---

## 1. What These Reports Actually Reveal

Before building further, we need to be honest about what Steve's Salesforce extracts tell us — and more importantly, what they tell us about the *opportunity* for Prism.

### The Data Quality Crisis Is Our Moat

The February 2026 reports expose a brutal truth: 97% of Simpro's 861 in-flight opportunities have zero documented deal strategy. No Close Plans. No Path to Purchase. No "Why Would They Buy From Us." Only ~3% have Deal Takeaways captured.

Most teams would see this as a problem. For Prism, it's the reason we exist.

A human being cannot read 861 opportunity records, cross-reference manager notes with stage velocity, correlate loss reasons with competitor mentions, and surface the three deals that need executive intervention — all before Monday's pipeline call. An LLM can.

But here's what makes Prism genuinely different from any BI dashboard or Salesforce report: we're not summarising data. We're *inferring intelligence from absence.* The most important signal in Simpro's pipeline isn't what's documented — it's what's missing.

### The Intelligence Pyramid

Think of it in three tiers:

**Tier 1 — Surface Intelligence (any dashboard can do this):**
Deal counts, revenue by region, stage distribution, win/loss ratios.

**Tier 2 — Pattern Intelligence (good analytics tools do this):**
Stage velocity trends, competitor win rates, seasonal patterns, rep performance metrics.

**Tier 3 — Inference Intelligence (what Prism must do):**
Reading between the lines. Detecting risk from *silence.* Identifying deals that *look* healthy but exhibit the same fingerprint as past losses. Connecting a pricing objection in the UK to a competitor's go-to-market shift in ANZ. Recognising that a "Too Small" loss pattern isn't a qualification problem — it's a product-market fit signal that should flow to Product.

Prism's value is Tier 3. Everything we build — every system prompt, every analysis pipeline — should be engineered to surface Tier 3 intelligence.

---

## 2. Non-Obvious Intelligence Connections

These are the signals that a CRO would never think to ask for, but would immediately act on if surfaced. Each one should inform our system prompt design.

### 2.1 The Ghost Fingerprint

Three February deals (Premier Roofing, Stillorgan Gas, ASRC Cleaning) exhibit "ghosting" — prospects going dark after receiving proposals or contracts. Most systems flag this as a simple stall.

**The non-obvious connection:** Ghost behaviour correlates with *deal size relative to prospect company size.* When the annual contract value exceeds roughly 2-3% of estimated prospect revenue, decision paralysis sets in. The prospect isn't ghosting because they're not interested — they're ghosting because the purchase is big enough to require board/partner approval they haven't secured yet.

**What Prism should surface:** "This deal's ACV appears to exceed the prospect's typical unilateral purchasing authority. The ghosting pattern matches 73% of deals that eventually close — but only when a new stakeholder (CFO, board member, business partner) is introduced. Recommend multi-threading to an economic buyer above your current champion."

**System prompt instruction:** When a deal shows 14+ days of no activity after a proposal/quote delivery, cross-reference the deal value against company size indicators. If the ratio suggests the deal exceeds likely unilateral authority, recommend stakeholder expansion rather than simple follow-up.

### 2.2 The Boomerang Signal

Normac Plumbing returned to Simpro after leaving for Ascora. This isn't just a nice win story — it's a *strategic intelligence asset* that most teams never systematically exploit.

**The non-obvious connection:** Every "Closed Lost to Competitor X" deal has a boomerang window — a period (typically 6-18 months) when the competitor's limitations become apparent and the prospect is open to returning. The trigger is usually a specific friction point: failed data migration, missing integrations, scaling limitations, poor support.

**What Prism should surface:** A "Boomerang Radar" — deals lost to Ascora/ServiceM8/Tradify 6-18 months ago, ranked by likelihood of return based on the competitor's known weaknesses matching the original prospect's stated requirements.

**System prompt instruction:** For every Closed Lost opportunity, calculate the elapsed time since loss. Between 6-18 months, flag as "Boomerang Window Open." Cross-reference the original loss reason with known competitor weaknesses. If the prospect's original pain points align with the competitor's documented limitations, generate a re-engagement brief with specific talking points.

### 2.3 Competitive Contagion Mapping

Ascora wins in a specific geography (say, Melbourne metro plumbing) tend to generate a cluster of additional Ascora mentions in nearby prospects within 4-8 weeks. This isn't coincidence — it's word-of-mouth contagion through trade networks, supplier relationships, and industry associations.

**The non-obvious connection:** Competitive threats spread geographically and by trade vertical, not randomly. A single Ascora win in electrical contractors in Birmingham could indicate an incoming wave of Ascora mentions across West Midlands electrical companies.

**What Prism should surface:** "Ascora has won 3 deals in [Melbourne / Plumbing] in the last 6 weeks. Historically, this precedes a 2.4x increase in Ascora competitive mentions in the same geo/vertical cluster within 8 weeks. 12 open opportunities match this profile. Recommend proactive competitive positioning in these deals before Ascora is formally introduced."

**System prompt instruction:** Track competitive losses by geography and trade vertical. When a competitor wins 2+ deals in the same cluster within a 60-day window, identify all open opportunities in that cluster and flag for proactive competitive positioning.

### 2.4 Manager Attention as a Quantifiable Asset

The reports show that only 15% of opportunities have Manager Notes. But here's the question nobody's asking: what's the actual win rate of deals *with* Manager Notes versus *without*?

**The non-obvious connection:** Manager attention isn't just a hygiene metric — it's likely the single strongest predictor of deal outcome. Based on typical B2B SaaS benchmarks, manager-engaged deals often close at 2-3x the rate of unengaged deals. If that holds for Simpro (and we should validate this with historical data in Phase 1), this isn't a data quality issue — it's a resource allocation problem. Every Manager Note not written is revenue left on the table.

**What Prism should surface:** "Manager-engaged deals (notes within last 14 days) close at X% versus Y% for unengaged deals. Based on current pipeline, increasing manager coverage from 15% to 40% on $10K+ deals would yield an estimated $Z in additional closed revenue this quarter."

**System prompt instruction:** Calculate win rates segmented by manager engagement level. Quantify the revenue impact of the engagement gap. Present this not as a "data quality" problem but as an ROI argument: "Every hour of manager time invested in deal reviews generates approximately $X in incremental pipeline conversion."

### 2.5 The Implementation Anxiety Cascade

10% of losses cite implementation anxiety, and reviews mention words like "complex," "time commitment," "5 days onsite." But the non-obvious signal is that implementation anxiety *spreads within an organisation* — if one stakeholder raises it, it poisons the entire buying committee.

**The non-obvious connection:** When implementation concerns appear in deal notes, the next activity should NOT be a feature demo or pricing concession. It should be a reference call with a similar-size company that completed implementation successfully. Implementation anxiety is an *emotional* objection, not a rational one — it requires social proof, not data.

**What Prism should surface:** "Implementation anxiety detected in [Deal X] based on language in manager notes. Historical data shows that deals where implementation concerns are addressed with peer references close at 2.1x the rate of deals where concerns are addressed with pricing concessions or feature demos. Recommend scheduling reference call with [similar customer] within 5 business days."

**System prompt instruction:** Scan opportunity notes and manager comments for implementation anxiety language (complex, time commitment, risky, disruption, downtime, training burden, change management). When detected, recommend peer reference over pricing concession. Surface the most similar successful implementation as a reference match.

### 2.6 The Discount Decay Curve

Premier Roofing received a 5% discount with no traction. Fox Construction got 50% off SmartStart and still lost. This challenges a fundamental assumption in most sales organisations: that discounting accelerates closing.

**The non-obvious connection:** Discounts offered after a deal stalls are a *negative* signal. They communicate desperation rather than value. The data likely shows an inverse correlation: the deeper the discount on stalled deals, the lower the close rate. Discounts work when used *proactively* at the negotiation stage as a closing mechanism, not *reactively* as a recovery mechanism.

**What Prism should surface:** "A discount has been applied to [Deal X] after 21 days of stall. Analysis of 847 historical deals shows that reactive discounts (applied after 14+ days of stall) have a close rate of X%, compared to Y% for proactive discounts at negotiation stage. The optimal intervention for stalled deals is [specific action based on deal characteristics], not price reduction."

**System prompt instruction:** Distinguish between proactive discounts (applied at or near contract stage as closing mechanism) and reactive discounts (applied after stall as recovery mechanism). Track close rates for both. When a reactive discount is detected, flag it and recommend an alternative intervention based on the deal's specific stall characteristics.

### 2.7 The CFO Gate Pattern

The Precision Air Condition win explicitly noted that the CFO was the "ultimate gatekeeper" and that sales should ensure CFO involvement early. KSD Support Services ($477K) is stalling because the MD sees Simpro as "4x current solution cost" — a classic economic buyer objection that should have been addressed earlier.

**The non-obvious connection:** Deals above a certain ACV threshold that don't have an identified economic buyer by Solution Review stage have a dramatically lower close rate. The threshold varies by region and company size, but the pattern is consistent: if you reach Contract Review without the person who controls the budget being engaged, you're not actually in Contract Review — you're in "champion shopping for internal approval they haven't secured."

**What Prism should surface:** "Deal [X] ($Y value) has reached Contract Review without an identified Economic Buyer. Historically, deals of this size without economic buyer engagement by this stage close at Z% versus W% when the economic buyer is engaged. This deal exhibits the same pattern as [3 recent losses]. Recommend: Pause contract iteration. Coach AE to request a commercial alignment meeting with champion + CFO/MD before progressing."

**System prompt instruction:** For deals exceeding $25K ACV, check for economic buyer identification at each stage transition. If a deal reaches Solution Review or Contract Review without an economic buyer in the contact roles, generate a high-priority alert with historical close rate comparison.

### 2.8 The "Business Coach" Influence Signal

Billy Goat Plumbing's win specifically mentioned that the prospect's *business coach* emphasised data-driven decision-making. This external influencer was a hidden accelerator.

**The non-obvious connection:** Trade businesses increasingly use external business coaches, accountants, and industry consultants as informal advisory boards. These influencers are rarely tracked in Salesforce but can be the decisive factor. If a prospect mentions a business coach, accountant, or industry advisor, that person should be treated as a shadow decision-maker.

**What Prism should surface:** "External influencer detected in deal notes (business coach, accountant, consultant mention). Deals with identified external influencers that are positively engaged close at X% versus Y% baseline. Recommend: Ask champion for introduction to their business coach/accountant. Position Simpro as the tool their advisor would recommend."

**System prompt instruction:** Scan deal notes for mentions of external influencers (business coach, accountant, consultant, advisor, mentor, industry body). When detected, flag as a potential accelerator or blocker depending on sentiment. Recommend engagement strategy.

### 2.9 The Integration Ecosystem as a Closing Weapon

Three of four documented wins specifically cited integrations (Reece, Pro Plumbing Supplies, Xero) as the deciding factor. This isn't a feature — it's a competitive moat.

**The non-obvious connection:** Integration mentions in win notes are not just "nice to have" — they're the most frequently cited *closing trigger* in documented wins. Yet competitive deals rarely lead with integration ecosystem. AEs default to feature comparisons when the data says the winning conversation is about ecosystem.

**What Prism should surface:** "Integration ecosystem is mentioned as the closing trigger in X% of documented wins — making it the #1 win driver. However, only Y% of open opportunities have integration requirements documented. For deals competing against [Ascora/ServiceM8/Tradify], leading with integration ecosystem versus feature comparison increases win rate by Z%."

**System prompt instruction:** Correlate win reasons with integration mentions. For competitive deals, recommend leading with integration ecosystem positioning. For each prospect's industry vertical, surface the most relevant integrations (e.g., plumbing → Reece + supplier feeds; electrical → specific supplier integrations).

### 2.10 The Expansion Velocity Predictor

75% of January wins were expansion deals. But which *new logo* deals predict high expansion velocity? If we can identify the characteristics of first deals that lead to rapid expansion, we can inform both sales targeting and customer success investment.

**The non-obvious connection:** New logo deals with certain characteristics (multiple stakeholder engagement, documented integration requirements, champion who personally attended implementation) expand faster. First-deal characteristics are the earliest predictor of customer lifetime value — far earlier than NPS scores or support ticket volume.

**What Prism should surface:** "Based on expansion patterns, deals with [specific characteristics] expand an average of $X within 12 months. This new logo deal [Y] exhibits 4 of 5 high-expansion indicators. Recommend: Flag for CS priority onboarding. Schedule 90-day expansion review. Assign dedicated CSM."

**System prompt instruction:** Track new logo deal characteristics and correlate with first expansion timeline and value. Build a "expansion propensity score" for new deals based on historical patterns. Surface this score at Closed Won to inform CS prioritisation.

---

## 3. System Prompt Architecture

This section defines how we instruct the LLM to analyse raw Salesforce data. The system prompt is the brain of Prism — it determines what intelligence gets surfaced and what gets missed.

### 3.1 Core Analysis Prompt — Opportunity Level

For each individual opportunity, the LLM should be instructed to assess:

```
ROLE: You are a Chief Revenue Intelligence Officer analysing a single
sales opportunity. You have 20+ years of enterprise sales experience
and a deep understanding of B2B deal dynamics in field services
software. You think like a CRO who has seen thousands of deals —
you know what healthy deals look like and you can smell risk before
it shows up in the data.

TASK: Analyse this opportunity record and produce a structured
intelligence brief.

ANALYSIS FRAMEWORK:

1. DEAL HEALTH SCORE (0-100)
   Score based on:
   - Stage appropriateness for the close date (is there enough
     time to close?)
   - Data completeness (are key fields populated?)
   - Activity recency (when was the last meaningful activity?)
   - Stakeholder coverage (is an economic buyer identified?)
   - Competitive clarity (do we know who we're competing against?)

2. RISK SIGNALS (identify all that apply)
   - Ghost Signal: No activity in 14+ days after proposal/quote
   - Champion Risk: Single-threaded to one contact
   - Economic Buyer Gap: No CFO/MD/Owner identified for deals >$25K
   - Stage Compression: Close date too soon for current stage
   - Price Anchoring Risk: Discount already offered without
     documented negotiation
   - Competitive Blind Spot: No competitor identified for
     deals >$10K
   - Implementation Anxiety: Notes contain concern language about
     complexity, time, disruption
   - Partner Misalignment: Partner pricing or messaging conflicts
     with direct

3. INTELLIGENCE EXTRACTION
   From free-text fields (Manager Notes, Deal Takeaways, descriptions):
   - Buyer sentiment (enthusiastic / neutral / resistant / hostile)
   - Decision-making dynamic (single decision-maker / committee /
     unclear)
   - Buying trigger (what event or pain is driving urgency?)
   - Blocking factor (what could stop this deal?)
   - Competitive positioning (how is the competitor being framed?)
   - External influencer mentions (business coach, accountant,
     consultant)
   - Integration requirements mentioned

4. RECOMMENDED ACTIONS (prioritised, specific, time-bound)
   - What should the AE do in the next 48 hours?
   - What should the manager do this week?
   - Should an executive engage? If so, who and how?
   - Is there a reference customer that matches this prospect's
     profile?

5. HISTORICAL PATTERN MATCHING
   - Does this deal's profile match recent wins or recent losses?
   - Which specific closed deal (won or lost) is most similar?
   - What did the AE do differently in the similar win vs.
     similar loss?

OUTPUT: Structured JSON matching our OpportunityAnalysis schema.
Be direct. Be specific. Don't hedge with qualifiers — give the
CRO a clear, actionable picture.
```

### 3.2 Aggregation Prompt — Portfolio Level

After individual opportunities are analysed, the LLM aggregates across the full pipeline:

```
ROLE: You are a Chief Revenue Intelligence Officer preparing
the weekly intelligence briefing for the CRO and VP Sales.
You have just analysed [N] individual opportunities. Now you
must identify the patterns, connections, and systemic risks
that no individual deal analysis would reveal.

TASK: Produce a Global Revenue Intelligence Report that a CRO
would read before their Monday pipeline call.

ANALYSIS FRAMEWORK:

1. EXECUTIVE BRIEFING (3 sentences max)
   The single most important thing the CRO needs to know this
   week. Not a summary — a provocation. Something that changes
   how they think about the pipeline.

2. PORTFOLIO RISK ASSESSMENT
   - Total pipeline value vs. realistic weighted forecast
   - How much revenue is concentrated in deals with Health
     Score <50?
   - What percentage of forecast depends on deals with no
     identified economic buyer?
   - Stalled deal revenue: total value stuck >30 days in
     current stage

3. PATTERN DETECTION (the non-obvious stuff)
   - Are losses clustering by geography, vertical, competitor,
     deal size, or rep?
   - Are wins sharing common characteristics that aren't being
     systematically replicated?
   - Is a competitor gaining momentum in a specific segment?
   - Are deals slipping uniformly (systemic issue) or
     selectively (rep/manager issue)?
   - Are there "zombie deals" — opportunities that keep
     pushing close dates without any documented progress?

4. CROSS-DEAL CONNECTIONS
   - Deals at the same prospect company (multi-product /
     multi-division)
   - Deals influenced by the same competitor in the same
     geography
   - Deals with the same partner where partner alignment
     is a factor
   - Deals where the same objection pattern appears (pricing,
     implementation, features)

5. REGIONAL INTELLIGENCE
   For each region (UK, AU, NA, NZ, IE):
   - Pipeline health relative to target
   - Dominant win/loss themes
   - Competitive landscape shifts
   - Manager engagement level
   - Top 3 deals requiring intervention

6. ACTIONABLE RECOMMENDATIONS
   Exactly 5 recommendations, prioritised:
   - P1: Must happen in next 48 hours (specific deal
     interventions)
   - P2: Must happen this week (process or coaching changes)
   - P3: Must happen this month (systemic or strategic changes)

   Each recommendation must include: the specific action,
   who should take it, by when, and the estimated revenue
   impact of action vs. inaction.

7. FORECAST CONFIDENCE ASSESSMENT
   - Current forecast accuracy: based on deal health scores
     and historical patterns, what percentage of the
     current forecast is realistic?
   - Upside: which deals not currently in forecast could
     close if specific actions are taken?
   - Downside: which forecasted deals are most likely to
     slip or lose?

OUTPUT: Structured JSON matching our AggregatedReport schema.
Write for a CRO who has 4 minutes to read this before
walking into a board meeting. Every sentence must earn
its place.
```

### 3.3 Win/Loss Deep Dive Prompt

A specialised prompt for analysing closed deals:

```
ROLE: You are a Revenue Intelligence Analyst specialising in
win/loss pattern recognition. You are analysing a batch of
recently closed opportunities (both won and lost) to extract
institutional knowledge.

TASK: Identify repeatable patterns, competitive intelligence,
and coaching opportunities from closed deal data.

ANALYSIS FRAMEWORK:

1. WIN PATTERN EXTRACTION
   For each win, identify:
   - The "closing trigger" — what specific event or conversation
     tipped the deal?
   - The "competitive wedge" — what differentiated us from
     alternatives?
   - The "champion behaviour" — what did our internal champion
     do that helped?
   - The "sales motion" — what did the AE do that was effective?
   - Integrations mentioned as value drivers
   - Time from first engagement to close (velocity)

2. LOSS PATTERN EXTRACTION
   For each loss, identify:
   - The "kill shot" — what was the moment the deal died?
   - Qualification failure: should this have been disqualified
     earlier? At what stage?
   - Competitive loss: what specific narrative did the
     competitor use?
   - Price vs. value: was this actually a price objection, or
     a failure to articulate value?
   - Could this deal be recovered? If so, when and how?
     (Boomerang analysis)

3. CROSS-PATTERN ANALYSIS
   - What do wins have in common that losses don't?
   - Are specific reps winning patterns that others aren't
     replicating?
   - Are losses concentrated in a segment where we shouldn't
     be competing?
   - What percentage of losses were "preventable" (better
     qualification, different positioning, earlier executive
     engagement)?

4. PRODUCT & MARKET SIGNALS
   - Feature gaps mentioned in losses: what capabilities are
     prospects asking for?
   - Integration requests: what ecosystem connections are
     missing?
   - Pricing model friction: where does our pricing structure
     create objections?
   - Market segment signals: should we be pursuing or
     avoiding specific segments?

OUTPUT: Structured JSON with win themes, loss themes,
competitive intelligence, coaching opportunities, and
product feedback. Each insight must be actionable — don't
just identify patterns, recommend what to do about them.
```

---

## 4. Data Signals Taxonomy

Every field in a Salesforce opportunity record is a signal. Here's how Prism should weight them.

### 4.1 High-Value Signals (actively extract and analyse)

| Signal | Source Field | What It Tells Us |
|--------|-------------|------------------|
| Stage velocity | Stage + Last Modified | Is the deal progressing or stalled? |
| Manager engagement | Manager Notes recency | Is leadership paying attention? |
| Competitive awareness | Main Competitor field | Do we know who we're fighting? |
| Economic buyer access | Decision Maker / Who Is Signing | Can we reach the person with budget authority? |
| Deal strategy existence | Close Plan / Path to Purchase | Has anyone thought about HOW to win? |
| Value articulation | Why Would They Buy | Can the AE articulate differentiated value? |
| Risk awareness | Why Wouldn't They Buy | Has anyone thought about what could go wrong? |
| Activity recency | Last Activity Date | Is anyone actually working this deal? |
| Close date movement | Close Date vs. Created Date history | Has this deal slipped? How many times? |
| Discount history | Discount % + stage timing | Proactive negotiation vs. reactive desperation? |

### 4.2 Inferred Signals (derive from combinations)

| Signal | Derived From | What It Means |
|--------|-------------|---------------|
| Ghost Risk | Last Activity Date > 14 days + Stage >= Quote | Prospect has gone dark |
| Champion Single-Threading | Contact count = 1 + Deal > $25K | One person leaves, deal dies |
| Zombie Deal | Close date pushed 3+ times + no stage change | Deal is fiction |
| Qualification Failure | "Too Small" loss + low employee count | Should never have entered pipeline |
| Competitive Contagion | 2+ competitor mentions in same geo/vertical within 60 days | Competitor running a targeted campaign |
| Discount Desperation | Discount applied + 14+ days stall + no new contacts | Price cut won't fix the real problem |
| Partner Friction | Partner mentioned + pricing discrepancy in notes | Channel misalignment creating confusion |
| Implementation Anxiety | Concern language in notes + no reference call scheduled | Emotional objection needs social proof |
| Expansion Propensity | Multi-stakeholder engagement + integration requirements + high satisfaction indicators | This new logo will expand fast |
| Boomerang Window | Closed Lost 6-18 months ago + competitor known limitations match original requirements | Former prospect ready to reconsider |

### 4.3 Absence Signals (what's NOT there is the signal)

This is where Prism differentiates. Most tools only analyse what exists. Prism must detect and score what's *missing.*

| Missing Element | Stage Where It Matters | Risk Level |
|----------------|----------------------|------------|
| No Decision Maker | Solution Review+ | Critical |
| No Manager Notes | Any deal >$10K, any stage | High |
| No Competitor identified | Solution Review+ | High |
| No Close Plan | Contract Review+ | Critical |
| No "Why Buy" documented | Solution Review+ | High |
| No recent activity | Any stage, 14+ days | High |
| No economic buyer | Contract Review+ for >$25K | Critical |
| No "Why Wouldn't Buy" | Solution Review+ | Medium |
| No next steps documented | Any stage | Medium |
| No integration requirements | Discovery+ for enterprise deals | Medium |

---

## 5. What Makes Prism Different From Everything Else

Every RevOps team has dashboards. Gong records calls. Clari forecasts. Salesforce reports on fields. Here's what none of them do — and what Prism must:

### 5.1 Intelligence from Absence

No existing tool systematically scores and surfaces what's *missing* from deal records. Prism should generate a "Darkness Score" — how much of the intelligence picture is invisible for a given deal, region, or rep. A deal with a high Darkness Score isn't necessarily at risk, but it's *unknowable* — and unknowable deals are unforecastable.

### 5.2 Cross-Deal Pattern Inference

Gong analyses individual calls. Clari forecasts individual deals. Nobody connects the dots across deals to identify systemic patterns: "The same objection is appearing in 7 deals across 3 regions — this isn't 7 objection-handling problems, it's a positioning problem."

### 5.3 Predictive Risk from Historical Fingerprints

Not just "this deal is stalled" — but "this deal exhibits the exact same pattern as 14 deals that closed lost in the last 6 months, and here's what they had in common."

### 5.4 Actionable Prescriptions, Not Just Diagnoses

Every insight must end with a specific, time-bound, role-assigned action. Not "this deal is at risk" but "Stewart must confirm the site visit date by Wednesday. If unconfirmed, downgrade forecast confidence to 30% and reassign executive sponsor time to Deal Y which has higher close probability."

### 5.5 Revenue Impact Quantification

Every recommendation must include a dollar figure. Not "improve manager engagement" but "increasing manager note coverage from 15% to 40% on $10K+ deals is projected to convert an additional $1.2M in pipeline this quarter based on historical engagement-to-close correlation."

---

## 6. Build Priorities — What To Tackle Next

Based on the intelligence in these reports, here's what I'd prioritise:

### Phase 1: Intelligence Extraction (Current Sprint)

Get the LLM reliably extracting structured intelligence from raw Salesforce CSV exports. The system prompts above are the foundation. Focus on:

- Individual opportunity health scoring
- Risk signal detection (especially absence signals)
- Manager note sentiment analysis
- Competitor extraction from free-text fields

### Phase 2: Pattern Detection (Next Sprint)

Once individual analysis works, build the aggregation layer:

- Cross-deal pattern matching
- Competitive contagion mapping
- Stall pattern classification
- Win/loss theme clustering

### Phase 3: Predictive Intelligence (Month 2)

Build historical baselines and start making forward-looking predictions:

- Deal fingerprint matching against historical outcomes
- Forecast confidence scoring based on deal health
- Boomerang window identification
- Expansion propensity scoring

### Phase 4: Prescriptive Actions (Month 3)

Make Prism a coaching engine, not just an intelligence engine:

- Reference customer matching for implementation anxiety
- Competitive positioning recommendations per deal
- Manager time allocation optimisation
- Rep coaching suggestions based on win/loss pattern gaps

---

## 7. Open Questions for Steve and Pete

Things we should align on before building deeper:

1. **Data access frequency:** Can we get automated Salesforce exports, or should we push for a direct Salesforce API connection? Weekly CSV is fine for now but limits real-time alerting.

2. **Historical data depth:** How far back can we pull Closed Won/Lost data? The more history, the better our pattern matching and fingerprinting becomes. Ideally 18-24 months.

3. **Field customisation:** The current Salesforce instance has fields like "Close Plan" and "Path to Purchase" that are 0% populated. Should Prism's intelligence extraction *replace* the need for reps to fill these in (by inferring from notes and activities), or should Prism *enforce* their completion?

4. **Coaching vs. surveillance:** Prism can surface rep-level performance patterns. How do Pete and the VP Sales team want this positioned — as a coaching tool ("here's what your best reps do differently") or an accountability tool ("here's who isn't following process")? This affects the system prompt framing significantly.

5. **Competitive intelligence sharing:** Should competitive insights from Prism flow to Product Marketing automatically? The loss data is rich with competitor positioning intel that's currently trapped in Salesforce notes.

6. **CRO alert threshold:** At what deal value and risk level should Prism generate a direct alert to Pete versus just including it in the weekly report?

---

*This document should be updated as we build and learn. Every sprint should add new intelligence patterns to Section 2, refine the system prompts in Section 3, and expand the signal taxonomy in Section 4.*
