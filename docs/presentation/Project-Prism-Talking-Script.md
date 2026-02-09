# Project Prism — Presenter's Talking Script

**Audience:** Pete Mansel (CRO), Mike Duda (VP RevOps), Steve Logan (CIO)
**Presenter:** Brad Towers
**Duration:** ~25 minutes + Q&A
**Format:** Walk through the HTML presentation (arrow keys to navigate) or PowerPoint

---

## Slide 1 — Title

**[~1 minute]**

> "Alright guys, thanks for making time for this. What I want to walk you through today is the detailed Phase 1 plan for Project Prism — how we actually build this thing and get a working Global Intel Report into the ELT's hands within four weeks.
>
> Quick recap on who's doing what: Pete, you're our executive sponsor. Mike, your RevOps team owns the data coming out of Salesforce. Steve, your team handles the security, hosting, and making sure we're not doing anything crazy with customer data. And I'll be building the actual engine — the pipeline, the AI analysis, and the report generation.
>
> Let me walk you through the plan."

**[→ Next slide]**

---

## Slide 2 — The Problem: Data Rich, Insight Poor

**[~2 minutes]**

> "So let's start with the problem we're solving. We all know this, but it's worth framing it clearly.
>
> We now capture a massive amount of data on every deal. Win/loss notes, the new deal review forms inside Salesforce — it's all there. The problem is, it's sitting in text fields. Nobody is reading all of it. Nobody *can* read all of it.
>
> We've got somewhere between 100 and 500 opportunities flowing through every single week, across three regions — NA, UK, and ANZ. Right now, the number of automated insights we're getting from all that data? Zero. And the number of deals that might be quietly going sideways without anyone noticing? We genuinely don't know.
>
> That's the gap. We're data rich, but insight poor. And that's what Prism fixes."

**[→ Next slide]**

---

## Slide 3 — The Solution: AI-Driven Revenue Intelligence

**[~2 minutes]**

> "Here's what Prism does at the highest level. Think of it as four steps.
>
> **Ingest** — we pull the raw text out of Salesforce automatically. Win/loss notes, deal review forms, eventually Clari Copilot transcripts in Phase 2. No manual work.
>
> **Analyze** — we feed that text to an AI model that reads every single note, understands the context, picks up on sentiment, competitor mentions, risk signals — things a human would catch if they had time to read 500 deal notes a week. Which they don't.
>
> **Synthesize** — the AI doesn't just spit out raw analysis. It clusters the findings into themes. 'We're losing on pricing in ANZ.' 'Competitor X is running a FUD campaign in NA.' 'Three deals in UK have stalled stakeholder alignment.' That kind of thing.
>
> **Report** — all of that gets packaged into a weekly Global Intel Report. An interactive dashboard Pete and the ELT can drill into, plus an auto-generated PowerPoint deck for forecast calls. Every Monday morning."

**[→ Next slide]**

---

## Slide 4 — Phase 1 Scope: Win/Loss Intelligence MVP

**[~2 minutes]**

> "For Phase 1, we're keeping it focused. Four capabilities.
>
> **Win/Loss Theme Analysis** — the core use case. Region by region, why are we winning, why are we losing. Not just the checkbox reason codes — the actual narrative themes buried in the notes. Pricing perception, product gaps, competitor tactics.
>
> **At-Risk Deal Detection** — this is the one I think Pete's going to love. The AI reads active deal notes and flags risk markers that might not show up in the forecast stage. Things like negative sentiment creeping in, executive sponsors going quiet, or a competitor suddenly being mentioned.
>
> **Competitor Intelligence** — automatic extraction of every competitor mention across every deal, globally. We'll see trending — is a particular competitor showing up more this month than last? Are they running a specific play?
>
> **Market Signals** — the early warning system. New objections we haven't seen before, shifts in buyer sentiment, emerging competitive threats.
>
> On the right you can see the nuts and bolts — data comes from SFDC, outputs are a dashboard and deck, covers all three regions, runs weekly."

**[→ Next slide]**

---

## Slide 5 — Architecture Overview

**[~3 minutes — this is the technical meat, take your time]**

