import type { RegionData, TrendData } from '@/lib/types';

const trendData: TrendData = {
  weeks: ['Dec 16', 'Dec 23', 'Dec 30', 'Jan 6', 'Jan 13', 'Jan 20', 'Jan 27', 'Feb 3'],
  all: [36, 38, 37, 39, 40, 38, 41, 42],
  na: [38, 40, 39, 41, 42, 40, 43, 44],
  uk: [33, 35, 34, 36, 37, 35, 38, 39],
  au: [34, 36, 35, 37, 38, 36, 39, 40],
};

export const allRegionData: RegionData = {
  stats: {
    pipeline: { value: '$482K', change: '+8%', dir: 'up', sub: 'Total pipeline MRR' },
    winRate: { value: '42%', change: '+3pts', dir: 'up', sub: 'Blended win rate' },
    atRisk: { value: '$68K', change: '+$12K', dir: 'down', sub: '12 deals flagged' },
    velocity: { value: '11d', change: '-2d', dir: 'up', sub: 'Avg. close cycle' },
    forecast: { value: '87%', change: '+2%', dir: 'up', sub: 'AI confidence score' },
    threats: { value: '5', change: '+2', dir: 'down', sub: 'Active displacements' },
  },
  sparklines: {
    pipeline: [38.2, 39.5, 41.0, 40.2, 43.8, 44.1, 45.9, 47.2],
    winRate: [36, 38, 37, 39, 40, 38, 41, 42],
    atRisk: [2.1, 2.8, 3.0, 2.5, 3.1, 3.8, 3.6, 4.2],
    velocity: [46, 44, 43, 42, 41, 40, 39, 38],
    forecast: [78, 80, 82, 83, 84, 85, 86, 87],
    threats: [2, 3, 2, 4, 3, 3, 4, 5],
  },
  funnel: [
    { stage: 'Discovery', count: 112, revenue: '$186K MRR', color: 'var(--prism-blue)' },
    { stage: 'Validation', count: 87, revenue: '$148K MRR', color: 'var(--accent)' },
    { stage: 'Solution Review & Quote', count: 64, revenue: '$102K MRR', color: 'var(--prism-green)' },
    { stage: 'Commitment', count: 42, revenue: '$84K MRR', color: 'var(--prism-amber)' },
    { stage: 'Closed Won', count: 14, revenue: '$22K MRR', color: 'var(--success)' },
  ],
  winThemes: [
    { label: 'Workflow Automation', pct: 28, revenue: '$62K MRR' },
    { label: 'Scheduling Flexibility', pct: 22, revenue: '$49K MRR' },
    { label: 'Mobile Field Experience', pct: 18, revenue: '$40K MRR' },
    { label: 'Integration Ecosystem', pct: 14, revenue: '$31K MRR' },
    { label: 'Customer Support', pct: 10, revenue: '$22K MRR' },
    { label: 'Implementation Speed', pct: 8, revenue: '$18K MRR' },
  ],
  lossThemes: [
    { label: 'Pricing vs Competition', pct: 31, revenue: '$48K MRR' },
    { label: 'Missing Asset Tracking', pct: 24, revenue: '$37K MRR' },
    { label: 'Implementation Timeline', pct: 16, revenue: '$25K MRR' },
    { label: 'Incumbent Loyalty', pct: 12, revenue: '$19K MRR' },
    { label: 'Reporting Limitations', pct: 10, revenue: '$15K MRR' },
    { label: 'Change Management', pct: 7, revenue: '$11K MRR' },
  ],
  risks: [
    { id: 4782, region: 'NA', level: 'HIGH', value: '$3.2K MRR', confidence: 94, summary: 'Ghost signal — no activity in 5 days, already past target cycle', action: 'AE to call TODAY; escalate to manager if no response by EOD', daysStalled: 5 },
    { id: 3291, region: 'UK', level: 'HIGH', value: '$2.8K MRR', confidence: 91, summary: 'Competitor displacement attempt — Ascora pricing FUD detected', action: 'Deploy competitive battlecard; arrange reference call TODAY', daysStalled: 4 },
    { id: 2847, region: 'NA', level: 'HIGH', value: '$4.1K MRR', confidence: 88, summary: 'Stalled in Validation for 6 days — no demo scheduled', action: 'Book demo within 24 hours or disqualify', daysStalled: 6 },
    { id: 5891, region: 'ANZ', level: 'HIGH', value: '$2.4K MRR', confidence: 85, summary: 'Active competitor POC running in parallel with Tradify', action: 'Fast-track demo today; highlight mobile-first differentiators', daysStalled: 3 },
    { id: 4521, region: 'UK', level: 'HIGH', value: '$3.6K MRR', confidence: 82, summary: 'In Commitment for 7 days with no verbal commit — deal is dying', action: 'Manager intervention: call economic buyer directly', daysStalled: 7 },
    { id: 5103, region: 'ANZ', level: 'MEDIUM', value: '$1.8K MRR', confidence: 78, summary: 'Negative sentiment shift in recent notes — budget concerns surfacing', action: 'Phased deployment proposal to reduce upfront cost', daysStalled: 3 },
    { id: 4156, region: 'UK', level: 'MEDIUM', value: '$2.1K MRR', confidence: 75, summary: 'Champion left organization — new stakeholder unengaged', action: 'Map new org chart; identify and engage new champion TODAY', daysStalled: 4 },
    { id: 3672, region: 'NA', level: 'MEDIUM', value: '$1.5K MRR', confidence: 72, summary: 'Requirements expanding — scope creep threatening 14-day target', action: 'Scope freeze meeting today; document must-haves vs nice-to-haves', daysStalled: 3 },
    { id: 2103, region: 'NA', level: 'MEDIUM', value: '$1.9K MRR', confidence: 68, summary: 'Decision committee expanded from 2 to 5 — consensus risk', action: 'Multi-thread: assign SE to each stakeholder group', daysStalled: 4 },
    { id: 3847, region: 'ANZ', level: 'MEDIUM', value: '$220K', confidence: 65, summary: 'Technical team skepticism on customization scope', action: 'Technical deep-dive session with solution architect', daysStalled: 6 },
  ],
  signals: [
    { dir: 'up', text: 'Competitor FUD campaign on pricing detected across 14 deals in NA and UK — primarily ServiceTitan and JobLogic' },
    { dir: 'up', text: 'AI/Automation feature demand accelerating — now mentioned in 23% of active opportunities, up from 14% last quarter' },
    { dir: 'flat', text: 'Mid-market consolidation trend continues — 8 prospects currently evaluating during active M&A activity' },
    { dir: 'up', text: 'ANZ price sensitivity increasing — 3 deals citing budget freezes or delayed capex approval' },
    { dir: 'up', text: 'API integration requests surging — 18 deals include integration requirements, up 40% from prior quarter' },
  ],
  competitors: [
    { name: 'ServiceTitan', threat: 'high', wins: 4, losses: 6, pending: 5, fud: 'Pushing "enterprise-only" narrative in NA; claiming Simpro is mid-market with limited scale' },
    { name: 'JobLogic', threat: 'high', wins: 11, losses: 9, pending: 8, fud: '"UK-based local team" narrative; positioning Simpro\'s global scale as a liability for UK buyers' },
    { name: 'Tradify', threat: 'medium', wins: 9, losses: 5, pending: 6, fud: 'NZ home-market loyalty and "simpler for trades SMB" messaging; low price point' },
    { name: 'Ascora', threat: 'medium', wins: 7, losses: 8, pending: 5, fud: '"Local Aussie software" positioning in AU; SMB price anchoring vs Simpro\'s mid-market pricing' },
    { name: 'ServiceM8', threat: 'low', wins: 14, losses: 3, pending: 4, fud: 'SMB-focused across all markets; appearance often signals a buyer who has outgrown their current tool' },
  ],
  recommendations: [
    { priority: 'P1', title: 'Deploy emergency response on top 3 at-risk deals ($2.8M)', desc: 'OPP #4782, #3291, #2847 require immediate executive intervention. Schedule CxO calls this week.', impact: '+$2.8M save' },
    { priority: 'P1', title: 'Counter ServiceTitan & JobLogic pricing FUD with updated battlecards', desc: 'FUD detected in 14 deals across NA and UK. Distribute updated TCO comparison showing 3-year advantage.', impact: '14 deals protected' },
    { priority: 'P2', title: 'Launch AI/Automation demo track for qualifying opportunities', desc: '23% of pipeline mentions automation. Create standardized demo flow highlighting AI capabilities.', impact: '+5% win rate est.' },
    { priority: 'P2', title: 'Accelerate ANZ deals with phased deployment option', desc: 'Budget sensitivity in ANZ requires flexible commercial model. Propose Phase 1/Phase 2 split.', impact: '$1.1M pipeline unlock' },
    { priority: 'P3', title: 'Host "Build vs. Buy" webinar targeting IT decision-makers', desc: '4 deals stalled by in-house build arguments. ROI content showing 18-month breakeven needed.', impact: '4 deals accelerated' },
  ],
  trendData,
};

