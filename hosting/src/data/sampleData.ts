import type { RegionData, TrendData } from '@/lib/types';

const trendData: TrendData = {
  weeks: ['Dec 16', 'Dec 23', 'Dec 30', 'Jan 6', 'Jan 13', 'Jan 20', 'Jan 27', 'Feb 3'],
  all: [36, 38, 37, 39, 40, 38, 41, 42],
  na: [38, 40, 39, 41, 42, 40, 43, 44],
  uk: [33, 35, 34, 36, 37, 35, 38, 39],
  anz: [37, 39, 38, 40, 41, 39, 42, 42],
};

export const allRegionData: RegionData = {
  stats: {
    pipeline: { value: '$47.2M', change: '+8%', dir: 'up', sub: 'Total weighted pipeline' },
    winRate: { value: '42%', change: '+3pts', dir: 'up', sub: 'Blended win rate' },
    atRisk: { value: '$4.2M', change: '+$1.1M', dir: 'down', sub: '12 deals flagged' },
    velocity: { value: '38d', change: '-4d', dir: 'up', sub: 'Avg. close cycle' },
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
    { stage: 'Discovery', count: 112, revenue: '$14.8M', color: '#6ba3c7' },
    { stage: 'Qualification', count: 87, revenue: '$11.4M', color: '#5f9abd' },
    { stage: 'Demo / POC', count: 64, revenue: '$9.2M', color: '#7eb563' },
    { stage: 'Proposal', count: 42, revenue: '$6.8M', color: '#a9b968' },
    { stage: 'Negotiation', count: 28, revenue: '$3.8M', color: '#d4a574' },
    { stage: 'Closed Won', count: 14, revenue: '$1.2M', color: '#7eb563' },
  ],
  winThemes: [
    { label: 'Workflow Automation', pct: 28, revenue: '$5.4M' },
    { label: 'Scheduling Flexibility', pct: 22, revenue: '$4.1M' },
    { label: 'Mobile Field Experience', pct: 18, revenue: '$3.2M' },
    { label: 'Integration Ecosystem', pct: 14, revenue: '$2.5M' },
    { label: 'Customer Support', pct: 10, revenue: '$1.8M' },
    { label: 'Implementation Speed', pct: 8, revenue: '$1.1M' },
  ],
  lossThemes: [
    { label: 'Pricing vs Competition', pct: 31, revenue: '$4.8M' },
    { label: 'Missing Asset Tracking', pct: 24, revenue: '$3.2M' },
    { label: 'Implementation Timeline', pct: 16, revenue: '$2.1M' },
    { label: 'Incumbent Loyalty', pct: 12, revenue: '$1.6M' },
    { label: 'Reporting Limitations', pct: 10, revenue: '$1.2M' },
    { label: 'Change Management', pct: 7, revenue: '$0.8M' },
  ],
  risks: [
    { id: 4782, region: 'NA', level: 'HIGH', value: '$1.2M', confidence: 94, summary: 'Executive sponsor has gone silent — no activity in 3 weeks', action: 'Schedule CxO alignment call with VP Sales sponsorship', daysStalled: 21 },
    { id: 3291, region: 'UK', level: 'HIGH', value: '$890K', confidence: 91, summary: 'Competitor displacement attempt — ServiceMax pricing FUD detected', action: 'Deploy competitive battlecard; arrange reference call', daysStalled: 14 },
    { id: 2847, region: 'NA', level: 'HIGH', value: '$720K', confidence: 88, summary: 'Stalled at procurement — no technical validation scheduled', action: 'Engage procurement directly; propose accelerated POC', daysStalled: 18 },
    { id: 5891, region: 'ANZ', level: 'HIGH', value: '$540K', confidence: 85, summary: 'Active competitor POC running in parallel with ServiceTitan', action: 'Fast-track demo; highlight mobile-first differentiators', daysStalled: 10 },
    { id: 4521, region: 'UK', level: 'HIGH', value: '$680K', confidence: 82, summary: 'Budget reallocated to other priorities — viability questioned', action: 'ROI workshop with CFO; present 12-month payback model', daysStalled: 25 },
    { id: 5103, region: 'ANZ', level: 'MEDIUM', value: '$380K', confidence: 78, summary: 'Negative sentiment shift in recent notes — budget concerns', action: 'Phased deployment proposal to reduce upfront cost', daysStalled: 8 },
    { id: 4156, region: 'UK', level: 'MEDIUM', value: '$450K', confidence: 75, summary: 'Champion left organization — new stakeholder unengaged', action: 'Map new org chart; identify and engage new champion', daysStalled: 12 },
    { id: 3672, region: 'NA', level: 'MEDIUM', value: '$310K', confidence: 72, summary: 'Requirements expanding without timeline adjustment — scope creep', action: 'Scope freeze meeting; document must-haves vs nice-to-haves', daysStalled: 7 },
    { id: 2103, region: 'NA', level: 'MEDIUM', value: '$280K', confidence: 68, summary: 'Decision committee expanded from 3 to 7 — consensus risk', action: 'Multi-thread: assign SE to each stakeholder group', daysStalled: 9 },
    { id: 3847, region: 'ANZ', level: 'MEDIUM', value: '$220K', confidence: 65, summary: 'Technical team skepticism on customization scope', action: 'Technical deep-dive session with solution architect', daysStalled: 6 },
  ],
  signals: [
    { dir: 'up', text: 'Competitor FUD campaign on pricing detected across 14 deals in NA and UK — primarily ServiceMax and ServiceTitan' },
    { dir: 'up', text: 'AI/Automation feature demand accelerating — now mentioned in 23% of active opportunities, up from 14% last quarter' },
    { dir: 'flat', text: 'Mid-market consolidation trend continues — 8 prospects currently evaluating during active M&A activity' },
    { dir: 'up', text: 'ANZ price sensitivity increasing — 3 deals citing budget freezes or delayed capex approval' },
    { dir: 'up', text: 'API integration requests surging — 18 deals include integration requirements, up 40% from prior quarter' },
  ],
  competitors: [
    { name: 'ServiceMax', threat: 'high', wins: 8, losses: 12, pending: 14, fud: 'Claiming 30% lower TCO with bundled IoT; pushing "enterprise-only" narrative against us' },
    { name: 'ServiceTitan', threat: 'high', wins: 4, losses: 6, pending: 5, fud: 'Aggressive discounting in ANZ; offering 18-month free trial on residential module' },
    { name: 'Job Logic', threat: 'medium', wins: 11, losses: 9, pending: 8, fud: 'Positioning as "simpler to implement"; highlighting our customization complexity' },
    { name: 'Jobber', threat: 'low', wins: 14, losses: 3, pending: 2, fud: 'Limited enterprise play; mostly appearing in SMB segments we typically win' },
    { name: 'In-House / Custom', threat: 'medium', wins: 6, losses: 8, pending: 4, fud: 'IT teams arguing "build vs buy" — typically stalls deals 6+ weeks' },
  ],
  recommendations: [
    { priority: 'P1', title: 'Deploy emergency response on top 3 at-risk deals ($2.8M)', desc: 'OPP #4782, #3291, #2847 require immediate executive intervention. Schedule CxO calls this week.', impact: '+$2.8M save' },
    { priority: 'P1', title: 'Counter ServiceMax pricing FUD with updated battlecard', desc: 'FUD detected in 14 deals. Distribute updated TCO comparison showing 3-year advantage.', impact: '14 deals protected' },
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

export const anzRegionData: RegionData = {
  ...allRegionData,
  stats: {
    ...allRegionData.stats,
    pipeline: { ...allRegionData.stats.pipeline, value: '$7.7M' },
    winRate: { ...allRegionData.stats.winRate, value: '42%' },
    atRisk: { ...allRegionData.stats.atRisk, value: '$1.1M', sub: '3 deals flagged' },
    threats: { ...allRegionData.stats.threats, value: '1' },
  },
  risks: allRegionData.risks.filter(r => r.region === 'ANZ'),
  signals: allRegionData.signals.filter((_, i) => [3, 4].includes(i)),
};

export const regionDataMap = {
  all: allRegionData,
  na: naRegionData,
  uk: ukRegionData,
  anz: anzRegionData,
};