> "Alright, here's the architecture. I've tried to keep this as simple as possible.
>
> **Top layer** — that's the data sources. Mike, this is your world. The win/loss notes and deal review forms coming out of Salesforce. For Phase 1, we're doing scheduled CSV exports — nice and simple. No API integration needed yet. You'd set up a Salesforce report that runs weekly and drops a CSV.
>
> **Second layer** — that's the data pipeline I'll build. It takes those CSVs, parses them, normalizes the data, tags everything by region, and runs a PII check to make sure we're not sending any customer-identifiable information to the AI. More on that in a sec.
>
> **Third layer** — the LLM analysis engine. This is the brain. It reads every opportunity and extracts themes, risk signals, competitor mentions, and market signals. And — Steve, this one's for you — it's designed to be provider-agnostic. I'll show that on the next slide.
>
> **Bottom layer** — the outputs. Interactive dashboard, auto-generated PowerPoint, and email distribution.
>
> You'll notice each layer has an owner badge. Mike owns the data coming in. I'm building the pipeline and the engine. Steve's team handles the security and hosting. Pete, you're the one presenting the output to the ELT."

**[→ Next slide]**

---

## Slide 6 — LLM Abstraction: Provider-Agnostic by Design

**[~2 minutes — address Steve's concern directly here]**

> "Steve, you flagged in the Slack channel that you don't want us welded to a single AI provider. Completely agree. Here's how we're handling that.
>
> The architecture has a clean abstraction layer. Think of it like a plug — the analysis engine talks to a standard interface, and behind that interface you can plug in Claude, GPT, Gemini, or whatever comes next. Swapping providers is a configuration change, not a code rewrite. You change an environment variable, and it points to a different API.
>
> For Phase 1, I'm recommending we start with Claude. Specifically the Opus model. In my experience it's the strongest for this kind of nuanced, context-heavy sales analysis where you need the AI to actually *understand* what a rep is saying between the lines. But the architecture means we're never locked in.
>
> If six months from now a better model comes along, or if your team wants to run evaluations across providers, we can do that without touching the core pipeline."

*[If Steve pushes back, see Q&A section below]*

**[→ Next slide]**

---

## Slide 7 — Data Pipeline: End-to-End Flow

**[~1.5 minutes]**

> "Here's the five-step flow in more detail.
>
> Step one, the CSV export runs weekly from Salesforce. Step two, we parse and normalize — map the fields, tag regions. Step three, data quality checks and PII flagging. Step four, the AI processes everything in batches of about 20 to 30 opportunities at a time — gives us the best balance of quality and speed. Step five, the results get aggregated by region and the report is generated.
>
> The whole thing end-to-end? Should run in under an hour for 500 opportunities. Most of that time is the AI processing."

**[→ Next slide]**

---

## Slide 8 — Weekly Intel Report: What the ELT Gets

**[~2 minutes]**

> "This is a mockup of what the actual weekly report looks like.
>
> Four sections. Top-left: the win themes — why we're winning deals. Things like 'superior workflow automation' or 'mobile-first field experience.' Top-right: the loss themes — pricing perception, missing product features, implementation timeline concerns.
>
> Bottom-left: the at-risk radar. This is the action-oriented section. It tells you 'seven deals are at risk this week — three because of stalled executive alignment, two showing negative sentiment shift, two with active competitor displacement attempts.' Pete, this is the one I'd expect to drive the most conversation in forecast calls.
>
> Bottom-right: market signals. The broader trends the AI is picking up. New competitor narratives, rising demand themes, market shifts.
>
> Now, this is a sample with illustrative data. Once Mike gets us the first real CSV export, we'll run it against actual data and the themes will reflect our real business."

**[→ Next slide]**

---

## Slide 9 — Workstreams & RACI

**[~1.5 minutes]**

> "Here's who does what.
>
> Mike, your team owns the data schema and export. That means defining exactly which fields we pull from Salesforce and setting up the scheduled report. That's the critical path item — I can't build anything until I have sample data.
>
> I'm building three things: the data pipeline, the AI analysis engine, and the report generation layer. That's the bulk of the development work.
>
> Steve, your team has two key items: the data privacy review — making sure we're cleared to send deal data to an external AI API — and the hosting decision. Where does this thing actually run?
>
> Pete, you're the sponsor. Remove blockers, define what you want to see in the report, and present the first one to the ELT."

**[→ Next slide]**

---

## Slide 10 — Timeline: 4-Week Sprint

**[~2 minutes]**

> "Here's the four-week plan.
>
> **Week 1** is all about foundations. Mike's team defines the schema and gets the CSV export running. Steve kicks off the security review. I start building the data pipeline.
>
> **Week 2** is the heavy build week for me. I'm building the LLM abstraction layer, engineering the analysis prompts, and getting the batch processing working. Steve, I'd need the hosting decision by end of this week so I know where to deploy.
>
> **Week 3** is report generation and testing. I build the dashboard and the auto-gen deck, then run the whole thing against historical data — real opportunities from the last couple months. Mike, I'll need you to validate the output makes sense.
>
> **Week 4** is showtime. Pete presents the first draft to the ELT, we gather feedback, iterate, and deploy the weekly automation. If all goes well, it's running on its own from that point forward.
>
> This is aggressive but achievable. The biggest dependency is getting that first CSV export from Mike's team in Week 1."

**[→ Next slide]**

---

## Slide 11 — Success Metrics

**[~1 minute]**

> "How do we know Phase 1 worked? Four KPIs.
>
> 90% accuracy on risk identification — we'll validate this by running Prism against historical data and checking whether the deals it flagged as 'at risk' actually had issues.
>
> 100% ELT adoption — meaning the report is actively used in forecast calls within four weeks. Pete, that one's on you.
>
> Less than 24 hours from data capture to actionable insight. Today that number is effectively infinite because nobody's reading this stuff systematically.
>
> And 2x faster product gap detection. When deals are being lost because of a missing feature, we want to surface that to Product in days, not months."

**[→ Next slide]**

---

## Slide 12 — 3-Horizon Strategy

**[~2 minutes]**

> "I want to zoom out for a second and show where this is going, because Phase 1 is just the foundation.
>
> **Horizon 1** is what we're building now — the Intelligence Engine. Prove the AI can reliably read our sales data and give us strategic insight. The weekly report.
>
> **Horizon 2** is where it gets really interesting. We connect the brain to the hands. Instead of just *reporting* that a deal is at risk, the system actually *does something about it*. Through Agentforce integration, it auto-creates tasks — 'Schedule an executive alignment call' — or sends coaching nudges to reps who are struggling with specific objections. That's Q2.
>
> **Horizon 3** is Pete's big vision. An army of AI agents doing outbound prospecting, account expansion, and TAM coverage at a scale that's impossible with humans alone. A thousand digital sales agents. 50% reduction in revenue acquisition cost. That's second half of the year.
>
> But none of that happens without Horizon 1. This is the foundation. Let's prove it works, get the ELT hooked on the intel report, and build from there."

**[→ Next slide]**

---

## Slide 13 — Data Security

**[~1.5 minutes]**

> "Before we wrap, let's talk about the security piece, because I know this matters — especially to Steve.
>
> The honest answer on data privacy is: we need to confirm it. That's a Week 1 action item for Steve's team. The question is whether sending opportunity note text to an external AI API requires additional clearance.
>
> What I can tell you is what we're building in from day one. We scrub PII before anything leaves our system. We only send the note text, the deal stage, and the region — no customer names, no company identifiers in the prompts. API keys are stored securely, never hardcoded. And we're not retaining any data on the AI provider's side — process and discard.
>
> And because the LLM layer is provider-agnostic, if security review comes back and says 'we can't use external APIs,' we can swap to a self-hosted model or an on-prem option without rebuilding the pipeline. That's the whole point of the abstraction."

**[→ Next slide]**

---

## Slide 14 — Next Steps

**[~1.5 minutes]**

> "So here's what I need from everyone.
>
> **Mike** — I need three things from your team. The field list for win/loss notes and deal review forms, the scheduled CSV export set up, and a sample data file I can start building against. That's the critical path.
>
> **Steve** — your team needs to do the data privacy review, make the hosting call, and sort out how we manage API keys securely.
>
> **Pete** — you're the sponsor. Help us clear any blockers, tell us exactly what you want to see in the report, and be ready to present it to the ELT in Week 4.
>
> **Me** — I'm building the pipeline, the engine, and the reports. Once I get sample data from Mike, I'll have a working prototype within two weeks.
>
> Target: first Global Intel Report delivered Week 4. Weekly automation running from that point on.
>
> Questions?"

---

---

## Anticipated Questions & Prepared Answers

### From Pete (CRO)

**Q: "How quickly can we actually get this in front of the ELT?"**

> "Four weeks from when Mike gives me the first CSV export. That's the critical path item. Once I have real data to work with, the build itself is two weeks, then a week of testing and iteration. Week 4 you present."

**Q: "Can we add Clari Copilot transcripts to Phase 1?"**

> "I'd recommend we keep it out of Phase 1. Win/loss notes and deal review forms are structured enough to get a solid first report. Clari transcripts add a lot of unstructured audio data that needs different processing. Let's nail the core use case first and add Clari in Horizon 2 — that's only a quarter away."

**Q: "What if the AI gets it wrong? What if it flags a deal as at-risk and it's actually fine?"**

> "That's exactly why we're validating against historical data before going live. We run Prism against the last 8 weeks of closed deals and check: did the AI correctly identify which ones had problems? We calibrate the prompts until we hit 90% or better. False positives are much less damaging than false negatives — I'd rather flag a healthy deal for a second look than miss a real risk."

**Q: "What does this cost to run?"**

> "The AI API costs for processing 500 opportunities per week will be roughly $50-150 per week, depending on the model and note length. That's pocket change compared to the value of catching one at-risk deal early or identifying a product gap that's killing deals across a region. Hosting on something like Vercel is essentially free at this scale."

---

### From Mike (VP RevOps)

**Q: "What fields exactly do you need from Salesforce?"**

> "At minimum I need: Opportunity Name or ID, Stage, Win/Loss status, Region, the free-text Win/Loss Notes field, the Deal Review Form fields (whatever structured fields are on that form), Close Date, and Deal Value. If there's a Competitor field, that's useful too. But honestly, send me whatever you've got in a sample export and I'll map it. I can work with more fields — I just can't work with fewer."

**Q: "Can we use the SFDC API instead of CSV exports?"**

> "Absolutely, and that's probably where we go in Phase 2 or beyond. For Phase 1, CSV keeps it simple — no API authentication to set up, no rate limit concerns, no dependencies on your SFDC integration stack. It's the fastest path to a working prototype. Once we've proven the value, we can harden the integration."

**Q: "How do we validate the AI's output is accurate?"**

> "Two ways. First, I'll run it against historical data and we manually check a sample of the results — did the AI correctly categorize the win/loss themes? Did the risk signals match what actually happened? Second, once it's live, I'd want someone from your team to spend 15 minutes a week spot-checking a handful of the AI's assessments against the actual notes. That's how we build confidence and improve the prompts over time."

**Q: "What if the data quality in SFDC is bad? Reps don't always fill in notes properly."**

> "Great question. The pipeline has a data quality validation step. If a note is empty or too short to be meaningful, we flag it and exclude it from analysis. The report will actually surface data quality metrics — 'X% of opportunities in ANZ had empty notes this week.' That becomes a feedback loop for your team to coach reps on note quality. Better input, better insight."

---

### From Steve (CIO)

**Q: "Why Claude and not GPT or Gemini?"**

> "For this specific use case — reading nuanced, unstructured sales notes and extracting strategic meaning — Claude's Opus model is currently the strongest in my testing. It handles ambiguity and context better than the alternatives. But I want to stress: the architecture doesn't care. The LLM layer is behind an abstraction. It's literally a config change to swap providers. If your team wants to run a comparative eval, we can process the same data through all three and compare results."

**Q: "What data are we actually sending to the AI API?"**

> "Only what's necessary. The opportunity note text, the deal stage, and the region code. No customer names, no company names, no contact information, no financial details beyond deal value. We strip everything identifiable before it leaves our system. The AI never sees 'Acme Corp is considering competitor X' — it sees 'Deal #4782 in NA, Stage 4, notes: [sanitized text].'"

**Q: "Where does this run? Who manages it?"**

> "For Phase 1, I'm recommending a lightweight deployment — something like Vercel or a simple cloud function. It runs once a week, processes the data, generates the reports, and goes back to sleep. There's no always-on infrastructure to manage. Long term, if this becomes mission-critical, we'd want to move it into your managed infrastructure. But for a prototype, we want to stay lean."

**Q: "What about data residency? Where is the data processed?"**

> "The CSV stays on whatever infrastructure we deploy to. The API call to Claude goes to Anthropic's servers — currently US-based. The response comes back and is stored locally. No data is retained on Anthropic's side when using the API — their data retention policy for API usage is zero. If data residency is a hard requirement, the provider-agnostic design means we could swap to an on-prem model like a self-hosted open-source LLM. It would be less capable but would keep everything in-house."

**Q: "Can your integration team build this instead of Brad?"**

> "Absolutely, and that might be the right move for Phase 2 onwards. For Phase 1, I'd recommend letting me build the prototype because I can move fast and I know the AI engineering patterns. Once we've proven the concept and the ELT is bought in, your team can take ownership of productionizing it. The codebase will be clean, documented, and built on standard patterns — nothing exotic."

**Q: "What happens if the AI hallucinates or makes something up?"**

> "The analysis is always grounded in actual note text. The AI isn't generating information from nothing — it's reading what reps wrote and categorizing it. We can include source citations in the output so that every theme or risk flag links back to the specific opportunity notes that triggered it. That way, anyone reviewing the report can click through and verify. Hallucination risk is low when the AI is summarizing existing text rather than creating new information."

---

### General / Anyone

**Q: "What's the cost if we don't do this?"**

> "We keep doing what we're doing — which is nothing, systematically. Deal intelligence stays locked in text fields. Pete doesn't get the visibility he needs for forecast accuracy. Product gaps get identified slowly, if at all. At-risk deals go unnoticed until it's too late. The cost isn't a line item — it's lost deals and missed signals."

**Q: "Is this a one-person dependency on Brad?"**

> "Right now, yes — I'm building the prototype. But the whole point of Phase 1 is to prove the concept fast. The code will be standard Python/Node.js, well-documented, with a clean architecture. Once proven, Steve's integration team can own and maintain it. I'd be handing off a working system, not a personal project."

**Q: "What's the minimum viable version we could ship?"**

> "If we wanted to go even leaner, the absolute MVP is: one CSV export, one AI analysis pass, one PDF report. No dashboard, no auto-gen deck — just a document that says 'here are the top win themes, loss themes, and at-risk deals this week.' I could have that working in a week with sample data. But I'd recommend the full Phase 1 scope because the dashboard and deck are what make the ELT actually *use* it."

---

## Timing Guide

| Slide | Topic | Minutes |
|-------|-------|---------|
| 1 | Title & intro | 1 |
| 2 | The problem | 2 |
| 3 | The solution | 2 |
| 4 | Phase 1 scope | 2 |
| 5 | Architecture | 3 |
| 6 | LLM abstraction | 2 |
| 7 | Data pipeline | 1.5 |
| 8 | Report mockup | 2 |
| 9 | RACI | 1.5 |
| 10 | Timeline | 2 |
| 11 | Success metrics | 1 |
| 12 | 3-Horizon vision | 2 |
| 13 | Security | 1.5 |
| 14 | Next steps | 1.5 |
| — | **Total presentation** | **~25 min** |
| — | Q&A buffer | 10-15 min |

## Presenter Tips

- **Open the HTML file in Chrome fullscreen** (F11) for the cleanest presentation experience. Arrow keys to navigate, swipe on touch screens.
- **Start with energy on the problem slide** — make them feel the pain before showing the fix.
- **On the architecture slide**, don't rush. This is where Mike and Steve need to see their roles clearly. Point at each layer as you talk through it.
- **On the LLM abstraction slide**, make eye contact with Steve. This slide exists because of his concern — acknowledge that directly.
- **On the report mockup**, pause and let them read it. People process visual data faster than you can talk about it.
- **End strong on next steps** — leave the room with clear action items, not just a vision. Everyone should leave knowing exactly what they need to do this week.