// Region-filtered subsets
export const naRegionData: RegionData = {
  ...allRegionData,
  stats: {
    ...allRegionData.stats,
    pipeline: { ...allRegionData.stats.pipeline, value: '$26.1M' },
    winRate: { ...allRegionData.stats.winRate, value: '44%' },
    atRisk: { ...allRegionData.stats.atRisk, value: '$2.5M', sub: '6 deals flagged' },
    threats: { ...allRegionData.stats.threats, value: '3' },
  },
  risks: allRegionData.risks.filter(r => r.region === 'NA'),
  signals: allRegionData.signals.filter((_, i) => [0, 1, 2].includes(i)),
};

export const ukRegionData: RegionData = {
  ...allRegionData,
  stats: {
    ...allRegionData.stats,
    pipeline: { ...allRegionData.stats.pipeline, value: '$13.4M' },
    winRate: { ...allRegionData.stats.winRate, value: '39%' },
    atRisk: { ...allRegionData.stats.atRisk, value: '$2.0M', sub: '4 deals flagged' },
    threats: { ...allRegionData.stats.threats, value: '2' },
  },
  risks: allRegionData.risks.filter(r => r.region === 'UK'),
  signals: allRegionData.signals.filter((_, i) => [0, 2].includes(i)),
};

export const auRegionData: RegionData = {
  ...allRegionData,
  stats: {
    ...allRegionData.stats,
    pipeline: { ...allRegionData.stats.pipeline, value: '$7.7M' },
    winRate: { ...allRegionData.stats.winRate, value: '43%' },
    atRisk: { ...allRegionData.stats.atRisk, value: '$1.1M', sub: '3 deals flagged' },
    threats: { ...allRegionData.stats.threats, value: '2' },
  },
  risks: allRegionData.risks.filter(r => r.region === 'ANZ' || r.region === 'AU' || r.region === 'NZ'),
  signals: allRegionData.signals.filter((_, i) => [3, 4].includes(i)),
};

export const regionDataMap: Record<string, RegionData> = {
  all: allRegionData,
  na: naRegionData,
  uk: ukRegionData,
  au: auRegionData,
};
