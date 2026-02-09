/**
 * Project Prism - LLM Prompt Templates
 * Engineered prompts for revenue intelligence analysis
 */

/**
 * Comprehensive analysis prompt that processes all insights in a single pass
 * This is the primary prompt used for batch processing
 */
export const COMPREHENSIVE_ANALYSIS_PROMPT = `You are an expert revenue intelligence analyst specializing in B2B sales analysis.

Analyze the following Salesforce opportunity data and provide structured insights for competitive intelligence, risk assessment, and market analysis.

Return ONLY valid JSON matching this exact structure:
{
  "themes": {
    "win": ["theme1", "theme2"],
    "loss": ["theme1", "theme2"],
    "neutral": ["theme1"]
  },
  "riskSignals": {
    "level": "high|medium|low|none",
    "signals": ["signal1", "signal2"],
    "summary": "Brief summary of risk factors"
  },
  "competitors": {
    "mentioned": ["Competitor A", "Competitor B"],
    "context": ["Context about how they were mentioned"]
  },
  "marketSignals": ["signal1", "signal2"],
  "sentiment": {
    "score": 0.5,
    "label": "positive|neutral|negative"
  },
  "confidence": 0.85
}

## Analysis Guidelines:

### Themes
- Extract 2-5 key themes for wins (e.g., "Technical superiority", "Price competitiveness", "Existing relationship")
- Extract 2-5 key themes for losses (e.g., "Budget constraints", "Competitor's established presence", "Feature gaps")
- Be specific and quantifiable when possible
- Use past tense for completed deals, present tense for active deals

### Risk Signals
- Identify warning signs in active deals (budget constraints, stakeholder changes, competitive pressure, extended sales cycles)
- Level: "high" if immediate action needed, "medium" if emerging risk, "low" if minor, "none" if no risk detected
- Provide 2-4 specific signals with business context

### Competitors
- Extract explicitly mentioned competitors and implied competitive context
- Provide business context for each mention (lost to them, defending against them, etc.)
- Note if competitor is mentioned for technical, pricing, or relationship reasons

### Market Signals
- Identify broader market trends (industry shifts, regulatory changes, technology adoption, buying pattern changes)
- Look for leading indicators of demand changes
- Note geographic or vertical trends if mentioned

### Sentiment
- Score from -1.0 (very negative) to 1.0 (very positive)
- Label: "positive" (>0.2), "neutral" (-0.2 to 0.2), "negative" (<-0.2)
- Base on tone of notes and deal outcomes

### Confidence
- 0.0 to 1.0 indicating confidence in this analysis
- Lower confidence if data is sparse, ambiguous, or contradictory

## Examples:

EXAMPLE 1 - Won Deal:
Data: "Closed won deal worth $250K. Customer praised our scalability and 24/7 support. Chose us over Competitor X due to their 30-day implementation timeline vs our 7-day approach."
Analysis:
{
  "themes": {
    "win": ["Fast implementation", "Superior support", "Scalability"],
    "loss": [],
    "neutral": []
  },
  "riskSignals": {
    "level": "none",
    "signals": [],
    "summary": "No risk signals detected"
  },
  "competitors": {
    "mentioned": ["Competitor X"],
    "context": ["Lost to us due to our faster implementation timeline"]
  },
  "marketSignals": ["Buyers prioritizing implementation speed"],
  "sentiment": {
    "score": 0.9,
    "label": "positive"
  },
  "confidence": 0.92
}

EXAMPLE 2 - Lost Deal:
Data: "Lost $500K deal to Competitor Y. Customer budget cut 40% due to economic uncertainty. Our solution was better but they went with Competitor Y's lower-cost offering. Risk: customer may not re-engage for 6 months."
Analysis:
{
  "themes": {
    "win": [],
    "loss": ["Economic downturn", "Price sensitivity", "Budget constraints"],
    "neutral": []
  },
  "riskSignals": {
    "level": "medium",
    "signals": ["Budget reduction", "Customer financial uncertainty", "Economic headwinds"],
    "summary": "Market experiencing pricing pressure due to economic constraints"
  },
  "competitors": {
    "mentioned": ["Competitor Y"],
    "context": ["Won due to lower price point during budget-constrained period"]
  },
  "marketSignals": ["Economic downturn affecting enterprise budgets", "Price becoming primary decision factor"],
  "sentiment": {
    "score": -0.7,
    "label": "negative"
  },
  "confidence": 0.88
}

Now analyze this opportunity data:
---
{OPPORTUNITY_DATA}
---

Return only the JSON, no additional text.`;

/**
 * Prompt for extracting win/loss themes
 */
export const THEME_EXTRACTION_PROMPT = `Analyze the following Salesforce opportunity data and extract 2-5 key themes for wins and 2-5 for losses.

Opportunity Data:
{OPPORTUNITY_DATA}

Return JSON:
{
  "winThemes": ["theme1", "theme2"],
  "lossThemes": ["theme1", "theme2"],
  "neutral": ["theme1"]
}

Be specific (e.g., "Technical superiority" not "Good solution"). Return only JSON.`;

/**
 * Prompt for detecting risk signals in active deals
 */
export const RISK_DETECTION_PROMPT = `Analyze the following active opportunity and identify risk signals that might indicate deal loss risk.

Opportunity Data:
{OPPORTUNITY_DATA}

Return JSON:
{
  "riskLevel": "high|medium|low|none",
  "signals": ["signal1", "signal2"],
  "summary": "Brief business context summary"
}

Consider: extended sales cycles, stakeholder changes, budget constraints, competitive pressure, stalled progress.
Return only JSON.`;

/**
 * Prompt for competitor analysis
 */
export const COMPETITOR_ANALYSIS_PROMPT = `Extract all mentioned competitors and their business context from this opportunity data.

Opportunity Data:
{OPPORTUNITY_DATA}

Return JSON:
{
  "competitors": ["Competitor A", "Competitor B"],
  "contexts": ["Why they were mentioned in each instance"]
}

Focus on explicit mentions. Return only JSON.`;

/**
 * Prompt for market signal detection
 */
export const MARKET_SIGNAL_PROMPT = `Identify emerging market trends, patterns, or signals from this opportunity data.

Opportunity Data:
{OPPORTUNITY_DATA}

Return JSON:
{
  "signals": ["signal1", "signal2"],
  "categories": ["Technology", "Regulatory", "Economic", "Behavioral"]
}

Look for buying pattern changes, technology adoption, competitive landscape shifts. Return only JSON.`;

/**
 * System prompt for setting tone and behavior
 */
export const SYSTEM_PROMPT = `You are an expert revenue intelligence analyst for B2B SaaS companies. Your role is to extract actionable business intelligence from Salesforce opportunity data.

Key characteristics:
- Precise and analytical
- Focus on business impact
- Quantify when possible
- Consider competitive context
- Flag risks early
- Identify market trends
- Respect data privacy

Always return valid JSON. Never include explanatory text.`;

/**
 * Helper function to format opportunity data for prompts
 */
export function formatOpportunityForPrompt(data: {
  opportunityId: string;
  accountName: string;
  opportunityName: string;
  stage: string;
  amount?: number;
  winLossStatus: string;
  notes: string;
  dealReviewNotes?: string;
  region?: string;
  industry?: string;
}): string {
  return `
Opportunity ID: ${data.opportunityId}
Account: ${data.accountName}
Opportunity: ${data.opportunityName}
Region: ${data.region || "Unknown"}
Industry: ${data.industry || "Unknown"}
Stage: ${data.stage}
Status: ${data.winLossStatus}
Amount: ${data.amount ? `$${data.amount.toLocaleString()}` : "Not specified"}
---
NOTES:
${data.notes}
${data.dealReviewNotes ? `\nDEAL REVIEW:\n${data.dealReviewNotes}` : ""}
`.trim();
}

/**
 * Helper function to inject opportunity data into prompt
 */
export function injectOpportunityData(
  prompt: string,
  opportunityData: string
): string {
  return prompt.replace("{OPPORTUNITY_DATA}", opportunityData);
}
