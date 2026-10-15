# UX Streamline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Prism's single long dashboard page with a tabbed, region-filtered, takeaway-led UI (Overview · CRO Brief · Deals · Pipeline Health · Competition & Change). The aim is for the CRO and geo managers to use it daily.

**Architecture:** Each task is a small step that keeps the app working.
- **View state:** a `useDashboardView` hook owns tab, region and deal filters, and mirrors them in the URL hash.
- **Pure helpers in `src/lib`, each unit-tested:**
  - `dealMetrics.ts`: deal scoring, extracted from `RiskRadar.tsx`
  - `dealFilters.ts`: filtering
  - `takeaways.ts`: panel takeaways
  - `dashboardView.ts`: hash parse/serialise
- **Panel pattern:** every panel uses an `InsightPanel`, which renders a label, a question and a takeaway computed in code.
- **Shared deal reviews:** stored in Firestore `/dealReviews/{dealKey}` behind a narrow security rule, which is tested against the emulator.
- **Retired:** `RiskRadar.tsx` is split up and deleted. Existing widgets are reused inside the new tabs.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest + Testing Library (jsdom), Firebase JS SDK v10 (Firestore), Firebase emulator + `@firebase/rules-unit-testing` for rules tests.

**Design doc:** `docs/plans/2026-10-15-ux-streamline-design.md`. **Mockup:** https://claude.ai/artifact/YNkSmG2GVHAsFLgZJDLdRq

---

## Ground rules for whoever executes this

- **Branch:** work on `feat/ux-streamline` directly.
  - Never stage `docs/health-score-spot-check.docx` or `Project Prism Docs/`; they're the user's unrelated local files.
  - Always `git add` explicit paths.
- **Commands:** run them from `hosting/` unless a step says otherwise.
- **Baseline:** before Task 1, `npx vitest run` shows 111 tests passing (23 files) and `npx tsc --noEmit` is clean. Every task must end with both still green, and the test count only goes up, apart from tests deliberately ported or deleted.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- **Styling:**
  - Use only the CSS variables in `src/theme/global.css`; Task 6 adds a few new ones. No raw hex colours in components.
  - Use inline `style={{…}}` objects, which is the repo's existing idiom.
- **Data honesty:** every number in a takeaway is computed in code from deals or rows. LLM prose is never parsed for numbers, except `mrr` strings on LLM rows, which go through `parseMoney`.
- **Dates:** render as "15 Oct 2026" via `formatDate`.
- **Layout:** use `minmax(min(420px, 100%), 1fr)` in grid templates so nothing overflows at phone width.

### Deliberate differences from the mockup (data reality)

1. The mockup's "Newly at risk" column doesn't exist in the delta data.
   - The real columns are **Got worse / Improved / New & exited**, from `significantDealChanges.newPipeline` and `.exited`.
   - The Overview strip shows "↓ worse · ↑ improved · N new deals". The new-deal count only appears for All regions, because `newPipeline` has no region.
2. Competitor cards are built from CRO question 6 `threats` plus `competitiveDisplacement.lossMechanisms`, grouped by competitor. The full existing Competitive Displacement panel stays available under a "Full competitive analysis" disclosure.
3. The rep dropdown is a native `<select>`. Browsers already support type-to-jump, so no custom search widget (YAGNI).

---

## Task 1: Test fixtures + `dealMetrics.ts` (extract scoring from RiskRadar)

**Files:**
- Create: `hosting/src/test/fixtures.ts`
- Create: `hosting/src/lib/dealMetrics.ts`
- Test: `hosting/src/lib/dealMetrics.test.ts`
- Modify: `hosting/src/components/dashboard/RiskRadar.tsx` (delete local helpers, import from `dealMetrics`)

**Step 1: Create the shared fixtures**

`hosting/src/test/fixtures.ts`:
```ts
import type { RegionData, RiskDeal, StatData } from '@/lib/types';

let nextId = 1;

/** A plausible deal; override only what the test cares about. */
export function makeDeal(overrides: Partial<RiskDeal> = {}): RiskDeal {
  const id = nextId++;
  return {
    id,
    opportunityId: `OPP-${id}`,
    value: `Deal ${id}`,
    region: 'uk',
    level: 'MEDIUM',
    confidence: 50,
    summary: '',
    action: '',
    daysStalled: 0,
    stage: 'Proposal',
    rep: 'Jo',
    pipelineValue: 10_000,
    healthScore: 50,
    ...overrides,
  };
}

const stat = (value = '—'): StatData => ({ value, change: '—', dir: 'flat', sub: '' });

export function makeRegionData(risks: RiskDeal[], overrides: Partial<RegionData> = {}): RegionData {
  return {
    stats: { pipeline: stat(), atRisk: stat(), velocity: stat(), forecast: stat('70%') },
    sparklines: {},
    funnel: [],
    winThemes: [],
    lossThemes: [],
    risks,
    signals: [],
    competitors: [],
    recommendations: [],
    trendData: { weeks: [], all: [], na: [], uk: [], au: [] },
    ...overrides,
  };
}
```

**Step 2: Write the failing test**

`hosting/src/lib/dealMetrics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import { riskScore, riskBand, revenueConfidence, sumValue, isAtRisk, buildRiskDimensions } from './dealMetrics';

describe('riskScore', () => {
  it('is 100 minus the health score when one exists', () => {
    expect(riskScore(makeDeal({ healthScore: 30 }))).toBe(70);
  });

  it('falls back to level plus stall pressure without a health score', () => {
    expect(riskScore(makeDeal({ healthScore: undefined, level: 'HIGH', daysStalled: 3 }))).toBe(74);
    expect(riskScore(makeDeal({ healthScore: undefined, level: 'MEDIUM', daysStalled: 20 }))).toBe(54);
  });
});

describe('riskBand', () => {
  it('bands by health score', () => {
    expect(riskBand(makeDeal({ healthScore: 70 }))).toBe('Green');
    expect(riskBand(makeDeal({ healthScore: 40 }))).toBe('Yellow');
    expect(riskBand(makeDeal({ healthScore: 39 }))).toBe('Red');
  });

  it('bands by level without a health score', () => {
    expect(riskBand(makeDeal({ healthScore: undefined, level: 'HIGH' }))).toBe('Red');
  });
});

describe('revenueConfidence', () => {
  it('is the value-weighted average of (100 - risk)', () => {
    const deals = [
      makeDeal({ healthScore: 80, pipelineValue: 30_000 }),
      makeDeal({ healthScore: 20, pipelineValue: 10_000 }),
    ];
    expect(revenueConfidence(deals)).toBe(65);
  });

  it('is 0 with no deals', () => {
    expect(revenueConfidence([])).toBe(0);
  });
});

describe('sumValue / isAtRisk', () => {
  it('sums pipeline value, ignoring negatives and missing values', () => {
    expect(sumValue([makeDeal({ pipelineValue: 5_000 }), makeDeal({ pipelineValue: undefined }), makeDeal({ pipelineValue: -10 })])).toBe(5_000);
  });

  it('treats HIGH and MEDIUM as at risk', () => {
    expect(isAtRisk(makeDeal({ level: 'HIGH' }))).toBe(true);
    expect(isAtRisk(makeDeal({ level: 'MEDIUM' }))).toBe(true);
    expect(isAtRisk(makeDeal({ level: 'LOW' }))).toBe(false);
  });
});

describe('buildRiskDimensions', () => {
  it('returns every dimension label, normalised so the top driver is 100', () => {
    const dims = buildRiskDimensions([makeDeal({ summary: 'Champion has gone dark', daysStalled: 10 })]);
    expect(dims.map(d => d.label)).toContain('Stakeholders');
    expect(Math.max(...dims.map(d => d.value))).toBe(100);
  });
});
```

**Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/dealMetrics.test.ts`
Expected: FAIL. `Failed to resolve import "./dealMetrics"`.

**Step 4: Write the implementation**

`hosting/src/lib/dealMetrics.ts`:
```ts
import type { RiskDeal } from './types';
import { dimensionSignals, RISK_DIMENSION_LABELS } from './riskSignals';

/**
 * Deal scoring shared by every chart, takeaway and list. Extracted from
 * RiskRadar so the Overview, Deals tab and takeaways agree on one definition.
 */

export type RiskBand = 'Green' | 'Yellow' | 'Red';
export type RiskDimension = { label: string; value: number; pipeline: number };

export function riskScore(risk: RiskDeal): number {
  if (typeof risk.healthScore === 'number') return Math.max(0, Math.min(100, 100 - risk.healthScore));
  const stalledPressure = Math.min(18, Math.max(0, risk.daysStalled || 0) * 2);
  return risk.level === 'HIGH' ? 68 + stalledPressure : 36 + stalledPressure;
}

export function riskBand(risk: RiskDeal): RiskBand {
  if (typeof risk.healthScore === 'number') {
    if (risk.healthScore >= 70) return 'Green';
    if (risk.healthScore >= 40) return 'Yellow';
    return 'Red';
  }
  if (risk.level === 'HIGH') return 'Red';
  if (risk.level === 'MEDIUM') return 'Yellow';
  return 'Green';
}

export function dealValue(risk: RiskDeal): number {
  return Math.max(0, risk.pipelineValue || 0);
}

/** Value used for weighting: a deal with no value still counts once. */
export function weightedValue(risk: RiskDeal): number {
  const value = dealValue(risk);
  return value > 0 ? value : 1;
}

export function sumValue(risks: RiskDeal[]): number {
  return risks.reduce((sum, r) => sum + dealValue(r), 0);
}

export function isAtRisk(risk: RiskDeal): boolean {
  return risk.level === 'HIGH' || risk.level === 'MEDIUM';
}

/** Value-weighted health of the deals in view, 0–100. Computed in code, never by the LLM. */
export function revenueConfidence(risks: RiskDeal[]): number {
  const totalWeight = risks.reduce((sum, r) => sum + weightedValue(r), 0);
  if (!totalWeight) return 0;
  return Math.round(risks.reduce((sum, r) => sum + (100 - riskScore(r)) * weightedValue(r), 0) / totalWeight);
}

export function buildRiskDimensions(risks: RiskDeal[]): RiskDimension[] {
  const totals = RISK_DIMENSION_LABELS.reduce<Record<string, RiskDimension>>((acc, label) => {
    acc[label] = { label, value: 0, pipeline: 0 };
    return acc;
  }, {});

  for (const risk of risks) {
    const dimensions = dimensionSignals(risk);
    const pipeline = dealValue(risk);
    const severity = Math.max(0.25, riskScore(risk) / 100);
    const contribution = weightedValue(risk) * severity;
    for (const label of dimensions) {
      totals[label].value += contribution;
      totals[label].pipeline += pipeline / dimensions.length;
    }
  }

  const max = Math.max(...Object.values(totals).map(item => item.value), 1);
  return RISK_DIMENSION_LABELS.map(label => ({
    ...totals[label],
    value: Math.round((totals[label].value / max) * 100),
  }));
}
```

**Step 5: Run it to verify it passes**

Run: `npx vitest run src/lib/dealMetrics.test.ts`
Expected: PASS (9 tests).

**Step 6: Point RiskRadar at the shared helpers**

In `hosting/src/components/dashboard/RiskRadar.tsx`:
- Delete:
  - the local `type RiskBand`
  - `type RiskDimension`
  - `function riskScore`, `riskBand`, `dealValue`, `weightedValue`, `buildRiskDimensions`
- Keep `percent`, `clamp`, `matchesFilters`, `toggleList` and `exportToCSV`.
- Remove the now-unused `dimensionSignals, RISK_DIMENSION_LABELS` import.
- Add:
  ```ts
  import { riskScore, riskBand, dealValue, weightedValue, buildRiskDimensions, revenueConfidence, type RiskBand, type RiskDimension } from '@/lib/dealMetrics';
  ```
- In the `summary` `useMemo`, replace the inline `confidence` calculation with `const confidence = revenueConfidence(filteredRisks);`.

**Step 7: Run the whole suite and the type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass (111 + 9 = 120) and tsc prints nothing.

**Step 8: Commit**
```bash
git add src/test/fixtures.ts src/lib/dealMetrics.ts src/lib/dealMetrics.test.ts src/components/dashboard/RiskRadar.tsx
git commit -m "refactor(hosting): extract deal scoring into lib/dealMetrics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: `dealFilters.ts`: region, rep, stage, band, activity filters

**Files:**
- Create: `hosting/src/lib/dealFilters.ts`
- Test: `hosting/src/lib/dealFilters.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import { activityBucket, applyDealFilters, inRegion, repName, repsIn, stagesIn } from './dealFilters';

describe('activityBucket', () => {
  it.each([[0, 'active'], [6, 'active'], [7, 'cooling'], [13, 'cooling'], [14, 'dormant'], [29, 'dormant'], [30, 'dark'], [90, 'dark']])(
    '%i days is %s', (days, bucket) => {
      expect(activityBucket(days as number)).toBe(bucket);
    });
});

describe('inRegion', () => {
  it('returns everything for all, and matches legacy region names', () => {
    const deals = [makeDeal({ region: 'uk' }), makeDeal({ region: 'ANZ' }), makeDeal({ region: 'NAMER' })];
    expect(inRegion(deals, 'all')).toHaveLength(3);
    expect(inRegion(deals, 'au').map(d => d.region)).toEqual(['ANZ']);
    expect(inRegion(deals, 'na').map(d => d.region)).toEqual(['NAMER']);
  });
});

describe('applyDealFilters', () => {
  const a = makeDeal({ value: 'A', rep: 'Jo', stage: 'Commit', healthScore: 20, level: 'HIGH', daysStalled: 35 });
  const b = makeDeal({ value: 'B', rep: 'Sam', stage: 'Discovery', healthScore: 80, level: 'LOW', daysStalled: 2 });
  const c = makeDeal({ value: 'C', rep: undefined, stage: 'Proposal', healthScore: 50, level: 'MEDIUM', daysStalled: 15 });

  it('returns everything with no filters', () => {
    expect(applyDealFilters([a, b, c], {})).toHaveLength(3);
  });

  it('filters by rep, treating a missing rep as Unassigned', () => {
    expect(applyDealFilters([a, b, c], { rep: 'Unassigned' }).map(d => d.value)).toEqual(['C']);
  });

  it('combines stage, band, activity, risk-only and late-only', () => {
    expect(applyDealFilters([a, b, c], { stage: 'Commit' }).map(d => d.value)).toEqual(['A']);
    expect(applyDealFilters([a, b, c], { band: 'Yellow' }).map(d => d.value)).toEqual(['C']);
    expect(applyDealFilters([a, b, c], { activity: 'dark' }).map(d => d.value)).toEqual(['A']);
    expect(applyDealFilters([a, b, c], { riskOnly: true }).map(d => d.value)).toEqual(['A', 'C']);
    expect(applyDealFilters([a, b, c], { lateOnly: true }).map(d => d.value)).toEqual(['A', 'C']);
  });
});

describe('repsIn / stagesIn / repName', () => {
  it('lists reps alphabetically and stages in funnel order', () => {
    const deals = [makeDeal({ rep: 'Sam', stage: 'Commit' }), makeDeal({ rep: 'Jo', stage: 'Discovery' }), makeDeal({ rep: 'Jo', stage: 'Odd Stage' })];
    expect(repsIn(deals)).toEqual(['Jo', 'Sam']);
    expect(stagesIn(deals)).toEqual(['Discovery', 'Commit', 'Odd Stage']);
    expect(repName(makeDeal({ rep: '  ' }))).toBe('Unassigned');
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/dealFilters.test.ts`
Expected: FAIL. The module can't be resolved.

**Step 3: Write the implementation**

```ts
import type { Region, RiskDeal } from './types';
import { normalizeRegionKey } from './regions';
import { normalizeStage, isLateStage, STAGE_ORDER } from './format';
import { riskBand, isAtRisk, type RiskBand } from './dealMetrics';

export type ActivityBucket = 'active' | 'cooling' | 'dormant' | 'dark';

/** Same thresholds as isDormant / isDark in dealClassifiers. */
export const ACTIVITY_BUCKETS: { key: ActivityBucket; label: string; range: string }[] = [
  { key: 'active', label: 'Active', range: '0–6 days' },
  { key: 'cooling', label: 'Cooling', range: '7–13 days' },
  { key: 'dormant', label: 'Dormant', range: '14–29 days' },
  { key: 'dark', label: 'Dark', range: '30+ days' },
];

export function activityBucket(daysStalled: number): ActivityBucket {
  if (daysStalled >= 30) return 'dark';
  if (daysStalled >= 14) return 'dormant';
  if (daysStalled >= 7) return 'cooling';
  return 'active';
}

export function repName(deal: RiskDeal): string {
  return deal.rep?.trim() || 'Unassigned';
}

/** Deals in one region. Region values are normalised so legacy names (ANZ, NAMER) match. */
export function inRegion(deals: RiskDeal[], region: Region): RiskDeal[] {
  if (region === 'all') return deals;
  return deals.filter(d => normalizeRegionKey(d.region) === region);
}

export interface DealFilters {
  rep?: string;
  stage?: string;
  band?: RiskBand;
  activity?: ActivityBucket;
  riskOnly?: boolean;
  lateOnly?: boolean;
}

export function applyDealFilters(deals: RiskDeal[], filters: DealFilters): RiskDeal[] {
  return deals.filter(d => {
    if (filters.rep && repName(d) !== filters.rep) return false;
    if (filters.stage && normalizeStage(d.stage) !== filters.stage) return false;
    if (filters.band && riskBand(d) !== filters.band) return false;
    if (filters.activity && activityBucket(d.daysStalled) !== filters.activity) return false;
    if (filters.riskOnly && !isAtRisk(d)) return false;
    if (filters.lateOnly && !isLateStage(d.stage)) return false;
    return true;
  });
}

export function repsIn(deals: RiskDeal[]): string[] {
  return [...new Set(deals.map(repName))].sort((a, b) => a.localeCompare(b));
}

export function stagesIn(deals: RiskDeal[]): string[] {
  const present = new Set(deals.map(d => normalizeStage(d.stage)));
  const known = STAGE_ORDER.filter(s => present.has(s));
  const other = [...present].filter(s => !STAGE_ORDER.includes(s)).sort();
  return [...known, ...other];
}
```

**Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/dealFilters.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/dealFilters.ts src/lib/dealFilters.test.ts
git commit -m "feat(hosting): shared deal filters (region, rep, stage, band, activity)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: `parseMoney` + `takeaways.ts`

**Files:**
- Modify: `hosting/src/lib/format.ts` (add `parseMoney`)
- Modify: `hosting/src/lib/format.test.ts` (add tests)
- Create: `hosting/src/lib/takeaways.ts`
- Test: `hosting/src/lib/takeaways.test.ts`

**Step 1: Write the failing tests**

Append to `hosting/src/lib/format.test.ts`. Add `parseMoney` to that file's existing import from `./format`.
```ts
describe('parseMoney', () => {
  it.each([
    ['$12,400', 12_400],
    ['$1.2M', 1_200_000],
    ['$40K', 40_000],
    ['£3.5k MRR', 3_500],
    ['n/a', 0],
    ['', 0],
  ])('parses %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it('passes finite numbers through and treats undefined as 0', () => {
    expect(parseMoney(250)).toBe(250);
    expect(parseMoney(undefined)).toBe(0);
  });
});
```

`hosting/src/lib/takeaways.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import {
  riskMapTakeaway, driversTakeaway, regionTakeaway, queueTakeaway, stageTakeaway,
  activityTakeaway, forecastTakeaway, funnelTakeaway, repTakeaway, interventionsTakeaway,
  changeTakeaway, competitorTakeaway,
} from './takeaways';

describe('riskMapTakeaway', () => {
  it('states the HIGH-risk share of at-risk value', () => {
    const deals = [
      makeDeal({ level: 'HIGH', pipelineValue: 30_000 }),
      makeDeal({ level: 'MEDIUM', pipelineValue: 10_000 }),
      makeDeal({ level: 'LOW', pipelineValue: 50_000 }),
    ];
    expect(riskMapTakeaway(deals)).toBe('1 HIGH-risk deal holds 75% of the $40K at risk.');
  });

  it('handles no risk', () => {
    expect(riskMapTakeaway([makeDeal({ level: 'LOW' })])).toBe('No deals are flagged at risk in this view.');
  });
});

describe('driversTakeaway', () => {
  it('names the top two drivers', () => {
    const dims = [
      { label: 'Engagement', value: 100, pipeline: 0 },
      { label: 'Stakeholders', value: 80, pipeline: 0 },
      { label: 'Process', value: 10, pipeline: 0 },
    ];
    expect(driversTakeaway(62, dims)).toBe('Revenue confidence is 62/100. Engagement is the biggest risk driver, then stakeholders.');
  });

  it('copes with no drivers', () => {
    expect(driversTakeaway(90, [{ label: 'Process', value: 0, pipeline: 0 }])).toBe('Revenue confidence is 90/100. No single risk driver stands out.');
  });
});

describe('regionTakeaway', () => {
  it('names the lowest-confidence region that has deals', () => {
    expect(regionTakeaway([
      { label: 'North America', confidence: 60, dealCount: 5 },
      { label: 'UK', confidence: 41, dealCount: 3 },
      { label: 'AU / NZ', confidence: 10, dealCount: 0 },
    ])).toBe('UK has the lowest revenue confidence (41/100).');
  });
});

describe('queueTakeaway', () => {
  const q = [makeDeal({ value: 'A', pipelineValue: 20_000 }), makeDeal({ value: 'B', pipelineValue: 5_000 })];

  it('counts what is still to review', () => {
    expect(queueTakeaway(q, d => d.value === 'A')).toBe('1 deal worth $5K still needs a look.');
  });

  it('celebrates an empty queue and handles none', () => {
    expect(queueTakeaway(q, () => true)).toBe('All done: every deal in this queue has been reviewed.');
    expect(queueTakeaway([], () => false)).toBe('No late-stage deals in this view.');
  });
});

describe('panel takeaways', () => {
  it('stageTakeaway names the stage holding the most HIGH-risk value', () => {
    const deals = [
      makeDeal({ level: 'HIGH', stage: 'Commit', pipelineValue: 40_000 }),
      makeDeal({ level: 'HIGH', stage: 'Proposal', pipelineValue: 5_000 }),
    ];
    expect(stageTakeaway(deals)).toBe('Commit holds 1 HIGH-risk deal worth $40K.');
  });

  it('activityTakeaway counts deals quiet for 14+ days', () => {
    expect(activityTakeaway([makeDeal({ daysStalled: 20, pipelineValue: 8_000 }), makeDeal({ daysStalled: 2 })]))
      .toBe('1 deal worth $8K has had no activity for 14+ days.');
  });

  it('forecastTakeaway uses the shared misalignment rule', () => {
    expect(forecastTakeaway([makeDeal({ confidence: 85, healthScore: 20, pipelineValue: 12_000 })]))
      .toBe('1 deal worth $12K looks stronger in the forecast than its health suggests.');
    expect(forecastTakeaway([makeDeal({ confidence: 50, healthScore: 70 })]))
      .toBe('Rep confidence and deal health line up across this view.');
  });

  it('funnelTakeaway compares early and later stages', () => {
    expect(funnelTakeaway([
      { stage: 'Discovery', count: 2, revenue: '', color: '' },
      { stage: 'Commit', count: 9, revenue: '', color: '' },
    ])).toBe('2 deals in early stages and 9 in later stages. Early pipeline looks thin for next quarter.');
  });

  it('repTakeaway names the lowest-confidence rep', () => {
    const deals = [
      makeDeal({ rep: 'Jo', healthScore: 20, level: 'HIGH', pipelineValue: 30_000 }),
      makeDeal({ rep: 'Sam', healthScore: 90, level: 'LOW' }),
    ];
    expect(repTakeaway(deals)).toBe('Jo has the lowest revenue confidence (20/100) with $30K at risk.');
  });

  it('interventionsTakeaway sums MRR from LLM rows', () => {
    expect(interventionsTakeaway([{ mrr: '$12,000' }, { mrr: '$3K' }])).toBe('2 deals worth $15K need you personally.');
    expect(interventionsTakeaway([])).toBe('Nothing in this view needs CRO intervention.');
  });

  it('changeTakeaway leads with the biggest concern', () => {
    const d = (deal: string) => ({ deal, rep: 'Jo', region: 'UK', change: 'x' });
    expect(changeTakeaway([d('Acme'), d('Beta')], [d('Gamma')])).toBe('2 deals got worse and 1 improved. Biggest concern: Acme.');
    expect(changeTakeaway([], [])).toBe('No deal-level changes in this view since the last run.');
  });

  it('competitorTakeaway picks the biggest threat by value', () => {
    expect(competitorTakeaway([
      { name: 'JobLogic', deals: 3, value: 20_000 },
      { name: 'ServiceM8', deals: 5, value: 9_000 },
    ])).toBe('JobLogic is the biggest threat here: 3 deals worth $20K.');
  });
});
```

**Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/format.test.ts src/lib/takeaways.test.ts`
Expected: FAIL. `parseMoney` isn't exported, and `./takeaways` can't be resolved.

**Step 3: Write the implementation**

Append to `hosting/src/lib/format.ts`:
```ts
const MONEY = /(-?\d[\d,]*(?:\.\d+)?|-?\.\d+)\s*([kKmMbB])?/;
const MULTIPLIER: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

/**
 * Parse an LLM-authored money string ("$12,400", "$1.2M", "£40K MRR") to a
 * number. Anything unparseable is 0 so a takeaway never shows NaN.
 */
export function parseMoney(input?: string | number): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (!input) return 0;
  const match = MONEY.exec(input);
  if (!match) return 0;
  const n = Number(match[1].replace(/,/g, ''));
  const mult = MULTIPLIER[(match[2] ?? '').toLowerCase()] ?? 1;
  return Number.isFinite(n) ? n * mult : 0;
}
```

`hosting/src/lib/takeaways.ts`:
```ts
import type { DeltaDeal, FunnelStage, RiskDeal } from './types';
import { formatCurrency, normalizeStage, parseMoney } from './format';
import { isAtRisk, revenueConfidence, sumValue, type RiskDimension } from './dealMetrics';
import { isMisaligned } from './dealClassifiers';
import { repName } from './dealFilters';

/**
 * One-line panel takeaways. Every figure is computed here from deals or rows;
 * none is read out of LLM prose (project rule: numbers from code, prose from the LLM).
 */

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const pick = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function riskMapTakeaway(deals: RiskDeal[]): string {
  const atRisk = deals.filter(isAtRisk);
  if (!atRisk.length) return 'No deals are flagged at risk in this view.';
  const high = deals.filter(d => d.level === 'HIGH');
  const atRiskValue = sumValue(atRisk);
  if (atRiskValue <= 0) {
    return `${plural(atRisk.length, 'deal')} ${pick(atRisk.length, 'is', 'are')} flagged at risk, ${high.length} of them HIGH.`;
  }
  const share = Math.round((sumValue(high) / atRiskValue) * 100);
  return `${plural(high.length, 'HIGH-risk deal')} ${pick(high.length, 'holds', 'hold')} ${share}% of the ${formatCurrency(atRiskValue)} at risk.`;
}

export function driversTakeaway(confidence: number, dimensions: RiskDimension[]): string {
  const ranked = [...dimensions].filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  if (!ranked.length) return `Revenue confidence is ${confidence}/100. No single risk driver stands out.`;
  const then = ranked[1] ? `, then ${ranked[1].label.toLowerCase()}` : '';
  return `Revenue confidence is ${confidence}/100. ${ranked[0].label} is the biggest risk driver${then}.`;
}

export function regionTakeaway(rows: { label: string; confidence: number; dealCount: number }[]): string {
  const withDeals = rows.filter(r => r.dealCount > 0);
  if (!withDeals.length) return 'No regional data in this report.';
  const lowest = [...withDeals].sort((a, b) => a.confidence - b.confidence)[0];
  return `${lowest.label} has the lowest revenue confidence (${lowest.confidence}/100).`;
}

export function queueTakeaway(queue: RiskDeal[], isDone: (deal: RiskDeal) => boolean): string {
  if (!queue.length) return 'No late-stage deals in this view.';
  const todo = queue.filter(d => !isDone(d));
  if (!todo.length) return 'All done: every deal in this queue has been reviewed.';
  return `${plural(todo.length, 'deal')} worth ${formatCurrency(sumValue(todo))} still ${pick(todo.length, 'needs', 'need')} a look.`;
}

export function stageTakeaway(deals: RiskDeal[]): string {
  const byStage = new Map<string, RiskDeal[]>();
  for (const d of deals.filter(x => x.level === 'HIGH')) {
    const stage = normalizeStage(d.stage);
    byStage.set(stage, [...(byStage.get(stage) ?? []), d]);
  }
  if (!byStage.size) return 'No HIGH-risk deals in this view.';
  const [stage, list] = [...byStage.entries()]
    .sort((a, b) => sumValue(b[1]) - sumValue(a[1]) || b[1].length - a[1].length)[0];
  return `${stage} holds ${plural(list.length, 'HIGH-risk deal')} worth ${formatCurrency(sumValue(list))}.`;
}

export function activityTakeaway(deals: RiskDeal[]): string {
  const quiet = deals.filter(d => d.daysStalled >= 14);
  if (!quiet.length) return 'Every deal has had activity in the last two weeks.';
  return `${plural(quiet.length, 'deal')} worth ${formatCurrency(sumValue(quiet))} ${pick(quiet.length, 'has', 'have')} had no activity for 14+ days.`;
}

export function forecastTakeaway(deals: RiskDeal[]): string {
  const misaligned = deals.filter(isMisaligned);
  if (!misaligned.length) return 'Rep confidence and deal health line up across this view.';
  const n = misaligned.length;
  return `${plural(n, 'deal')} worth ${formatCurrency(sumValue(misaligned))} ${pick(n, 'looks', 'look')} stronger in the forecast than ${pick(n, 'its', 'their')} health suggests.`;
}

const EARLY_STAGES = new Set(['Discovery', 'Qualification', 'Solution']);

export function funnelTakeaway(stages: FunnelStage[]): string {
  if (!stages.length) return 'No stage data in this report.';
  const early = stages.filter(s => EARLY_STAGES.has(normalizeStage(s.stage))).reduce((n, s) => n + s.count, 0);
  const later = stages.filter(s => !EARLY_STAGES.has(normalizeStage(s.stage))).reduce((n, s) => n + s.count, 0);
  const thin = early < later / 2 ? ' Early pipeline looks thin for next quarter.' : '';
  return `${plural(early, 'deal')} in early stages and ${later} in later stages.${thin}`;
}

export function repTakeaway(deals: RiskDeal[]): string {
  const byRep = new Map<string, RiskDeal[]>();
  for (const d of deals) byRep.set(repName(d), [...(byRep.get(repName(d)) ?? []), d]);
  if (!byRep.size) return 'No reps in this view.';
  const rows = [...byRep.entries()].map(([rep, list]) => ({
    rep,
    confidence: revenueConfidence(list),
    atRisk: sumValue(list.filter(isAtRisk)),
  }));
  const lowest = rows.sort((a, b) => a.confidence - b.confidence)[0];
  return `${lowest.rep} has the lowest revenue confidence (${lowest.confidence}/100) with ${formatCurrency(lowest.atRisk)} at risk.`;
}

export function interventionsTakeaway(rows: { mrr?: string }[]): string {
  if (!rows.length) return 'Nothing in this view needs CRO intervention.';
  const value = rows.reduce((sum, r) => sum + parseMoney(r.mrr), 0);
  const worth = value > 0 ? ` worth ${formatCurrency(value)}` : '';
  return `${plural(rows.length, 'deal')}${worth} ${pick(rows.length, 'needs', 'need')} you personally.`;
}

export function changeTakeaway(worse: DeltaDeal[], better: DeltaDeal[]): string {
  if (!worse.length) {
    return better.length
      ? `${plural(better.length, 'deal')} improved and nothing got worse since the last run.`
      : 'No deal-level changes in this view since the last run.';
  }
  return `${plural(worse.length, 'deal')} got worse and ${better.length} improved. Biggest concern: ${worse[0].deal}.`;
}

export function competitorTakeaway(cards: { name: string; deals: number; value: number }[]): string {
  if (!cards.length) return 'No competitor threats recorded for this view.';
  const top = [...cards].sort((a, b) => b.value - a.value || b.deals - a.deals)[0];
  const worth = top.value > 0 ? ` worth ${formatCurrency(top.value)}` : '';
  return `${top.name} is the biggest threat here: ${plural(top.deals, 'deal')}${worth}.`;
}
```

**Step 4: Run them to verify they pass**

Run: `npx vitest run src/lib/format.test.ts src/lib/takeaways.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/format.ts src/lib/format.test.ts src/lib/takeaways.ts src/lib/takeaways.test.ts
git commit -m "feat(hosting): code-computed panel takeaways and parseMoney

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: `dashboardView.ts`: tabs and URL hash parse/serialise

**Files:**
- Create: `hosting/src/lib/dashboardView.ts`
- Test: `hosting/src/lib/dashboardView.test.ts`

**Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest';
import { parseHash, toHash, TABS } from './dashboardView';

describe('TABS', () => {
  it('runs in the agreed order', () => {
    expect(TABS.map(t => t.label)).toEqual(['Overview', 'CRO Brief', 'Deals', 'Pipeline Health', 'Competition & Change']);
  });
});

describe('toHash / parseHash', () => {
  it('serialises region always and filters only when set', () => {
    expect(toHash({ tab: 'overview', region: 'all' })).toBe('#overview?region=all');
    expect(toHash({ tab: 'deals', region: 'uk', rep: 'S. Hughes', riskOnly: true }))
      .toBe('#deals?region=uk&rep=S.+Hughes&risk=1');
  });

  it('round-trips every field', () => {
    const view = {
      tab: 'deals' as const, region: 'au' as const, rep: 'Jo Smith', stage: 'Commit',
      band: 'Red' as const, activity: 'dormant' as const, riskOnly: true, lateOnly: true, hideReviewed: true,
    };
    expect(parseHash(toHash(view))).toEqual(view);
  });

  it('ignores unknown tabs and invalid values', () => {
    expect(parseHash('#nope?region=mars&band=Purple&activity=asleep')).toEqual({});
  });

  it('returns nothing for an empty hash', () => {
    expect(parseHash('')).toEqual({});
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/dashboardView.test.ts` → FAIL (module missing).

**Step 3: Write the implementation**
```ts
import type { Region } from './types';
import type { RiskBand } from './dealMetrics';
import type { ActivityBucket, DealFilters } from './dealFilters';

export type TabKey = 'overview' | 'cro' | 'deals' | 'health' | 'comp';

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'cro', label: 'CRO Brief' },
  { key: 'deals', label: 'Deals' },
  { key: 'health', label: 'Pipeline Health' },
  { key: 'comp', label: 'Competition & Change' },
];

/** Everything that decides what the dashboard shows. Mirrored in the URL hash. */
export interface DashboardView extends DealFilters {
  tab: TabKey;
  region: Region;
  hideReviewed?: boolean;
}

const TAB_KEYS = new Set<string>(TABS.map(t => t.key));
const REGIONS = new Set<string>(['all', 'na', 'uk', 'au']);
const BANDS = new Set<string>(['Green', 'Yellow', 'Red']);
const BUCKETS = new Set<string>(['active', 'cooling', 'dormant', 'dark']);

export function parseHash(hash: string): Partial<DashboardView> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const q = raw.indexOf('?');
  const path = q === -1 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q === -1 ? '' : raw.slice(q + 1));
  const view: Partial<DashboardView> = {};

  if (TAB_KEYS.has(path)) view.tab = path as TabKey;
  const region = params.get('region');
  if (region && REGIONS.has(region)) view.region = region as Region;
  const rep = params.get('rep');
  if (rep) view.rep = rep;
  const stage = params.get('stage');
  if (stage) view.stage = stage;
  const band = params.get('band');
  if (band && BANDS.has(band)) view.band = band as RiskBand;
  const activity = params.get('activity');
  if (activity && BUCKETS.has(activity)) view.activity = activity as ActivityBucket;
  if (params.get('risk') === '1') view.riskOnly = true;
  if (params.get('late') === '1') view.lateOnly = true;
  if (params.get('hideReviewed') === '1') view.hideReviewed = true;
  return view;
}

export function toHash(view: DashboardView): string {
  const params = new URLSearchParams();
  params.set('region', view.region);
  if (view.rep) params.set('rep', view.rep);
  if (view.stage) params.set('stage', view.stage);
  if (view.band) params.set('band', view.band);
  if (view.activity) params.set('activity', view.activity);
  if (view.riskOnly) params.set('risk', '1');
  if (view.lateOnly) params.set('late', '1');
  if (view.hideReviewed) params.set('hideReviewed', '1');
  return `#${view.tab}?${params.toString()}`;
}
```

**Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/dashboardView.test.ts` → PASS.

**Step 5: Commit**
```bash
git add src/lib/dashboardView.ts src/lib/dashboardView.test.ts
git commit -m "feat(hosting): dashboard view model with shareable URL hash

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: `useDashboardView` hook

**Files:**
- Create: `hosting/src/hooks/useDashboardView.ts`
- Test: `hosting/src/hooks/useDashboardView.test.ts`

**Step 1: Write the failing test**
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardView, LAST_REGION_KEY } from './useDashboardView';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('useDashboardView', () => {
  it('defaults to Overview / All and writes that to the address bar', () => {
    const { result } = renderHook(() => useDashboardView());
    expect(result.current.view).toEqual({ tab: 'overview', region: 'all' });
    expect(window.location.hash).toBe('#overview?region=all');
  });

  it('reads the view from the hash', () => {
    window.history.replaceState(null, '', '/#deals?region=uk&rep=Jo');
    const { result } = renderHook(() => useDashboardView());
    expect(result.current.view).toEqual({ tab: 'deals', region: 'uk', rep: 'Jo' });
  });

  it('falls back to the last region this browser used', () => {
    localStorage.setItem(LAST_REGION_KEY, 'au');
    const { result } = renderHook(() => useDashboardView());
    expect(result.current.view.region).toBe('au');
  });

  it('selectRegion updates the hash and memory and clears the rep', () => {
    window.history.replaceState(null, '', '/#deals?region=uk&rep=Jo');
    const { result } = renderHook(() => useDashboardView());
    act(() => result.current.selectRegion('na'));
    expect(result.current.view).toEqual({ tab: 'deals', region: 'na' });
    expect(window.location.hash).toBe('#deals?region=na');
    expect(localStorage.getItem(LAST_REGION_KEY)).toBe('na');
  });

  it('goToDeals switches tab, keeps region and replaces filters', () => {
    window.history.replaceState(null, '', '/#overview?region=uk&stage=Commit');
    const { result } = renderHook(() => useDashboardView());
    act(() => result.current.goToDeals({ riskOnly: true }));
    expect(result.current.view).toEqual({ tab: 'deals', region: 'uk', riskOnly: true });
  });

  it('setFilters patches filters and an undefined value removes one', () => {
    window.history.replaceState(null, '', '/#deals?region=uk&rep=Jo&risk=1');
    const { result } = renderHook(() => useDashboardView());
    act(() => result.current.setFilters({ rep: undefined, stage: 'Commit' }));
    expect(window.location.hash).toBe('#deals?region=uk&stage=Commit&risk=1');
  });

  it('follows back/forward navigation', () => {
    const { result } = renderHook(() => useDashboardView());
    act(() => {
      window.history.replaceState(null, '', '/#cro?region=na');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.view).toEqual({ tab: 'cro', region: 'na' });
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/hooks/useDashboardView.test.ts` → FAIL (module missing).

**Step 3: Write the implementation**
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Region } from '@/lib/types';
import type { DealFilters } from '@/lib/dealFilters';
import { parseHash, toHash, type DashboardView, type TabKey } from '@/lib/dashboardView';

export const LAST_REGION_KEY = 'prism-last-region';
const REGIONS: Region[] = ['all', 'na', 'uk', 'au'];

function readStoredRegion(): Region | undefined {
  try {
    const value = localStorage.getItem(LAST_REGION_KEY);
    return REGIONS.includes(value as Region) ? (value as Region) : undefined;
  } catch {
    return undefined;
  }
}

function storeRegion(region: Region): void {
  try {
    localStorage.setItem(LAST_REGION_KEY, region);
  } catch {
    // Private mode / blocked storage: remembering the region is a convenience only.
  }
}

function viewFromLocation(): DashboardView {
  const parsed = parseHash(window.location.hash);
  return { ...parsed, tab: parsed.tab ?? 'overview', region: parsed.region ?? readStoredRegion() ?? 'all' };
}

/**
 * Single source of truth for tab, region and Deals filters. The URL hash
 * mirrors it so views are shareable and the browser back button works.
 */
export function useDashboardView() {
  const [view, setView] = useState<DashboardView>(viewFromLocation);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Make the address bar show the resolved view without adding a history entry.
  useEffect(() => {
    window.history.replaceState(null, '', toHash(viewRef.current));
  }, []);

  useEffect(() => {
    const sync = () => setView(viewFromLocation());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const navigate = useCallback((next: DashboardView) => {
    const hash = toHash(next);
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    storeRegion(next.region);
    viewRef.current = next;
    setView(next);
  }, []);

  const selectTab = useCallback((tab: TabKey) => navigate({ ...viewRef.current, tab }), [navigate]);

  // A rep belongs to one region, so changing region drops the rep filter.
  const selectRegion = useCallback(
    (region: Region) => navigate({ ...viewRef.current, region, rep: undefined }),
    [navigate],
  );

  const setFilters = useCallback(
    (patch: Partial<DealFilters & { hideReviewed?: boolean }>) => navigate({ ...viewRef.current, ...patch }),
    [navigate],
  );

  const goToDeals = useCallback(
    (filters: DealFilters = {}) => navigate({ tab: 'deals', region: viewRef.current.region, ...filters }),
    [navigate],
  );

  return { view, selectTab, selectRegion, setFilters, goToDeals };
}
```

> Note: `toEqual` ignores keys whose value is `undefined`, which is why `{ ..., rep: undefined }` equals `{ tab, region }` in the tests.

**Step 4: Run it to verify it passes**

Run: `npx vitest run src/hooks/useDashboardView.test.ts` → PASS (7 tests).

**Step 5: Commit**
```bash
git add src/hooks/useDashboardView.ts src/hooks/useDashboardView.test.ts
git commit -m "feat(hosting): useDashboardView hook (tab, region, filters in URL)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Light theme by default + new colour tokens

**Files:**
- Modify: `hosting/src/theme/ThemeProvider.tsx`
- Test: `hosting/src/theme/ThemeProvider.test.tsx`
- Modify: `hosting/src/theme/global.css`

**Step 1: Write the failing test**
```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  // Simulate an OS set to dark mode: the app must still open in light.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('dark'), media: query, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

describe('ThemeProvider', () => {
  it('opens in light mode even when the OS prefers dark', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('respects and persists an explicit choice', () => {
    localStorage.setItem('prism-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('prism-theme')).toBe('light');
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/theme/ThemeProvider.test.tsx`
Expected: the first test FAILS with "expected 'dark' …", because the provider currently follows the OS.

**Step 3: Write the implementation**

In `ThemeProvider.tsx`:
- Replace `getInitialTheme` with:
  ```ts
  /** Light unless this browser has explicitly chosen dark. The OS setting is deliberately ignored. */
  function getInitialTheme(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // Storage blocked: fall through to the default.
    }
    return 'light';
  }
  ```
- Delete the second `useEffect` (the `matchMedia` OS listener). It was dead code: the first effect always writes `localStorage`, so the listener's `!localStorage.getItem(...)` check was never true.

In `global.css`:
- Inside the existing `:root { … }` block, before `color-scheme: light;`, add:
  ```css
  /* Text on tinted backgrounds + filled controls (UX streamline). */
  --takeaway-bg: rgba(37, 99, 235, 0.07);
  --takeaway-text: #1e3a8a;
  --error-text: #b91c1c;
  --warning-text: #92400e;
  --success-text: #15803d;
  --accent-fill: #2563eb;
  --on-accent: #ffffff;
  ```
- Inside `[data-theme="dark"] { … }`, before `color-scheme: dark;`, add:
  ```css
  --takeaway-bg: rgba(59, 130, 246, 0.15);
  --takeaway-text: #bfdbfe;
  --error-text: #f87171;
  --warning-text: #fbbf24;
  --success-text: #4ade80;
  --accent-fill: #2563eb;
  --on-accent: #ffffff;
  ```

**Step 4: Run it to verify it passes, then run the full suite**

Run: `npx vitest run src/theme/ThemeProvider.test.tsx && npx vitest run`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/theme/ThemeProvider.tsx src/theme/ThemeProvider.test.tsx src/theme/global.css
git commit -m "feat(hosting): light theme by default; add text-on-tint colour tokens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Review model, context and `ReviewButton`

Shared reviews need a stable model and UI before Firestore is wired in (Task 9). Components read reviews through a React context, so tests can swap in an in-memory store.

**Files:**
- Create: `hosting/src/lib/reviews.ts`
- Test: `hosting/src/lib/reviews.test.ts`
- Create: `hosting/src/components/reviews/ReviewsContext.tsx`
- Create: `hosting/src/components/reviews/ReviewButton.tsx`
- Test: `hosting/src/components/reviews/ReviewButton.test.tsx`

**Step 1: Write the failing tests**

`hosting/src/lib/reviews.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import { dealKey, isWorseSinceReview, reviewsApiFromMap, type DealReview } from './reviews';

const review = (riskAtReview: number): DealReview => ({
  reviewedBy: 'brad.towers@simprogroup.com', reviewedByName: 'Brad Towers', reviewedAt: new Date('2026-10-15T09:00:00Z'), riskAtReview,
});

describe('dealKey', () => {
  it('prefers the opportunity id and makes it safe as a Firestore doc id', () => {
    expect(dealKey(makeDeal({ opportunityId: '006ABC' }))).toBe('006ABC');
    expect(dealKey(makeDeal({ opportunityId: undefined, value: 'Acme / Renewal' }))).toBe('Acme%20%2F%20Renewal');
  });

  it('never produces a reserved id', () => {
    expect(dealKey(makeDeal({ opportunityId: '..' }))).toBe('k_..');
    expect(dealKey(makeDeal({ opportunityId: '__x__' }))).toBe('k___x__');
  });
});

describe('isWorseSinceReview', () => {
  it('is true only when risk rose after the review', () => {
    const deal = makeDeal({ healthScore: 30 }); // risk 70
    expect(isWorseSinceReview(deal, review(60))).toBe(true);
    expect(isWorseSinceReview(deal, review(70))).toBe(false);
  });
});

describe('reviewsApiFromMap', () => {
  it('reports done / worse and routes toggle to save or remove', () => {
    const done = makeDeal({ opportunityId: 'A', healthScore: 50 });  // risk 50
    const worse = makeDeal({ opportunityId: 'B', healthScore: 20 }); // risk 80
    const fresh = makeDeal({ opportunityId: 'C' });
    const writer = { save: vi.fn(), remove: vi.fn() };
    const api = reviewsApiFromMap(new Map([['A', review(50)], ['B', review(60)]]), writer);

    expect(api.isDone(done)).toBe(true);
    expect(api.isWorse(worse)).toBe(true);
    expect(api.isDone(worse)).toBe(false);
    expect(api.getReview(fresh)).toBeUndefined();

    api.toggle(done);
    expect(writer.remove).toHaveBeenCalledWith(done);
    api.toggle(worse); // a worse-since-review deal is re-reviewed, not cleared
    api.toggle(fresh);
    expect(writer.save).toHaveBeenCalledWith(worse);
    expect(writer.save).toHaveBeenCalledWith(fresh);
  });
});
```

`hosting/src/components/reviews/ReviewButton.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from './ReviewsContext';
import { ReviewButton } from './ReviewButton';

describe('ReviewButton', () => {
  it('toggles a shared review and shows who reviewed it', () => {
    const deal = makeDeal({ value: 'Acme' });
    render(<MemoryReviewsProvider><ReviewButton deal={deal} /></MemoryReviewsProvider>);
    const button = screen.getByRole('button', { name: 'Mark reviewed: Acme' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Reviewed: Acme' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
  });

  it('flags a deal that got worse since it was reviewed', () => {
    const deal = makeDeal({ opportunityId: 'X', value: 'Acme', healthScore: 20 }); // risk 80
    render(
      <MemoryReviewsProvider initial={{ X: { reviewedBy: 'a@simprogroup.com', reviewedByName: 'Ann', reviewedAt: null, riskAtReview: 50 } }}>
        <ReviewButton deal={deal} />
      </MemoryReviewsProvider>,
    );
    expect(screen.getByText('Worse since review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review again: Acme' })).toBeInTheDocument();
  });

  it('does not let the click bubble to a clickable card', () => {
    const onCard = vi.fn();
    render(
      <MemoryReviewsProvider>
        <div onClick={onCard}><ReviewButton deal={makeDeal({ value: 'Acme' })} /></div>
      </MemoryReviewsProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onCard).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/reviews.test.ts src/components/reviews`
Expected: FAIL (modules missing).

**Step 3: Write the implementation**

`hosting/src/lib/reviews.ts`:
```ts
import type { RiskDeal } from './types';
import { riskScore } from './dealMetrics';

/** One shared review, stored at /dealReviews/{dealKey}. */
export interface DealReview {
  reviewedBy: string;      // reviewer's email (rules enforce it is the signed-in user)
  reviewedByName: string;
  reviewedAt: Date | null; // null while the server timestamp is pending
  riskAtReview: number;    // riskScore when reviewed; lets us spot deals that got worse
}

export interface ReviewsApi {
  getReview(deal: RiskDeal): DealReview | undefined;
  /** Reviewed, and not worse since. */
  isDone(deal: RiskDeal): boolean;
  /** Reviewed, but its risk has risen since. Counts as not done. */
  isWorse(deal: RiskDeal): boolean;
  toggle(deal: RiskDeal): void;
  error?: string;
}

export interface ReviewWriter {
  save(deal: RiskDeal): void;
  remove(deal: RiskDeal): void;
}

/** Firestore-safe document id: '/' is encoded and reserved ids are prefixed. */
export function dealKey(deal: Pick<RiskDeal, 'opportunityId' | 'value'>): string {
  const encoded = encodeURIComponent((deal.opportunityId || deal.value || '').trim());
  const reserved = encoded === '' || encoded === '.' || encoded === '..' || /^__.*__$/.test(encoded);
  return reserved ? `k_${encoded}` : encoded;
}

export function isWorseSinceReview(deal: RiskDeal, review: DealReview): boolean {
  return riskScore(deal) > review.riskAtReview;
}

export function reviewsApiFromMap(reviews: Map<string, DealReview>, writer: ReviewWriter, error?: string): ReviewsApi {
  const getReview = (deal: RiskDeal) => reviews.get(dealKey(deal));
  const isWorse = (deal: RiskDeal) => {
    const review = getReview(deal);
    return !!review && isWorseSinceReview(deal, review);
  };
  const isDone = (deal: RiskDeal) => !!getReview(deal) && !isWorse(deal);
  return {
    getReview,
    isDone,
    isWorse,
    toggle: (deal) => (isDone(deal) ? writer.remove(deal) : writer.save(deal)),
    error,
  };
}
```

`hosting/src/components/reviews/ReviewsContext.tsx`:
```tsx
import React, { createContext, useContext, useMemo, useState } from 'react';
import { dealKey, reviewsApiFromMap, type DealReview, type ReviewsApi } from '@/lib/reviews';
import { riskScore } from '@/lib/dealMetrics';

const NOOP_REVIEWS: ReviewsApi = {
  getReview: () => undefined,
  isDone: () => false,
  isWorse: () => false,
  toggle: () => undefined,
};

/** App provides the Firestore-backed store (useSharedReviews); the default is inert. */
export const ReviewsContext = createContext<ReviewsApi>(NOOP_REVIEWS);

export function useReviews(): ReviewsApi {
  return useContext(ReviewsContext);
}

/** In-memory reviews for tests. */
export function MemoryReviewsProvider({ children, initial = {} }: { children: React.ReactNode; initial?: Record<string, DealReview> }) {
  const [reviews, setReviews] = useState(() => new Map(Object.entries(initial)));
  const api = useMemo(() => reviewsApiFromMap(reviews, {
    save: (deal) => setReviews(prev => new Map(prev).set(dealKey(deal), {
      reviewedBy: 'test@simprogroup.com',
      reviewedByName: 'Test User',
      reviewedAt: new Date('2026-10-15T09:00:00Z'),
      riskAtReview: riskScore(deal),
    })),
    remove: (deal) => setReviews(prev => {
      const next = new Map(prev);
      next.delete(dealKey(deal));
      return next;
    }),
  }), [reviews]);
  return <ReviewsContext.Provider value={api}>{children}</ReviewsContext.Provider>;
}
```

`hosting/src/components/reviews/ReviewButton.tsx`:
```tsx
import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useReviews } from './ReviewsContext';

/** Shared "Mark reviewed" toggle. Stops propagation so it can sit inside a clickable card. */
export const ReviewButton: React.FC<{ deal: RiskDeal }> = ({ deal }) => {
  const reviews = useReviews();
  const review = reviews.getReview(deal);
  const done = reviews.isDone(deal);
  const worse = reviews.isWorse(deal);
  const label = done ? 'Reviewed' : worse ? 'Review again' : 'Mark reviewed';
  const reviewedOn = review?.reviewedAt ? ` · ${formatDate(review.reviewedAt.toISOString())}` : '';

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <button
        type="button"
        aria-pressed={done}
        aria-label={`${label}: ${deal.value}`}
        onClick={(e) => { e.stopPropagation(); reviews.toggle(deal); }}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          minHeight: 32,
          padding: '0 0.7rem',
          borderRadius: 6,
          border: `1px solid ${done ? 'var(--success)' : worse ? 'var(--warning)' : 'var(--border-emphasis)'}`,
          background: done ? 'var(--success-subtle)' : 'var(--bg-surface)',
          color: done ? 'var(--success-text)' : 'var(--text-primary)',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {done ? '✓ Reviewed' : label}
      </button>
      {worse && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--warning-text)' }}>Worse since review</span>}
      {done && review && (
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{review.reviewedByName}{reviewedOn}</span>
      )}
    </span>
  );
};
```

**Step 4: Run them to verify they pass**

Run: `npx vitest run src/lib/reviews.test.ts src/components/reviews` → PASS.

**Step 5: Commit**
```bash
git add src/lib/reviews.ts src/lib/reviews.test.ts src/components/reviews
git commit -m "feat(hosting): shared review model, context and ReviewButton

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Firestore rule for `/dealReviews` + emulator rule tests

This is the first path in Prism that browsers may write to. The rule is narrow and the tests prove it.

**Files:**
- Modify: `firestore.rules` (repo root)
- Create: `hosting/rules-tests/firestore.rules.test.ts`
- Create: `hosting/vitest.rules.config.ts`
- Modify: `hosting/package.json` (dev dependency + `test:rules` script)

**Step 1: Install the rules testing library**

Run: `npm install -D @firebase/rules-unit-testing@^3.0.4`
Expected: added to `devDependencies`. Its peer dependency `firebase@^10` is already satisfied.

**Step 2: Add the test config and script**

`hosting/vitest.rules.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

// Security-rules tests run in Node against the Firestore emulator, separately
// from the jsdom component suite (which must not need an emulator).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
```

In `hosting/package.json` `"scripts"`, add:
```json
"test:rules": "firebase emulators:exec --only firestore --project demo-prism \"vitest run --config vitest.rules.config.ts\""
```
`demo-prism` is a demo project ID, so the emulator never touches the real project. The Firebase CLI finds `../firebase.json` by walking up from `hosting/`.

**Step 3: Write the failing rule tests**

`hosting/rules-tests/firestore.rules.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

const BRAD = { email: 'brad.towers@simprogroup.com', email_verified: true };
const ANN = { email: 'ann@simpro.au', email_verified: true };
const OUTSIDER = { email: 'someone@gmail.com', email_verified: true };
const UNVERIFIED = { email: 'new.hire@simprogroup.com', email_verified: false };

let env: RulesTestEnvironment;

const asUser = (claims: { email: string; email_verified: boolean }) =>
  env.authenticatedContext(claims.email, claims).firestore();

const review = (email: string, extra: Record<string, unknown> = {}) => ({
  reviewedBy: email,
  reviewedByName: 'Brad Towers',
  reviewedAt: serverTimestamp(),
  riskAtReview: 72,
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-prism',
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('/dealReviews', () => {
  it('lets an allowlisted user stamp a review with their own email', async () => {
    await assertSucceeds(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email)));
  });

  it('lets an allowlisted user read reviews', async () => {
    await assertSucceeds(getDoc(doc(asUser(ANN), 'dealReviews/OPP-1')));
  });

  it("rejects stamping someone else's email", async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(ANN.email)));
  });

  it('rejects extra or missing fields', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { isAdmin: true })));
    const { riskAtReview: _omit, ...missing } = review(BRAD.email);
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), missing));
  });

  it('rejects a client-supplied timestamp and an out-of-range risk', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { reviewedAt: new Date() })));
    await assertFails(setDoc(doc(asUser(BRAD), 'dealReviews/OPP-1'), review(BRAD.email, { riskAtReview: 150 })));
  });

  it('rejects off-domain, unverified and signed-out users', async () => {
    await assertFails(setDoc(doc(asUser(OUTSIDER), 'dealReviews/OPP-1'), review(OUTSIDER.email)));
    await assertFails(getDoc(doc(asUser(OUTSIDER), 'dealReviews/OPP-1')));
    await assertFails(setDoc(doc(asUser(UNVERIFIED), 'dealReviews/OPP-1'), review(UNVERIFIED.email)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'dealReviews/OPP-1')));
  });

  it('lets any allowlisted user un-tick a review', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dealReviews/OPP-1'), { reviewedBy: BRAD.email, reviewedByName: 'Brad', reviewedAt: new Date(), riskAtReview: 50 });
    });
    await assertSucceeds(deleteDoc(doc(asUser(ANN), 'dealReviews/OPP-1')));
  });
});

describe('everything else stays read-only for clients', () => {
  it('still denies client writes to reports', async () => {
    await assertFails(setDoc(doc(asUser(BRAD), 'reports/2026-10-15'), { hacked: true }));
  });
});
```

**Step 4: Run them to verify they fail**

Run: `npm run test:rules`
Expected: the emulator starts, then the `/dealReviews` "lets …" tests FAIL with `PERMISSION_DENIED`, since there's no rule yet. The deny tests and the reports test already pass.

> If the CLI says it can't find `firebase.json`, run it from the repo root instead: `firebase emulators:exec --only firestore --project demo-prism "npm --prefix hosting exec -- vitest run --config vitest.rules.config.ts"`.

**Step 5: Add the rule**

In `firestore.rules`, after the `/config/{configId}` block and before the closing braces, add:
```
    // Shared deal reviews: the ONLY client-writable path. A user may stamp
    // a review with their own email only, server time only, fixed fields only.
    match /dealReviews/{dealKey} {
      allow read: if allowed();
      allow create, update: if allowed()
        && request.resource.data.keys().hasOnly(['reviewedBy', 'reviewedByName', 'reviewedAt', 'riskAtReview'])
        && request.resource.data.keys().hasAll(['reviewedBy', 'reviewedByName', 'reviewedAt', 'riskAtReview'])
        && request.resource.data.reviewedBy == request.auth.token.email
        && request.resource.data.reviewedByName is string
        && request.resource.data.reviewedByName.size() <= 200
        && request.resource.data.reviewedAt == request.time
        && request.resource.data.riskAtReview is number
        && request.resource.data.riskAtReview >= 0
        && request.resource.data.riskAtReview <= 100;
      allow delete: if allowed();
    }
```

**Step 6: Run them to verify they pass**

Run: `npm run test:rules` → all 8 PASS.
Also run `npx vitest run`. Expected: the component suite is unchanged, because its config only includes `src/**`.

**Step 7: Commit (from the repo root, since `firestore.rules` lives there)**
```bash
cd ..
git add firestore.rules hosting/rules-tests hosting/vitest.rules.config.ts hosting/package.json hosting/package-lock.json
git commit -m "feat(rules): allow narrowly-scoped shared deal reviews; add emulator rule tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd hosting
```

---

## Task 9: `useSharedReviews`: Firestore-backed review store

**Files:**
- Create: `hosting/src/hooks/useSharedReviews.ts`
- Test: `hosting/src/hooks/useSharedReviews.test.ts`

**Step 1: Write the failing test**
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';

type SnapDoc = { id: string; data: () => Record<string, unknown> };
let emit: (docs: SnapDoc[]) => void = () => undefined;
const setDoc = vi.fn((..._args: unknown[]) => Promise.resolve());
const deleteDoc = vi.fn((..._args: unknown[]) => Promise.resolve());

vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: { currentUser: { email: 'brad.towers@simprogroup.com', displayName: 'Brad Towers' } },
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string, id: string) => ({ path: `${path}/${id}` }),
  serverTimestamp: () => 'SERVER_TS',
  setDoc: (...args: unknown[]) => setDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
  onSnapshot: (_ref: unknown, next: (snap: { forEach: (cb: (d: SnapDoc) => void) => void }) => void) => {
    emit = (docs) => next({ forEach: (cb) => docs.forEach(cb) });
    return () => undefined;
  },
}));

import { useSharedReviews } from './useSharedReviews';

beforeEach(() => {
  setDoc.mockClear();
  deleteDoc.mockClear();
});

describe('useSharedReviews', () => {
  it('saves a review stamped with the signed-in user and current risk', () => {
    const { result } = renderHook(() => useSharedReviews());
    const deal = makeDeal({ opportunityId: 'OPP-9', healthScore: 30 });
    act(() => result.current.toggle(deal));
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'dealReviews/OPP-9' },
      { reviewedBy: 'brad.towers@simprogroup.com', reviewedByName: 'Brad Towers', reviewedAt: 'SERVER_TS', riskAtReview: 70 },
    );
  });

  it('reads reviews from the snapshot and deletes on un-tick', () => {
    const { result } = renderHook(() => useSharedReviews());
    const deal = makeDeal({ opportunityId: 'OPP-9', healthScore: 30 });
    act(() => emit([{ id: 'OPP-9', data: () => ({ reviewedBy: 'ann@simpro.au', reviewedByName: 'Ann', reviewedAt: { toDate: () => new Date('2026-10-14') }, riskAtReview: 70 }) }]));
    expect(result.current.isDone(deal)).toBe(true);
    expect(result.current.getReview(deal)?.reviewedByName).toBe('Ann');

    act(() => result.current.toggle(deal));
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'dealReviews/OPP-9' });
  });

  it('ignores malformed documents', () => {
    const { result } = renderHook(() => useSharedReviews());
    act(() => emit([{ id: 'OPP-1', data: () => ({ reviewedBy: 42 }) }]));
    expect(result.current.getReview(makeDeal({ opportunityId: 'OPP-1' }))).toBeUndefined();
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/hooks/useSharedReviews.test.ts` → FAIL (module missing).

**Step 3: Write the implementation**
```ts
import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { riskScore } from '@/lib/dealMetrics';
import { dealKey, reviewsApiFromMap, type DealReview, type ReviewsApi } from '@/lib/reviews';

const COLLECTION = 'dealReviews';

function toReview(data: Record<string, unknown>): DealReview | undefined {
  if (typeof data.reviewedBy !== 'string' || typeof data.riskAtReview !== 'number') return undefined;
  const at = data.reviewedAt as { toDate?: () => Date } | null | undefined;
  return {
    reviewedBy: data.reviewedBy,
    reviewedByName: typeof data.reviewedByName === 'string' ? data.reviewedByName : data.reviewedBy,
    reviewedAt: at && typeof at.toDate === 'function' ? at.toDate() : null,
    riskAtReview: data.riskAtReview,
  };
}

/**
 * Team-wide deal reviews, live from Firestore. Writes are allowed by a narrow
 * rule in firestore.rules (own email, server timestamp, fixed fields).
 */
export function useSharedReviews(): ReviewsApi {
  const [reviews, setReviews] = useState<Map<string, DealReview>>(() => new Map());
  const [error, setError] = useState<string | undefined>();

  useEffect(() => onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      const next = new Map<string, DealReview>();
      snapshot.forEach((d) => {
        const review = toReview(d.data());
        if (review) next.set(d.id, review);
      });
      setReviews(next);
      setError(undefined);
    },
    (err) => setError(err.message),
  ), []);

  return useMemo(() => reviewsApiFromMap(reviews, {
    save: (deal) => {
      const user = auth.currentUser;
      if (!user?.email) {
        setError('Sign in again to mark deals as reviewed.');
        return;
      }
      setDoc(doc(db, COLLECTION, dealKey(deal)), {
        reviewedBy: user.email,
        reviewedByName: user.displayName || user.email,
        reviewedAt: serverTimestamp(),
        riskAtReview: riskScore(deal),
      }).catch((err: Error) => setError(err.message));
    },
    remove: (deal) => {
      deleteDoc(doc(db, COLLECTION, dealKey(deal))).catch((err: Error) => setError(err.message));
    },
  }, error), [reviews, error]);
}
```

**Step 4: Run it to verify it passes**

Run: `npx vitest run src/hooks/useSharedReviews.test.ts` → PASS.

**Step 5: Commit**
```bash
git add src/hooks/useSharedReviews.ts src/hooks/useSharedReviews.test.ts
git commit -m "feat(hosting): Firestore-backed shared deal reviews

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: `InsightPanel`: label + question + takeaway

**Files:**
- Create: `hosting/src/components/ui/InsightPanel.tsx`
- Test: `hosting/src/components/ui/InsightPanel.test.tsx`

**Step 1: Write the failing test**
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InsightPanel } from './InsightPanel';

describe('InsightPanel', () => {
  it('renders label, question, takeaway, note, action and children', () => {
    render(
      <InsightPanel label="Activity health" question="Are reps still working these deals?" takeaway="3 deals have gone quiet." note="Global answer." action={<button>See all</button>}>
        <p>chart</p>
      </InsightPanel>,
    );
    expect(screen.getByRole('region', { name: 'Activity health' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Are reps still working these deals?' })).toBeInTheDocument();
    expect(screen.getByTestId('takeaway')).toHaveTextContent('3 deals have gone quiet.');
    expect(screen.getByText('Global answer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See all' })).toBeInTheDocument();
    expect(screen.getByText('chart')).toBeInTheDocument();
  });

  it('omits the takeaway box when there is none', () => {
    render(<InsightPanel label="X" question="Q?"><span /></InsightPanel>);
    expect(screen.queryByTestId('takeaway')).not.toBeInTheDocument();
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/ui/InsightPanel.test.tsx` → FAIL.

**Step 3: Write the implementation**
```tsx
import React from 'react';

interface Props {
  /** Small uppercase name of the panel, e.g. "Activity health". */
  label: string;
  /** The plain-English question the panel answers. */
  question: string;
  /** One line computed in code from the data in view. */
  takeaway?: string;
  /** Caveat shown under the takeaway, e.g. "AI answers cover all regions". */
  note?: string;
  /** Optional control on the right of the header ("See all deals →"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const InsightPanel: React.FC<Props> = ({ label, question, takeaway, note, action, children }) => (
  <section
    aria-label={label}
    style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '1.1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      minWidth: 0,
    }}
  >
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </div>
        <h2 style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{question}</h2>
      </div>
      {action}
    </header>
    {takeaway && (
      <p data-testid="takeaway" style={{
        margin: 0, padding: '0.6rem 0.75rem', borderRadius: 8,
        background: 'var(--takeaway-bg)', color: 'var(--takeaway-text)', fontSize: '0.9rem', fontWeight: 600,
      }}>
        {takeaway}
      </p>
    )}
    {note && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--warning-text)' }}>{note}</p>}
    {children}
  </section>
);
```

**Step 4: Run it to verify it passes**, then commit:
```bash
git add src/components/ui/InsightPanel.tsx src/components/ui/InsightPanel.test.tsx
git commit -m "feat(hosting): InsightPanel (label, question, takeaway)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: `DashboardNav`: sticky region selector + tabs

**Files:**
- Create: `hosting/src/components/layout/DashboardNav.tsx`
- Test: `hosting/src/components/layout/DashboardNav.test.tsx`

**Step 1: Write the failing test**
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardNav } from './DashboardNav';

describe('DashboardNav', () => {
  const setup = () => {
    const onSelectTab = vi.fn();
    const onSelectRegion = vi.fn();
    render(<DashboardNav tab="overview" region="uk" regionCounts={{ na: 10, uk: 4, au: 6 }} onSelectTab={onSelectTab} onSelectRegion={onSelectRegion} />);
    return { onSelectTab, onSelectRegion };
  };

  it('shows the five tabs in order with the current one selected', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Overview', 'CRO Brief', 'Deals', 'Pipeline Health', 'Competition & Change']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('marks the selected region and shows deal counts, All being the total', () => {
    setup();
    expect(screen.getByRole('button', { name: /^UK/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^All/ })).toHaveTextContent('20');
  });

  it('reports tab and region clicks', () => {
    const { onSelectTab, onSelectRegion } = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    fireEvent.click(screen.getByRole('button', { name: /^North America/ }));
    expect(onSelectTab).toHaveBeenCalledWith('deals');
    expect(onSelectRegion).toHaveBeenCalledWith('na');
  });
});
```

**Step 2: Run it to verify it fails.** Run: `npx vitest run src/components/layout/DashboardNav.test.tsx` → FAIL.

**Step 3: Write the implementation**
```tsx
import React from 'react';
import type { Region } from '@/lib/types';
import { TABS, type TabKey } from '@/lib/dashboardView';

const REGION_OPTIONS: { key: Region; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'na', label: 'North America' },
  { key: 'uk', label: 'UK' },
  { key: 'au', label: 'AU / NZ' },
];

interface Props {
  tab: TabKey;
  region: Region;
  regionCounts?: Record<string, number>;
  onSelectTab: (tab: TabKey) => void;
  onSelectRegion: (region: Region) => void;
}

/** The one region control for the whole dashboard, plus the tab bar. Sticky so it is always in reach. */
export const DashboardNav: React.FC<Props> = ({ tab, region, regionCounts, onSelectTab, onSelectRegion }) => {
  const total = regionCounts ? Object.values(regionCounts).reduce((sum, n) => sum + n, 0) : undefined;
  const countFor = (key: Region) => (key === 'all' ? total : regionCounts?.[key]);

  return (
    <nav aria-label="Dashboard" style={{
      position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-deep)',
      borderBottom: '1px solid var(--border)', paddingTop: '0.75rem',
      display: 'flex', flexDirection: 'column', gap: '0.6rem',
    }}>
      <div role="group" aria-label="Region" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginRight: 4 }}>
          Region
        </span>
        {REGION_OPTIONS.map(opt => {
          const active = opt.key === region;
          const count = countFor(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectRegion(opt.key)}
              style={{
                minHeight: 36, padding: '0 0.9rem', borderRadius: 999,
                border: `1px solid ${active ? 'var(--accent-fill)' : 'var(--border-emphasis)'}`,
                background: active ? 'var(--accent-fill)' : 'var(--bg-surface)',
                color: active ? 'var(--on-accent)' : 'var(--text-primary)',
                fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.label}
              {count != null && (
                <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: '0.7rem', opacity: 0.8 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tablist" aria-label="Dashboard sections" style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {TABS.map(t => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls="dashboard-tabpanel"
              onClick={() => onSelectTab(t.key)}
              style={{
                minHeight: 44, padding: '0 1rem', background: 'none', border: 'none',
                borderBottom: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.88rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
```

**Step 4: Run it to verify it passes**, then commit:
```bash
git add src/components/layout/DashboardNav.tsx src/components/layout/DashboardNav.test.tsx
git commit -m "feat(hosting): sticky DashboardNav with region selector and tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: Data freshness: next scheduled refresh in the header

**Files:**
- Create: `hosting/src/lib/schedule.ts`
- Test: `hosting/src/lib/schedule.test.ts`
- Modify: `hosting/src/components/layout/Header.tsx`
- Modify: `hosting/src/components/layout/Header.test.tsx`

**Step 1: Write the failing tests**

`hosting/src/lib/schedule.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { nextScheduledRun } from './schedule';

// runWeeklyAnalysis cron: '0 6 */3 * *' (UTC) runs on days 1, 4, 7 … 31 at 06:00.
describe('nextScheduledRun', () => {
  it.each([
    ['2026-10-14T07:00:00Z', '2026-10-16T06:00:00.000Z'],
    ['2026-10-13T05:00:00Z', '2026-10-13T06:00:00.000Z'],
    ['2026-10-13T06:00:00Z', '2026-10-16T06:00:00.000Z'],
    ['2026-10-31T07:00:00Z', '2026-11-01T06:00:00.000Z'],
  ])('after %s is %s', (from, expected) => {
    expect(nextScheduledRun(new Date(from)).toISOString()).toBe(expected);
  });
});
```

Append to `Header.test.tsx`, inside the existing `describe`:
```tsx
  it('shows when the next scheduled refresh is', () => {
    render(<Header isLive period="Data as of 14 Oct 2026" nextRefresh="16 Oct 2026" />);
    expect(screen.getByText('Data as of 14 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Next scheduled refresh 16 Oct 2026')).toBeInTheDocument();
  });
```

**Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/schedule.test.ts src/components/layout/Header.test.tsx` → FAIL.

**Step 3: Write the implementation**

`hosting/src/lib/schedule.ts`:
```ts
// Next run of the scheduled BigQuery analysis. Mirrors the cron in
// functions/src/index.ts (runWeeklyAnalysis): '0 6 */3 * *' in UTC, i.e. 06:00
// on days-of-month 1, 4, 7 … 31. Manual runs can still happen in between.
// (Line comments on purpose: '*/' inside a block comment would end it.)
export function nextScheduledRun(from: Date): Date {
  const candidate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 6));
  for (let i = 0; i < 40; i++) {
    if (candidate.getTime() > from.getTime() && (candidate.getUTCDate() - 1) % 3 === 0) return candidate;
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}
```

In `Header.tsx`:
- Add `nextRefresh?: string;` to `HeaderProps`, with the doc comment `/** e.g. "16 Oct 2026", next scheduled data refresh. */`.
- Destructure `nextRefresh` in the component signature.
- In the period pill, after the `{relativeTime && (…)}` span, add:
  ```tsx
  {isLive && nextRefresh && (
    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
      Next scheduled refresh {nextRefresh}
    </span>
  )}
  ```

**Step 4: Run them to verify they pass**, then commit:
```bash
git add src/lib/schedule.ts src/lib/schedule.test.ts src/components/layout/Header.tsx src/components/layout/Header.test.tsx
git commit -m "feat(hosting): show data freshness and next scheduled refresh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 13: App shell: tabs, one region selector, shared reviews provider

Restructure the long page into tabs. In this task each tab still holds the existing widgets; Tasks 15–19 replace them one tab at a time. After this task nothing is lost, only regrouped.

**Files:**
- Modify: `hosting/src/hooks/useRegion.ts` (region becomes a parameter)
- Modify: `hosting/src/App.tsx` (full rewrite below)
- Create: `hosting/src/App.test.tsx`
- Delete: `hosting/src/components/dashboard/RegionTabs.tsx` (replaced by `DashboardNav`)

**Step 1: Write the failing test**

`hosting/src/App.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { makeDeal, makeRegionData } from '@/test/fixtures';
import type { RegionData } from '@/lib/types';

vi.mock('@/lib/firebase', () => ({ db: {}, storage: {}, auth: { currentUser: null } }));
vi.mock('@/components/layout/Header', () => ({
  Header: ({ period }: { period?: string }) => <div data-testid="header">{period}</div>,
}));
vi.mock('@/components/dashboard/UploadModal', () => ({ UploadModal: () => null }));
vi.mock('@/hooks/useSharedReviews', () => ({
  useSharedReviews: () => ({ getReview: () => undefined, isDone: () => false, isWorse: () => false, toggle: () => undefined }),
}));
let regionState: Record<string, unknown> = {};
vi.mock('@/hooks/useRegion', () => ({ useRegion: () => regionState }));

import App from './App';

function liveState(all: RegionData) {
  return {
    data: all, allData: all, loading: false, isLive: true, hasLiveData: true, showingContent: true,
    executiveBriefing: 'Briefing text for the portfolio.', totalOpportunities: 2, reportPeriod: undefined,
    reportDate: '2026-10-14', reportCreatedAt: undefined, regionCounts: { uk: 1, na: 1 }, dealsError: undefined,
    reportMeta: undefined, twentyQuestions: undefined, competitiveDisplacement: undefined, deltaIntelligence: undefined,
  };
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  regionState = liveState(makeRegionData([
    makeDeal({ value: 'UK Deal', region: 'uk', level: 'HIGH', stage: 'Commit', healthScore: 20 }),
    makeDeal({ value: 'NA Deal', region: 'na', level: 'LOW', stage: 'Discovery', healthScore: 85 }),
  ]));
});

describe('App shell', () => {
  it('opens on the Overview tab with the briefing and data freshness', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Briefing text for the portfolio.')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toHaveTextContent('Data as of 14 Oct 2026');
  });

  it('switches tabs and records the view in the URL', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    expect(screen.getByRole('tab', { name: 'Deals' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toBe('#deals?region=all');
  });

  it('narrows the Deals tab to the selected region', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Deals' }));
    // Scope to the nav: the Deals tab has its own filter chips that may also say "UK".
    fireEvent.click(within(screen.getByRole('group', { name: 'Region' })).getByRole('button', { name: /^UK/ }));
    expect(screen.getByRole('button', { name: 'Open UK Deal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open NA Deal' })).not.toBeInTheDocument();
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL. There's no tab with name "Overview".

**Step 3: Make `useRegion` take the region**

In `hosting/src/hooks/useRegion.ts`:
- Change `export function useRegion() {` to `export function useRegion(region: Region) {`.
- Delete the line `const [region, setRegion] = useState<Region>('all');`.
- Delete `const selectRegion = useCallback((r: Region) => setRegion(r), []);`.
- Remove `region` and `selectRegion` from the returned object.
- Remove `useCallback` from the React import.

**Step 4: Rewrite `App.tsx`**

Delete `formatReportDate`; the header now gets a "Data as of …" label instead. Keep `buildFallbackBriefing` **exactly as it is today** (copy it across unchanged). Replace the rest of the file with:
```tsx
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { containerVariants } from '@/theme/animations';
import { useRegion } from '@/hooks/useRegion';
import { useDashboardView } from '@/hooks/useDashboardView';
import { useSharedReviews } from '@/hooks/useSharedReviews';
import { ReviewsContext } from '@/components/reviews/ReviewsContext';
import { Header } from '@/components/layout/Header';
import { PrismBar } from '@/components/layout/PrismBar';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { ProcessingFooter } from '@/components/layout/ProcessingFooter';
import { AIBriefing } from '@/components/dashboard/AIBriefing';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { RiskRadar } from '@/components/dashboard/RiskRadar';
import { RiskByStage } from '@/components/dashboard/RiskByStage';
import { ActivityHealth } from '@/components/dashboard/ActivityHealth';
import { ForecastIntegrity } from '@/components/dashboard/ForecastIntegrity';
import { RepHeatmap } from '@/components/dashboard/RepHeatmap';
import { Recommendations } from '@/components/dashboard/Recommendations';
import { TwentyQuestions } from '@/components/dashboard/TwentyQuestions';
import { CompetitiveDisplacement } from '@/components/dashboard/CompetitiveDisplacement';
import { DeltaIntelligence } from '@/components/dashboard/DeltaIntelligence';
import { UploadModal } from '@/components/dashboard/UploadModal';
import { Panel } from '@/components/ui/Panel';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { RegionData } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { regionLabel } from '@/lib/regions';
import { inRegion } from '@/lib/dealFilters';
import { TABS } from '@/lib/dashboardView';
import { nextScheduledRun } from '@/lib/schedule';
import { isDormant, isDark, isMisaligned } from '@/lib/dealClassifiers';

// buildFallbackBriefing(data, totalOpportunities): unchanged from the previous App.tsx.

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))',
  gap: '1.25rem',
};
const stack: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1.25rem' };

export default function App() {
  const { view, selectTab, selectRegion, setFilters, goToDeals } = useDashboardView();
  const reviews = useSharedReviews();
  const {
    data, allData, loading, isLive, showingContent, executiveBriefing, totalOpportunities, reportPeriod,
    reportDate, reportCreatedAt, regionCounts, dealsError, reportMeta, twentyQuestions,
    competitiveDisplacement, deltaIntelligence,
  } = useRegion(view.region);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Every tab reads the same region-filtered deals: one region control, no disagreement.
  const regionDeals = useMemo(() => inRegion(allData.risks ?? [], view.region), [allData, view.region]);
  const fallbackBriefing = isLive && !executiveBriefing ? buildFallbackBriefing(data, totalOpportunities) : undefined;
  const dataAsOf = reportDate ? `Data as of ${formatDate(reportDate)}` : reportPeriod;
  const nextRefresh = formatDate(nextScheduledRun(new Date()).toISOString());
  const tabLabel = TABS.find(t => t.key === view.tab)?.label ?? 'Overview';

  const renderTab = () => {
    switch (view.tab) {
      case 'overview':
        return (
          <div style={stack}>
            <AIBriefing briefing={executiveBriefing} fallbackBriefing={fallbackBriefing} totalOpportunities={totalOpportunities} period={dataAsOf} isLive={isLive} />
            <StatsRow stats={data.stats} sparklines={data.sparklines} />
          </div>
        );
      case 'cro':
        return (
          <div style={stack}>
            <Recommendations items={data.recommendations} />
            <TwentyQuestions data={twentyQuestions} isLive={isLive} />
          </div>
        );
      case 'deals':
        return (
          <Panel title="Deals" accent="amber" meta={`${regionDeals.length} deals · ${view.region === 'all' ? 'All regions' : regionLabel(view.region)}`} maxHeight="none">
            <RiskRadar risks={regionDeals} deltaIntelligence={deltaIntelligence} dealsError={dealsError} />
          </Panel>
        );
      case 'health':
        return (
          <div style={stack}>
            <div style={grid}>
              <Panel title="Risk by Stage" accent="amber" meta={`${regionDeals.length} deals`}><RiskByStage risks={regionDeals} /></Panel>
              <Panel title="Activity Health" accent="red" meta={`${regionDeals.filter(isDormant).length} dormant · ${regionDeals.filter(isDark).length} dark`}><ActivityHealth risks={regionDeals} /></Panel>
              <Panel title="Forecast Integrity" accent="blue" meta={`${regionDeals.filter(isMisaligned).length} misaligned`}><ForecastIntegrity risks={regionDeals} forecastStat={data.stats.forecast} /></Panel>
            </div>
            <PipelineFunnel stages={data.funnel} />
            <RepHeatmap risks={regionDeals} />
          </div>
        );
      case 'comp':
        return (
          <div style={stack}>
            <DeltaIntelligence data={deltaIntelligence} isLive={isLive} />
            <CompetitiveDisplacement data={competitiveDisplacement} isLive={isLive} />
          </div>
        );
    }
  };

  return (
    <ReviewsContext.Provider value={reviews}>
      <div style={{ maxWidth: 1920, margin: '0 auto', padding: '0 clamp(1rem, 3vw, 2rem)' }}>
        <Header onUploadClick={() => setUploadOpen(true)} period={dataAsOf} nextRefresh={isLive ? nextRefresh : undefined} isLive={isLive} generatedAt={reportCreatedAt ?? reportDate} />
        <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />
        <PrismBar style={{ marginBottom: '1rem' }} />

        {loading && !showingContent && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 2rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Loading…
          </div>
        )}

        {/* The "No live data yet" empty state: copy the existing block from the old App.tsx
            unchanged ({!loading && !showingContent && ( … Upload CSV → … )}). */}

        {showingContent && (
          <>
            <DashboardNav tab={view.tab} region={view.region} regionCounts={regionCounts} onSelectTab={selectTab} onSelectRegion={selectRegion} />
            {reviews.error && (
              <div role="alert" style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', borderRadius: 6, border: '1px solid var(--warning)', background: 'var(--warning-subtle)', color: 'var(--warning-text)', fontSize: '0.8rem' }}>
                Deal reviews couldn't sync: {reviews.error}
              </div>
            )}
            <main id="dashboard-tabpanel" role="tabpanel" aria-labelledby={`tab-${view.tab}`} style={{ padding: '1.5rem 0 2rem' }}>
              <motion.div key={view.tab} variants={containerVariants} initial="hidden" animate="visible">
                {/* Each tab sits behind its own ErrorBoundary so one bad payload never blanks the dashboard. */}
                <ErrorBoundary key={view.tab} section={tabLabel}>{renderTab()}</ErrorBoundary>
              </motion.div>
            </main>
            <ErrorBoundary section="Processing Footer">
              <ProcessingFooter {...reportMeta} />
            </ErrorBoundary>
          </>
        )}
      </div>
    </ReviewsContext.Provider>
  );
}
```
Notes:
- The old "Live Data / No Live Data" dot row is removed. The header already states freshness.
- The old `activeStats` / `radarFiltered` / `handleStatClick` logic is removed. Radar filters no longer rewrite the stats; the Overview KPI tiles in Task 15 replace it.
- `setFilters` and `goToDeals` are destructured now and used from Task 15 onwards.

**Step 5: Delete `RegionTabs.tsx`**

Run: `git rm src/components/dashboard/RegionTabs.tsx`, then `grep -rn RegionTabs src`. Expected: no matches.

**Step 6: Run the tests, the type check and the build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass, and the build writes `dist/`.

**Step 7: Commit**
```bash
git add src/App.tsx src/App.test.tsx src/hooks/useRegion.ts
git commit -m "feat(hosting): tabbed dashboard shell with one region selector

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 14: Chart components: `RiskMap`, `RiskDriversRadar`, `ConfidenceGauge`

The Overview needs the bubble chart, radar and gauge as standalone components.
- **`RiskMap` is new.** x = days since activity (capped at 60), y = risk score, size = value, with a shaded danger zone (risk ≥ 70, quiet 21+ days). Clicking a bubble opens the deal.
- **The radar and gauge** move out of `RiskRadar.tsx` unchanged, minus their own headings, because `InsightPanel` supplies those.

**Files:**
- Create: `hosting/src/components/charts/RiskMap.tsx` + `RiskMap.test.tsx`
- Create: `hosting/src/components/charts/RiskDriversRadar.tsx` + `RiskDriversRadar.test.tsx`
- Create: `hosting/src/components/charts/ConfidenceGauge.tsx` + `ConfidenceGauge.test.tsx`
- Modify: `hosting/src/components/dashboard/RiskRadar.tsx` (use the extracted radar + gauge; it's deleted in Task 16)
- Modify: `hosting/src/components/dashboard/RiskRadar.test.tsx` (move the gauge tests out)

**Step 1: Write the failing tests**

`ConfidenceGauge.test.tsx`: move the two gauge tests from `RiskRadar.test.tsx` and adapt them:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceGauge } from './ConfidenceGauge';

function arcPaths() {
  const gauge = screen.getByLabelText(/Revenue confidence: \d+ out of 100/);
  return Array.from(gauge.querySelectorAll('path')).map(p => p.getAttribute('d') ?? '');
}

describe('ConfidenceGauge', () => {
  it.each([30, 54, 90])('draws the arc above the baseline at confidence %i', (value) => {
    render(<ConfidenceGauge value={value} />);
    // A half-circle gauge never sweeps more than 180°, so the large-arc flag must be 0.
    expect(arcPaths()[1]).toMatch(/A 60 60 0 0 1 /);
  });

  it('keeps the /100 label inside the drawing area', () => {
    render(<ConfidenceGauge value={60} />);
    const gauge = screen.getByLabelText(/Revenue confidence: 60 out of 100/);
    const viewBoxHeight = Number(gauge.getAttribute('viewBox')!.split(' ')[3]);
    const label = Array.from(gauge.querySelectorAll('text')).find(t => t.textContent === '/100')!;
    expect(Number(label.getAttribute('y')) + 3).toBeLessThanOrEqual(viewBoxHeight);
  });

  it('says it is computed in code, not by the AI', () => {
    render(<ConfidenceGauge value={60} />);
    expect(screen.getByText(/not by the AI/)).toBeInTheDocument();
  });
});
```
Delete the `describe('RiskRadar revenue confidence gauge', …)` block from `RiskRadar.test.tsx`.

`RiskDriversRadar.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskDriversRadar } from './RiskDriversRadar';

describe('RiskDriversRadar', () => {
  it('draws a labelled radar', () => {
    render(<RiskDriversRadar dimensions={[{ label: 'Engagement', value: 100, pipeline: 0 }, { label: 'Velocity', value: 40, pipeline: 0 }, { label: 'Process', value: 10, pipeline: 0 }]} valueTotal={0} />);
    expect(screen.getByRole('img', { name: 'Top risk drivers radar chart' })).toBeInTheDocument();
    expect(screen.getByText('Engagement')).toBeInTheDocument();
  });

  it('says so when nothing is driving risk', () => {
    render(<RiskDriversRadar dimensions={[{ label: 'Process', value: 0, pipeline: 0 }]} valueTotal={0} />);
    expect(screen.getByText('No risk drivers in this view.')).toBeInTheDocument();
  });
});
```

`RiskMap.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { RiskMap } from './RiskMap';

describe('RiskMap', () => {
  it('draws one accessible bubble per deal and opens a deal on click or Enter', () => {
    const onDealClick = vi.fn();
    const acme = makeDeal({ value: 'Acme', healthScore: 20, daysStalled: 40, pipelineValue: 42_000 });
    render(<RiskMap risks={[acme, makeDeal({ value: 'Beta' })]} onDealClick={onDealClick} />);
    const bubble = screen.getByRole('button', { name: 'Acme: $42K, risk 80, 40 days since activity' });
    fireEvent.click(bubble);
    fireEvent.keyDown(bubble, { key: 'Enter' });
    expect(onDealClick).toHaveBeenCalledTimes(2);
    expect(onDealClick).toHaveBeenCalledWith(acme);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('caps the chart at the 40 largest deals and says so', () => {
    const deals = Array.from({ length: 45 }, (_, i) => makeDeal({ pipelineValue: (i + 1) * 1_000 }));
    render(<RiskMap risks={deals} onDealClick={() => undefined} />);
    expect(screen.getAllByRole('button')).toHaveLength(40);
    expect(screen.getByText('Showing the 40 largest of 45 deals')).toBeInTheDocument();
  });

  it('labels the risk bands in text, not colour alone', () => {
    render(<RiskMap risks={[makeDeal()]} />);
    expect(screen.getByText('High risk')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});
```

**Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/charts` → FAIL (modules missing).

**Step 3: Write the implementation**

`ConfidenceGauge.tsx`:
```tsx
import React from 'react';

/** Value-weighted revenue confidence, 0–100. The number comes from revenueConfidence() in lib/dealMetrics. */
export const ConfidenceGauge: React.FC<{ value: number }> = ({ value }) => {
  const conf = Math.max(0, Math.min(100, Math.round(value)));
  const arcColor = conf >= 70 ? 'var(--success)' : conf >= 40 ? 'var(--warning)' : 'var(--error)';
  const cx = 80, cy = 80, r = 60;
  // Foreground arc sweeps from 180° (left) toward 0° (right) in proportion to conf.
  const angle = Math.PI - (conf / 100) * Math.PI;
  const endX = cx + r * Math.cos(angle);
  const endY = cy - r * Math.sin(angle);
  // A half-circle gauge never sweeps more than 180°, so large-arc is always 0.
  const fgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 160 100" role="img" aria-label={`Revenue confidence: ${conf} out of 100`} style={{ width: 150, maxWidth: '100%', display: 'block' }}>
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="var(--border)" strokeWidth={10} strokeLinecap="round" />
        {conf > 0 && <path d={fgPath} fill="none" stroke={arcColor} strokeWidth={10} strokeLinecap="round" />}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={28} fontWeight={850} fill={arcColor} fontFamily="inherit">{conf}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="var(--text-muted)" fontFamily="inherit">/100</text>
      </svg>
      <div style={{ minWidth: 0, flex: '1 1 160px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Revenue confidence</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          Weighted by deal value. Computed from deal health, not by the AI.
        </div>
      </div>
    </div>
  );
};
```

`RiskDriversRadar.tsx`:
- Copy `function RiskDriversRadar` from `RiskRadar.tsx` verbatim into the new file, as `export function RiskDriversRadar(...)`.
- Import:
  ```ts
  import { formatCurrency } from '@/lib/format';
  import type { RiskDimension } from '@/lib/dealMetrics';
  ```
- Add a local `clamp(value, min, max)` helper (same body as in `RiskRadar.tsx`).
- Remove both `<h3>Top Risk Drivers</h3>` headings and the "Driver radar weighted by…" subtitle div.
- Change the empty-state text to `No risk drivers in this view.`

`RiskMap.tsx`:
```tsx
import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { dealValue, riskBand, riskScore, weightedValue, type RiskBand } from '@/lib/dealMetrics';

const MAX_BUBBLES = 40;
const MAX_DAYS = 60;
const WIDTH = 760;
const HEIGHT = 300;
const PAD = { left: 44, right: 16, top: 16, bottom: 44 };

const BAND_COLOR: Record<RiskBand, string> = { Red: 'var(--prism-red)', Yellow: 'var(--prism-amber)', Green: 'var(--prism-green)' };
const BAND_LABEL: Record<RiskBand, string> = { Red: 'High risk', Yellow: 'Medium', Green: 'Low' };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

interface Props {
  risks: RiskDeal[];
  onDealClick?: (deal: RiskDeal) => void;
}

/** Where is the risk? x = days since activity, y = risk score, bubble = deal value. */
export const RiskMap: React.FC<Props> = ({ risks, onDealClick }) => {
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (days: number) => PAD.left + (clamp(days, 0, MAX_DAYS) / MAX_DAYS) * plotW;
  const y = (score: number) => PAD.top + plotH - (score / 100) * plotH;

  // Largest deals matter most to leadership; cap so the chart stays readable.
  const plotted = risks.length > MAX_BUBBLES
    ? [...risks].sort((a, b) => dealValue(b) - dealValue(a)).slice(0, MAX_BUBBLES)
    : risks;
  const maxValue = Math.max(...plotted.map(weightedValue), 1);
  // Draw big bubbles first so small ones stay clickable on top.
  const points = [...plotted]
    .sort((a, b) => weightedValue(b) - weightedValue(a))
    .map(risk => ({
      risk,
      score: riskScore(risk),
      band: riskBand(risk),
      r: clamp(5 + Math.sqrt(weightedValue(risk) / maxValue) * 13, 6, 18),
    }));

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`Risk map of ${plotted.length} deals`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <rect x={x(21)} y={y(100)} width={x(MAX_DAYS) - x(21)} height={y(70) - y(100)} fill="var(--error-subtle)" />
        <text x={x(MAX_DAYS) - 6} y={y(100) + 14} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--error-text)">
          Danger zone: high risk, quiet 3+ weeks
        </text>
        {[0, 25, 50, 75, 100].map(tick => (
          <g key={`y${tick}`}>
            <line x1={PAD.left} y1={y(tick)} x2={WIDTH - PAD.right} y2={y(tick)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{tick}</text>
          </g>
        ))}
        {[0, 15, 30, 45, 60].map(tick => (
          <text key={`x${tick}`} x={x(tick)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {tick === MAX_DAYS ? '60d+' : `${tick}d`}
          </text>
        ))}
        <text x={PAD.left + plotW / 2} y={HEIGHT - 6} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">Days since last activity</text>
        <text x={12} y={PAD.top + plotH / 2} textAnchor="middle" fontSize="11" fill="var(--text-secondary)" transform={`rotate(-90 12 ${PAD.top + plotH / 2})`}>Risk score</text>
        {points.map(({ risk, score, band, r }, i) => {
          const label = `${risk.value}: ${formatCurrency(dealValue(risk))}, risk ${score}, ${risk.daysStalled} days since activity`;
          return (
            <circle
              key={`${risk.id}-${i}`}
              cx={x(risk.daysStalled)}
              cy={y(score)}
              r={r}
              fill={BAND_COLOR[band]}
              fillOpacity={0.8}
              stroke="var(--bg-surface)"
              strokeWidth={2}
              role={onDealClick ? 'button' : undefined}
              tabIndex={onDealClick ? 0 : undefined}
              aria-label={label}
              style={{ cursor: onDealClick ? 'pointer' : 'default' }}
              onClick={() => onDealClick?.(risk)}
              onKeyDown={(e) => {
                if (onDealClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onDealClick(risk);
                }
              }}
            >
              <title>{label}</title>
            </circle>
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {(['Red', 'Yellow', 'Green'] as RiskBand[]).map(band => (
          <span key={band} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: BAND_COLOR[band] }} />
            {BAND_LABEL[band]}
          </span>
        ))}
        <span style={{ color: 'var(--text-muted)' }}>Bubble size = deal value{onDealClick ? ' · click a bubble to open the deal' : ''}</span>
        {risks.length > MAX_BUBBLES && (
          <span style={{ color: 'var(--text-muted)' }}>Showing the {MAX_BUBBLES} largest of {risks.length} deals</span>
        )}
      </div>
    </div>
  );
};
```

**Step 4: Point RiskRadar at the extracted pieces**

In `RiskRadar.tsx`:
- Delete the local `function RiskDriversRadar`.
- Add these imports:
  ```ts
  import { RiskDriversRadar } from '@/components/charts/RiskDriversRadar';
  import { ConfidenceGauge } from '@/components/charts/ConfidenceGauge';
  ```
- Replace the whole Revenue Confidence `{(() => { const conf = summary.confidence; … })()}` IIFE, plus the "Weighted by deal value" div under it, with `<ConfidenceGauge value={summary.confidence} />`.

**Step 5: Run the full suite and the type check**

Run: `npx vitest run && npx tsc --noEmit` → all PASS.

**Step 6: Commit**
```bash
git add src/components/charts src/components/dashboard/RiskRadar.tsx src/components/dashboard/RiskRadar.test.tsx
git commit -m "feat(hosting): standalone RiskMap, RiskDriversRadar and ConfidenceGauge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 15: Overview tab

**Files:**
- Create: `hosting/src/components/ui/tone.ts` (shared colour helpers for text on cards)
- Create: `hosting/src/components/overview/SinceLastRun.tsx`
- Create: `hosting/src/components/overview/KpiTiles.tsx`
- Create: `hosting/src/components/overview/ReviewQueue.tsx`
- Create: `hosting/src/components/overview/RegionCards.tsx`
- Create: `hosting/src/components/tabs/OverviewTab.tsx`
- Test: `hosting/src/components/tabs/OverviewTab.test.tsx`
- Modify: `hosting/src/components/dashboard/AIBriefing.tsx` (`collapsible` + `scopeNote`)
- Test: `hosting/src/components/dashboard/AIBriefing.test.tsx`
- Modify: `hosting/src/App.tsx` (overview case)
- Delete: `hosting/src/components/dashboard/StatsRow.tsx`, `StatsRow.test.tsx` (replaced by `KpiTiles`)

**Step 1: Write the failing tests**

`AIBriefing.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIBriefing } from './AIBriefing';

describe('AIBriefing', () => {
  it('collapses to a few lines with a toggle to read it all', () => {
    render(<AIBriefing isLive briefing="A long briefing." collapsible />);
    const toggle = screen.getByRole('button', { name: 'Read full briefing' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows a scope note when a region filter cannot apply to it', () => {
    render(<AIBriefing isLive briefing="Text." scopeNote="Global briefing: covers all regions, not just UK." />);
    expect(screen.getByText('Global briefing: covers all regions, not just UK.')).toBeInTheDocument();
  });
});
```

`OverviewTab.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from '@/components/reviews/ReviewsContext';
import type { DeltaIntelligenceData, RiskDeal } from '@/lib/types';
import { OverviewTab } from './OverviewTab';

const deals: RiskDeal[] = [
  makeDeal({ value: 'Commit Deal', region: 'uk', stage: 'Commit', healthScore: 20, level: 'HIGH', pipelineValue: 40_000 }),
  makeDeal({ value: 'Early Deal', region: 'uk', stage: 'Discovery', healthScore: 80, level: 'LOW' }),
  makeDeal({ value: 'NA Deal', region: 'na', stage: 'Proposal', healthScore: 50, level: 'MEDIUM' }),
];

function setup(overrides: Partial<React.ComponentProps<typeof OverviewTab>> = {}) {
  const handlers = { onGoToDeals: vi.fn(), onSelectRegion: vi.fn(), onSeeChanges: vi.fn() };
  render(
    <MemoryReviewsProvider>
      <OverviewTab deals={deals} allDeals={deals} region="all" briefing={{ briefing: 'Portfolio briefing.', isLive: true }} {...handlers} {...overrides} />
    </MemoryReviewsProvider>,
  );
  return handlers;
}

describe('OverviewTab', () => {
  it("queues only late-stage deals and tracks today's progress", () => {
    setup();
    const queue = screen.getByRole('region', { name: /Today's queue · 0 of 2 reviewed/ });
    expect(within(queue).getByRole('button', { name: 'Commit Deal' })).toBeInTheDocument();
    expect(within(queue).getByRole('button', { name: 'NA Deal' })).toBeInTheDocument();
    expect(within(queue).queryByRole('button', { name: 'Early Deal' })).not.toBeInTheDocument();

    fireEvent.click(within(queue).getByRole('button', { name: 'Mark reviewed: Commit Deal' }));
    expect(screen.getByRole('region', { name: /1 of 2 reviewed/ })).toBeInTheDocument();
  });

  it('KPI tiles click through to filtered deals', () => {
    const { onGoToDeals } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^At risk/ }));
    expect(onGoToDeals).toHaveBeenCalledWith({ riskOnly: true });
  });

  it('region cards select a region', () => {
    const { onSelectRegion } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^UK/ }));
    expect(onSelectRegion).toHaveBeenCalledWith('uk');
  });

  it('labels the briefing as global when a region is selected', () => {
    setup({ region: 'uk', deals: deals.slice(0, 2) });
    expect(screen.getByText('Global briefing: covers all regions, not just UK.')).toBeInTheDocument();
  });

  it('opens the deal popup from a risk-map bubble', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Commit Deal: \$40K/ }));
    expect(screen.getByText('Risk Assessment')).toBeInTheDocument();
  });

  it('summarises changes since the last run, filtered to the region', () => {
    const delta: DeltaIntelligenceData = {
      comparedTo: '2026-10-11',
      significantDealChanges: {
        deteriorated: [
          { deal: 'A', rep: 'Jo', region: 'UK', change: 'Went quiet' },
          { deal: 'B', rep: 'Sam', region: 'North America', change: 'Slipped' },
        ],
        improved: [],
        newPipeline: { count: 4, totalMrr: '$10K', qualityAssessment: '' },
      },
    };
    const { onSeeChanges } = setup({ delta, region: 'uk' });
    expect(screen.getByText('↓ 1 got worse')).toBeInTheDocument();
    expect(screen.queryByText('4 new deals')).not.toBeInTheDocument(); // newPipeline has no region
    fireEvent.click(screen.getByRole('button', { name: 'See what changed →' }));
    expect(onSeeChanges).toHaveBeenCalled();
  });
});
```

**Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/tabs/OverviewTab.test.tsx src/components/dashboard/AIBriefing.test.tsx` → FAIL.

**Step 3: Write the implementation**

`hosting/src/components/ui/tone.ts`:
```ts
import type React from 'react';
import type { RiskBand } from '@/lib/dealMetrics';

/** Readable text colours on cards, defined for both themes in global.css. */
export const BAND_TEXT: Record<RiskBand, string> = { Red: 'var(--error-text)', Yellow: 'var(--warning-text)', Green: 'var(--success-text)' };
export const BAND_NAME: Record<RiskBand, string> = { Red: 'High', Yellow: 'Medium', Green: 'Low' };

export function scoreTextColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score >= 70) return 'var(--success-text)';
  if (score >= 40) return 'var(--warning-text)';
  return 'var(--error-text)';
}

export const linkButton: React.CSSProperties = {
  minHeight: 40, padding: '0 0.25rem', background: 'none', border: 'none',
  color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
};

export const smallCaps: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
};
```

`AIBriefing.tsx`:
- Add these props:
  ```ts
  /** Clamp to three lines with a "Read full briefing" toggle. */
  collapsible?: boolean;
  /** Caveat when a filter can't apply to the briefing, e.g. a selected region. */
  scopeNote?: string;
  ```
- Add `useState` to the React import, then inside the component add `const [expanded, setExpanded] = useState(false);`.
- Directly after the header row `<div …>` (the one holding the badge and label), add:
  ```tsx
  {scopeNote && (
    <p style={{ margin: '-0.5rem 0 0.75rem', fontSize: '0.78rem', color: 'var(--warning-text)' }}>{scopeNote}</p>
  )}
  ```
- Replace the live-briefing branch `isLive && displayBriefing ? ( <p …>{highlightBriefingText(displayBriefing)}</p> )` with:
  ```tsx
  isLive && displayBriefing ? (
    <>
      <p style={{
        fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 1100, margin: 0,
        ...(collapsible && !expanded
          ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }
          : {}),
      }}>
        {highlightBriefingText(displayBriefing)}
      </p>
      {collapsible && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(e => !e)} style={{
          marginTop: '0.5rem', minHeight: 36, padding: 0, background: 'none', border: 'none',
          color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
        }}>
          {expanded ? 'Show less' : 'Read full briefing'}
        </button>
      )}
    </>
  )
  ```
- Change the card's `marginBottom: '2rem'` to `marginBottom: 0`. Tabs space their sections with `gap`.

`SinceLastRun.tsx`:
```tsx
import React from 'react';
import type { DeltaDeal, DeltaIntelligenceData, Region } from '@/lib/types';
import { asArray, isRecord } from '@/lib/guards';
import { normalizeRegionKey } from '@/lib/regions';
import { formatDate } from '@/lib/format';
import { linkButton, smallCaps } from '@/components/ui/tone';

interface Props {
  delta?: DeltaIntelligenceData;
  region: Region;
  onSeeChanges: () => void;
}

/** One-line "what moved since the last run" strip at the top of the Overview. */
export const SinceLastRun: React.FC<Props> = ({ delta, region, onSeeChanges }) => {
  const changes = isRecord(delta?.significantDealChanges) ? delta.significantDealChanges : undefined;
  if (!delta || !changes) return null;

  const inView = (d: DeltaDeal) => region === 'all' || normalizeRegionKey(d.region) === region;
  const worse = asArray<DeltaDeal>(changes.deteriorated).filter(inView).length;
  const better = asArray<DeltaDeal>(changes.improved).filter(inView).length;
  // newPipeline is portfolio-wide (no region), so only show it for All.
  const newPipeline = changes.newPipeline;
  const newDeals = region === 'all' && isRecord(newPipeline) && typeof newPipeline.count === 'number' ? newPipeline.count : undefined;
  const since = delta.comparedTo ? ` (${formatDate(delta.comparedTo)})` : '';

  return (
    <div role="status" aria-label="Changes since the last run" style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1.1rem',
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.6rem 1.1rem',
    }}>
      <span style={smallCaps}>Since last run{since}</span>
      <span style={{ fontWeight: 700, color: 'var(--error-text)' }}>↓ {worse} got worse</span>
      <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>↑ {better} improved</span>
      {newDeals !== undefined && <span style={{ fontWeight: 700 }}>{newDeals} new deals</span>}
      <button type="button" onClick={onSeeChanges} style={{ ...linkButton, marginLeft: 'auto' }}>See what changed →</button>
    </div>
  );
};
```

`KpiTiles.tsx`:
```tsx
import React from 'react';
import type { RiskDeal } from '@/lib/types';
import type { DealFilters } from '@/lib/dealFilters';
import { formatCurrency } from '@/lib/format';
import { isAtRisk, sumValue } from '@/lib/dealMetrics';
import { plural } from '@/lib/takeaways';
import { scoreTextColor, smallCaps } from '@/components/ui/tone';

interface Tile {
  key: string;
  label: string;
  value: string;
  sub: string;
  color: string;
  link: string;
  filters: DealFilters;
}

/** Four headline numbers, each a door into the Deals tab. */
export const KpiTiles: React.FC<{ deals: RiskDeal[]; onSelect: (filters: DealFilters) => void }> = ({ deals, onSelect }) => {
  const atRisk = deals.filter(isAtRisk);
  const high = deals.filter(d => d.level === 'HIGH');
  const scored = deals.filter(d => typeof d.healthScore === 'number');
  const avgHealth = scored.length ? Math.round(scored.reduce((s, d) => s + (d.healthScore as number), 0) / scored.length) : null;
  const avgDays = deals.length ? Math.round(deals.reduce((s, d) => s + Math.max(0, d.daysStalled || 0), 0) / deals.length) : null;

  const tiles: Tile[] = [
    { key: 'pipeline', label: 'Pipeline value', value: formatCurrency(sumValue(deals)), sub: plural(deals.length, 'open deal'), color: 'var(--text-primary)', link: 'View all deals →', filters: {} },
    { key: 'atRisk', label: 'At risk', value: formatCurrency(sumValue(atRisk)), sub: `${plural(atRisk.length, 'deal')} · ${high.length} high`, color: 'var(--error-text)', link: 'View at-risk deals →', filters: { riskOnly: true } },
    {
      key: 'health', label: 'Avg deal health', value: avgHealth === null ? '—' : `${avgHealth}/100`,
      sub: avgHealth === null ? 'No health scores' : avgHealth >= 70 ? 'Healthy' : avgHealth >= 40 ? 'Caution' : 'At risk',
      color: scoreTextColor(avgHealth), link: 'View red deals →', filters: { band: 'Red' },
    },
    {
      key: 'quiet', label: 'Avg days since activity', value: avgDays === null ? '—' : `${avgDays}d`,
      sub: avgDays === null ? '' : avgDays <= 7 ? 'Healthy' : avgDays <= 21 ? 'Slowing' : 'Stalled',
      color: avgDays === null ? 'var(--text-muted)' : avgDays <= 7 ? 'var(--success-text)' : avgDays <= 21 ? 'var(--warning-text)' : 'var(--error-text)',
      link: 'View dark deals →', filters: { activity: 'dark' },
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: '0.85rem' }}>
      {tiles.map(tile => (
        <button key={tile.key} type="button" onClick={() => onSelect(tile.filters)} style={{
          textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '0.9rem 1.1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-primary)',
        }}>
          <span style={smallCaps}>{tile.label}</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', color: tile.color }}>{tile.value}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tile.sub}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>{tile.link}</span>
        </button>
      ))}
    </div>
  );
};
```

`ReviewQueue.tsx`:
```tsx
import React, { useMemo } from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatCurrency, isLateStage, normalizeStage } from '@/lib/format';
import { dealValue, riskBand, riskScore } from '@/lib/dealMetrics';
import { repName } from '@/lib/dealFilters';
import { regionLabel } from '@/lib/regions';
import { queueTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { ReviewButton } from '@/components/reviews/ReviewButton';
import { useReviews } from '@/components/reviews/ReviewsContext';
import { BAND_NAME, BAND_TEXT, linkButton } from '@/components/ui/tone';

interface Props {
  deals: RiskDeal[];
  onOpenDeal: (deal: RiskDeal) => void;
  onSeeAll: () => void;
}

/** The five riskiest late-stage deals: a short daily work queue with shared review ticks. */
export const ReviewQueue: React.FC<Props> = ({ deals, onOpenDeal, onSeeAll }) => {
  const reviews = useReviews();
  const queue = useMemo(
    () => deals
      .filter(d => isLateStage(d.stage))
      .sort((a, b) => riskScore(b) - riskScore(a) || dealValue(b) - dealValue(a))
      .slice(0, 5),
    [deals],
  );
  const doneCount = queue.filter(reviews.isDone).length;
  const pct = queue.length ? Math.round((doneCount / queue.length) * 100) : 0;

  return (
    <InsightPanel
      label={`Today's queue · ${doneCount} of ${queue.length} reviewed`}
      question="Which late-stage deals could slip?"
      takeaway={queueTakeaway(queue, reviews.isDone)}
      action={<button type="button" onClick={onSeeAll} style={linkButton}>See all late-stage deals →</button>}
    >
      {queue.length > 0 && (
        <div role="progressbar" aria-label="Queue reviewed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
          style={{ height: 6, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--success)' }} />
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {queue.map(deal => {
          const band = riskBand(deal);
          const isDone = reviews.isDone(deal);
          return (
            <li key={`${deal.id}-${deal.value}`} style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1rem',
              padding: '0.6rem 0.25rem', borderTop: '1px solid var(--border)', opacity: isDone ? 0.6 : 1,
            }}>
              <button type="button" onClick={() => onOpenDeal(deal)} style={{
                flex: '2 1 220px', textAlign: 'left', background: 'none', border: 'none', padding: 0, minHeight: 36,
                fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer',
                textDecoration: 'underline', textDecorationColor: 'var(--border-emphasis)', textUnderlineOffset: 3,
              }}>
                {deal.value}
              </button>
              <span style={{ flex: '2 1 200px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {regionLabel(deal.region)} · {repName(deal)} · {normalizeStage(deal.stage)}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{deal.daysStalled}d quiet</span>
              <span style={{ flex: '0 0 70px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(dealValue(deal))}</span>
              <span style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: BAND_TEXT[band] }}>
                {BAND_NAME[band]} · {riskScore(deal)}
              </span>
              <ReviewButton deal={deal} />
            </li>
          );
        })}
      </ul>
    </InsightPanel>
  );
};
```

`RegionCards.tsx`:
```tsx
import React from 'react';
import type { Region, RiskDeal } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { inRegion } from '@/lib/dealFilters';
import { isAtRisk, revenueConfidence, sumValue } from '@/lib/dealMetrics';
import { regionLabel } from '@/lib/regions';
import { plural, regionTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { scoreTextColor } from '@/components/ui/tone';

const REGION_KEYS = ['na', 'uk', 'au'] as const;

const Line: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
    <span>{label}</span>
    <span style={{ fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</span>
  </span>
);

interface Props {
  allDeals: RiskDeal[];
  region: Region;
  onSelectRegion: (region: Region) => void;
}

export const RegionCards: React.FC<Props> = ({ allDeals, region, onSelectRegion }) => {
  const rows = REGION_KEYS.map(key => {
    const deals = inRegion(allDeals, key);
    const atRisk = deals.filter(isAtRisk);
    return {
      key, label: regionLabel(key), dealCount: deals.length, pipeline: sumValue(deals),
      atRiskValue: sumValue(atRisk), atRiskCount: atRisk.length, confidence: revenueConfidence(deals),
    };
  });

  return (
    <InsightPanel label="Regions" question="Which region needs attention?" takeaway={regionTakeaway(rows)}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0.85rem' }}>
        {rows.map(row => {
          const active = region === row.key;
          return (
            <button key={row.key} type="button" aria-pressed={active} onClick={() => onSelectRegion(active ? 'all' : row.key)} style={{
              textAlign: 'left', border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--takeaway-bg)' : 'var(--bg-surface)', borderRadius: 10,
              padding: '0.85rem 1rem', cursor: 'pointer', color: 'var(--text-primary)',
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{row.label}</span>
              <Line label="Pipeline" value={formatCurrency(row.pipeline)} />
              <Line label="At risk" value={`${formatCurrency(row.atRiskValue)} · ${plural(row.atRiskCount, 'deal')}`} color="var(--error-text)" />
              <Line label="Confidence" value={`${row.confidence}/100`} color={scoreTextColor(row.confidence)} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>
                {active ? 'Selected · click to show all regions' : `Focus on ${row.label}`}
              </span>
            </button>
          );
        })}
      </div>
    </InsightPanel>
  );
};
```

`hosting/src/components/tabs/OverviewTab.tsx`:
```tsx
import React, { useMemo, useState } from 'react';
import type { DeltaIntelligenceData, Region, RiskDeal } from '@/lib/types';
import type { DealFilters } from '@/lib/dealFilters';
import { buildRiskDimensions, revenueConfidence, sumValue } from '@/lib/dealMetrics';
import { regionLabel } from '@/lib/regions';
import { driversTakeaway, riskMapTakeaway } from '@/lib/takeaways';
import { AIBriefing } from '@/components/dashboard/AIBriefing';
import { DealDetailModal } from '@/components/dashboard/DealDetailModal';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { RiskMap } from '@/components/charts/RiskMap';
import { RiskDriversRadar } from '@/components/charts/RiskDriversRadar';
import { ConfidenceGauge } from '@/components/charts/ConfidenceGauge';
import { SinceLastRun } from '@/components/overview/SinceLastRun';
import { KpiTiles } from '@/components/overview/KpiTiles';
import { ReviewQueue } from '@/components/overview/ReviewQueue';
import { RegionCards } from '@/components/overview/RegionCards';

interface Props {
  /** Deals in the selected region. */
  deals: RiskDeal[];
  /** Every deal, for the region comparison cards. */
  allDeals: RiskDeal[];
  region: Region;
  briefing: React.ComponentProps<typeof AIBriefing>;
  delta?: DeltaIntelligenceData;
  dealsError?: string;
  onGoToDeals: (filters?: DealFilters) => void;
  onSelectRegion: (region: Region) => void;
  onSeeChanges: () => void;
}

/** The CRO's 30-second view: what moved, where the risk is, and today's queue. */
export const OverviewTab: React.FC<Props> = ({
  deals, allDeals, region, briefing, delta, dealsError, onGoToDeals, onSelectRegion, onSeeChanges,
}) => {
  const [selected, setSelected] = useState<RiskDeal | null>(null);
  const confidence = useMemo(() => revenueConfidence(deals), [deals]);
  const dimensions = useMemo(() => buildRiskDimensions(deals), [deals]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {dealsError && (
        <div role="alert" style={{ padding: '0.6rem 0.85rem', borderRadius: 6, border: '1px solid var(--error)', background: 'var(--error-subtle)', color: 'var(--error-text)', fontSize: '0.8rem' }}>
          Could not load deals: {dealsError.replace(/\.$/, '')}. Showing the capped list embedded in the report.
        </div>
      )}
      <SinceLastRun delta={delta} region={region} onSeeChanges={onSeeChanges} />
      <AIBriefing
        {...briefing}
        collapsible
        scopeNote={region !== 'all' ? `Global briefing: covers all regions, not just ${regionLabel(region)}.` : undefined}
      />
      <KpiTiles deals={deals} onSelect={onGoToDeals} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div style={{ flex: '2 1 560px', minWidth: 0 }}>
          <InsightPanel label="Risk map" question="Where is the risk?" takeaway={riskMapTakeaway(deals)}>
            <RiskMap risks={deals} onDealClick={setSelected} />
          </InsightPanel>
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <InsightPanel label="Risk drivers · revenue confidence" question="What's driving it?" takeaway={driversTakeaway(confidence, dimensions)}>
            <RiskDriversRadar dimensions={dimensions} valueTotal={sumValue(deals)} />
            <ConfidenceGauge value={confidence} />
          </InsightPanel>
        </div>
      </div>
      <ReviewQueue deals={deals} onOpenDeal={setSelected} onSeeAll={() => onGoToDeals({ lateOnly: true })} />
      <RegionCards allDeals={allDeals} region={region} onSelectRegion={onSelectRegion} />
      <DealDetailModal deal={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
```

**Step 4: Wire it into `App.tsx` and delete StatsRow**

- Import `OverviewTab` from `@/components/tabs/OverviewTab`.
- Replace the `case 'overview':` block with:
  ```tsx
  case 'overview':
    return (
      <OverviewTab
        deals={regionDeals}
        allDeals={allData.risks ?? []}
        region={view.region}
        briefing={{ briefing: executiveBriefing, fallbackBriefing, totalOpportunities, period: dataAsOf, isLive }}
        delta={deltaIntelligence}
        dealsError={dealsError}
        onGoToDeals={goToDeals}
        onSelectRegion={selectRegion}
        onSeeChanges={() => selectTab('comp')}
      />
    );
  ```
- Remove the `StatsRow` import, then delete the files: `git rm src/components/dashboard/StatsRow.tsx src/components/dashboard/StatsRow.test.tsx`.
- Check: `grep -rn StatsRow src` returns nothing.

**Step 5: Run everything**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. The three StatsRow tests are gone, and the new Overview/AIBriefing tests are added.

**Step 6: Commit**
```bash
git add src/components/ui/tone.ts src/components/overview src/components/tabs/OverviewTab.tsx src/components/tabs/OverviewTab.test.tsx src/components/dashboard/AIBriefing.tsx src/components/dashboard/AIBriefing.test.tsx src/App.tsx
git commit -m "feat(hosting): Overview tab (changes strip, KPIs, risk map, drivers, review queue, regions)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 16: Deals tab (retire RiskRadar)

**Files:**
- Create: `hosting/src/lib/exportCsv.ts` + `exportCsv.test.ts`
- Create: `hosting/src/components/deals/DealCard.tsx` + `DealCard.test.tsx`
- Create: `hosting/src/components/deals/DealFiltersBar.tsx`
- Create: `hosting/src/components/deals/RepSummary.tsx`
- Create: `hosting/src/components/tabs/DealsTab.tsx` + `DealsTab.test.tsx`
- Modify: `hosting/src/App.tsx` (deals case)
- Delete: `hosting/src/components/dashboard/RiskRadar.tsx`, `RiskRadar.test.tsx`, `hosting/src/hooks/useDealReviews.ts`

**Step 1: Write the failing tests**

`exportCsv.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import { dealsToCsv } from './exportCsv';

describe('dealsToCsv', () => {
  it('quotes every free-text field so commas and quotes survive', () => {
    const csv = dealsToCsv([makeDeal({ value: 'Acme, Inc "Renewal"', accountName: 'Acme', region: 'uk', summary: 'Went dark', action: 'Call' })]);
    const [header, row] = csv.split('\n');
    expect(header.startsWith('Account Name,Opportunity Name,Region')).toBe(true);
    expect(row).toContain('"Acme, Inc ""Renewal"""');
    expect(row).toContain('"UK"');
  });
});
```

`DealCard.test.tsx` (ported from the old RiskRadar card tests):
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from '@/components/reviews/ReviewsContext';
import { DealCard } from './DealCard';

const acme = makeDeal({ value: 'Acme Corp Renewal', healthScore: 30, level: 'HIGH', summary: 'Champion has gone dark.' });

function setup() {
  const onOpen = vi.fn();
  render(<MemoryReviewsProvider><DealCard deal={acme} onOpen={onOpen} /></MemoryReviewsProvider>);
  return { onOpen, card: screen.getByRole('button', { name: 'Open Acme Corp Renewal' }) };
}

describe('DealCard', () => {
  it('is a focusable role=button with no nested native buttons inside a button', () => {
    const { card } = setup();
    expect(card.tagName).toBe('DIV');
    expect(card).toHaveAttribute('tabindex', '0');
    expect(document.querySelectorAll('button button')).toHaveLength(0);
    expect(within(card).getByRole('button', { name: 'Mark reviewed: Acme Corp Renewal' })).toBeInTheDocument();
  });

  it('opens on Enter and Space', () => {
    const { card, onOpen } = setup();
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('reviewing does not open the deal', () => {
    const { card, onOpen } = setup();
    fireEvent.click(within(card).getByRole('button', { name: 'Mark reviewed: Acme Corp Renewal' }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(within(card).getByRole('button', { name: 'Reviewed: Acme Corp Renewal' })).toBeInTheDocument();
  });

  it('labels the risk band in text', () => {
    setup();
    expect(screen.getByText('Red')).toBeInTheDocument();
  });
});
```

`DealsTab.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from '@/components/reviews/ReviewsContext';
import { dealKey } from '@/lib/reviews';
import { DealsTab } from './DealsTab';

const a = makeDeal({ value: 'A', rep: 'Jo', level: 'HIGH', healthScore: 20, stage: 'Commit' });
const b = makeDeal({ value: 'B', rep: 'Sam', level: 'LOW', healthScore: 85, stage: 'Discovery' });

function setup(props: Partial<React.ComponentProps<typeof DealsTab>> = {}, initialReviews = {}) {
  const onFiltersChange = vi.fn();
  render(
    <MemoryReviewsProvider initial={initialReviews}>
      <DealsTab deals={[a, b]} region="uk" filters={{}} onFiltersChange={onFiltersChange} {...props} />
    </MemoryReviewsProvider>,
  );
  return { onFiltersChange };
}

describe('DealsTab', () => {
  it('lists deals riskiest first', () => {
    setup();
    const cards = screen.getAllByRole('button', { name: /^Open / });
    expect(cards.map(c => c.getAttribute('aria-label'))).toEqual(['Open A', 'Open B']);
  });

  it('applies filters from the view and shows a rep summary', () => {
    setup({ filters: { rep: 'Sam' } });
    expect(screen.getByRole('button', { name: 'Open B' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open A' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Summary for Sam' })).toHaveTextContent('Confidence 85/100');
  });

  it('reports filter changes and removable chips', () => {
    const { onFiltersChange } = setup({ filters: { riskOnly: true } });
    fireEvent.change(screen.getByLabelText('Rep'), { target: { value: 'Sam' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ rep: 'Sam' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: At risk only' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ riskOnly: undefined });
  });

  it('can hide deals the team has already reviewed', () => {
    setup({ filters: { hideReviewed: true } }, {
      [dealKey(a)]: { reviewedBy: 'x@simprogroup.com', reviewedByName: 'X', reviewedAt: null, riskAtReview: 80 },
    });
    expect(screen.queryByRole('button', { name: 'Open A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open B' })).toBeInTheDocument();
  });

  it('says when nothing matches, and when deals failed to load', () => {
    setup({ filters: { stage: 'Negotiation' }, dealsError: 'Missing or insufficient permissions.' });
    expect(screen.getByText('No deals match these filters.')).toBeInTheDocument();
    expect(screen.getByText(/Could not load deals: Missing or insufficient permissions\./)).toBeInTheDocument();
  });
});
```

**Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/exportCsv.test.ts src/components/deals src/components/tabs/DealsTab.test.tsx` → FAIL.

**Step 3: Write the implementation**

`hosting/src/lib/exportCsv.ts`:
```ts
import type { RiskDeal } from './types';
import { normalizeStage } from './format';
import { regionLabel } from './regions';

const HEADERS = ['Account Name', 'Opportunity Name', 'Region', 'Stage', 'Rep', 'Risk Level', 'Health Score', 'Pipeline Value', 'Days Stalled', 'Confidence', 'Summary', 'Recommended Action'];
const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** Every free-text field is quoted (the old exporter left names unquoted, so a comma split the row). */
export function dealsToCsv(risks: RiskDeal[]): string {
  const rows = risks.map(r => [
    quote(r.accountName ?? ''),
    quote(r.value),
    quote(regionLabel(r.region)),
    quote(normalizeStage(r.stage)),
    quote(r.rep ?? 'Unassigned'),
    r.level,
    r.healthScore ?? '',
    r.pipelineValue ?? 0,
    r.daysStalled,
    r.confidence,
    quote(r.summary ?? ''),
    quote(r.action ?? ''),
  ].join(','));
  return [HEADERS.join(','), ...rows].join('\n');
}

export function downloadDealsCsv(risks: RiskDeal[], today: Date = new Date()): void {
  const blob = new Blob([dealsToCsv(risks)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prism-deals-${today.toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

`hosting/src/components/deals/DealCard.tsx`:
```tsx
import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatCurrency, normalizeStage } from '@/lib/format';
import { dealValue, riskBand, riskScore } from '@/lib/dealMetrics';
import { repName } from '@/lib/dealFilters';
import { regionLabel } from '@/lib/regions';
import { Badge } from '@/components/ui/Badge';
import { ReviewButton } from '@/components/reviews/ReviewButton';
import { useReviews } from '@/components/reviews/ReviewsContext';
import { BAND_TEXT } from '@/components/ui/tone';

const meta: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' };

/**
 * A div with role=button rather than <button>: the Review action inside must
 * stay a real button, and buttons cannot nest.
 */
export const DealCard: React.FC<{ deal: RiskDeal; onOpen: (deal: RiskDeal) => void }> = ({ deal, onOpen }) => {
  const reviews = useReviews();
  const band = riskBand(deal);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${deal.value}`}
      onClick={() => onOpen(deal)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(deal);
        }
      }}
      style={{
        textAlign: 'left', padding: '1rem', border: '1px solid var(--border)', borderRadius: 8,
        background: 'var(--bg-surface)', cursor: 'pointer', opacity: reviews.isDone(deal) ? 0.65 : 1,
        display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4, flexWrap: 'wrap' }}>
            <Badge variant={band === 'Red' ? 'high' : band === 'Yellow' ? 'medium' : 'low'}>{band}</Badge>
            <span style={meta}>{regionLabel(deal.region)}</span>
            <span style={meta}>{normalizeStage(deal.stage)}</span>
            <span style={meta}>{repName(deal)}</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal.value}</div>
          <div style={meta}>{formatCurrency(dealValue(deal))} · {deal.daysStalled}d since activity</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flexShrink: 0 }}>
          <ReviewButton deal={deal} />
          <div style={{ textAlign: 'right' }}>
            <div style={meta}>Risk</div>
            <div style={{ fontWeight: 850, color: BAND_TEXT[band] }}>{riskScore(deal)}</div>
          </div>
        </div>
      </div>
      {deal.summary && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{deal.summary}</div>}
    </div>
  );
};
```

`hosting/src/components/deals/DealFiltersBar.tsx`:
```tsx
import React from 'react';
import type { RiskDeal } from '@/lib/types';
import type { RiskBand } from '@/lib/dealMetrics';
import { ACTIVITY_BUCKETS, repsIn, stagesIn, type ActivityBucket, type DealFilters } from '@/lib/dealFilters';
import { BAND_NAME, smallCaps } from '@/components/ui/tone';

export type DealsTabFilters = DealFilters & { hideReviewed?: boolean };

interface Props {
  deals: RiskDeal[];
  filters: DealsTabFilters;
  onChange: (patch: Partial<DealsTabFilters>) => void;
  exportCount: number;
  onExport: () => void;
}

const CLEARED: Partial<DealsTabFilters> = {
  rep: undefined, stage: undefined, band: undefined, activity: undefined,
  riskOnly: undefined, lateOnly: undefined, hideReviewed: undefined,
};

const selectStyle: React.CSSProperties = {
  width: '100%', minHeight: 40, padding: '0 0.6rem', borderRadius: 6, border: '1px solid var(--border-emphasis)',
  background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.85rem',
};
const fieldLabel: React.CSSProperties = { ...smallCaps, display: 'block', marginBottom: 4 };
const checkLabel: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, fontSize: '0.85rem', color: 'var(--text-primary)' };

export const DealFiltersBar: React.FC<Props> = ({ deals, filters, onChange, exportCount, onExport }) => {
  const chips: { label: string; clear: Partial<DealsTabFilters> }[] = [];
  if (filters.rep) chips.push({ label: `Rep: ${filters.rep}`, clear: { rep: undefined } });
  if (filters.stage) chips.push({ label: `Stage: ${filters.stage}`, clear: { stage: undefined } });
  if (filters.band) chips.push({ label: `Risk: ${BAND_NAME[filters.band]}`, clear: { band: undefined } });
  if (filters.activity) chips.push({ label: `Activity: ${ACTIVITY_BUCKETS.find(b => b.key === filters.activity)?.label}`, clear: { activity: undefined } });
  if (filters.riskOnly) chips.push({ label: 'At risk only', clear: { riskOnly: undefined } });
  if (filters.lateOnly) chips.push({ label: 'Late stage only', clear: { lateOnly: undefined } });
  if (filters.hideReviewed) chips.push({ label: 'Hiding reviewed', clear: { hideReviewed: undefined } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label htmlFor="deals-rep" style={fieldLabel}>Rep</label>
          <select id="deals-rep" value={filters.rep ?? ''} onChange={e => onChange({ rep: e.target.value || undefined })} style={selectStyle}>
            <option value="">All reps</option>
            {repsIn(deals).map(rep => <option key={rep} value={rep}>{rep}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="deals-stage" style={fieldLabel}>Stage</label>
          <select id="deals-stage" value={filters.stage ?? ''} onChange={e => onChange({ stage: e.target.value || undefined })} style={selectStyle}>
            <option value="">All stages</option>
            {stagesIn(deals).map(stage => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="deals-activity" style={fieldLabel}>Activity</label>
          <select id="deals-activity" value={filters.activity ?? ''} onChange={e => onChange({ activity: (e.target.value || undefined) as ActivityBucket | undefined })} style={selectStyle}>
            <option value="">Any activity</option>
            {ACTIVITY_BUCKETS.map(b => <option key={b.key} value={b.key}>{b.label} ({b.range})</option>)}
          </select>
        </div>
        <div role="group" aria-label="Risk band">
          <span style={fieldLabel}>Risk band</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['Red', 'Yellow', 'Green'] as RiskBand[]).map(band => {
              const active = filters.band === band;
              return (
                <button key={band} type="button" aria-pressed={active} onClick={() => onChange({ band: active ? undefined : band })} style={{
                  minHeight: 40, padding: '0 0.7rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                  border: `1px solid ${active ? 'var(--accent-fill)' : 'var(--border-emphasis)'}`,
                  background: active ? 'var(--accent-fill)' : 'var(--bg-surface)', color: active ? 'var(--on-accent)' : 'var(--text-primary)',
                }}>
                  {BAND_NAME[band]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1.2rem' }}>
        <label style={checkLabel}><input type="checkbox" checked={!!filters.riskOnly} onChange={e => onChange({ riskOnly: e.target.checked || undefined })} /> At risk only</label>
        <label style={checkLabel}><input type="checkbox" checked={!!filters.lateOnly} onChange={e => onChange({ lateOnly: e.target.checked || undefined })} /> Late stage only</label>
        <label style={checkLabel}><input type="checkbox" checked={!!filters.hideReviewed} onChange={e => onChange({ hideReviewed: e.target.checked || undefined })} /> Hide reviewed</label>
        <button type="button" onClick={onExport} disabled={exportCount === 0} style={{
          marginLeft: 'auto', minHeight: 36, padding: '0 0.85rem', borderRadius: 6, border: '1px solid var(--border-emphasis)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.8rem',
          cursor: exportCount === 0 ? 'not-allowed' : 'pointer', opacity: exportCount === 0 ? 0.5 : 1,
        }}>
          Export CSV ({exportCount})
        </button>
      </div>

      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {chips.map(chip => (
            <span key={chip.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 10px', borderRadius: 999, background: 'var(--takeaway-bg)', color: 'var(--takeaway-text)', fontSize: '0.8rem', fontWeight: 600 }}>
              {chip.label}
              <button type="button" aria-label={`Remove filter: ${chip.label}`} onClick={() => onChange(chip.clear)} style={{ minWidth: 28, minHeight: 28, border: 'none', background: 'none', color: 'inherit', fontWeight: 800, cursor: 'pointer' }}>×</button>
            </span>
          ))}
          <button type="button" onClick={() => onChange(CLEARED)} style={{ minHeight: 28, border: 'none', background: 'none', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
```

`hosting/src/components/deals/RepSummary.tsx`:
```tsx
import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { isAtRisk, revenueConfidence, sumValue } from '@/lib/dealMetrics';
import { plural } from '@/lib/takeaways';
import { scoreTextColor } from '@/components/ui/tone';

interface Props {
  rep: string;
  repDeals: RiskDeal[];
  regionDeals: RiskDeal[];
  /** e.g. "UK" or "all-regions", used in "12 points below the UK average". */
  regionName: string;
}

/** A rep's headline numbers. Their 8–15 deals are too few for useful charts. */
export const RepSummary: React.FC<Props> = ({ rep, repDeals, regionDeals, regionName }) => {
  const confidence = revenueConfidence(repDeals);
  const diff = confidence - revenueConfidence(regionDeals);
  const comparison = diff === 0
    ? `level with the ${regionName} average`
    : `${Math.abs(diff)} points ${diff > 0 ? 'above' : 'below'} the ${regionName} average`;

  return (
    <div role="status" aria-label={`Summary for ${rep}`} style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem 1.2rem',
      padding: '0.75rem 0.9rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)',
    }}>
      <strong style={{ fontSize: '1rem' }}>{rep}</strong>
      <span>{plural(repDeals.length, 'deal')}</span>
      <span>{formatCurrency(sumValue(repDeals))} pipeline</span>
      <span style={{ fontWeight: 700, color: 'var(--error-text)' }}>{formatCurrency(sumValue(repDeals.filter(isAtRisk)))} at risk</span>
      <span style={{ fontWeight: 700, color: scoreTextColor(confidence) }}>Confidence {confidence}/100</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{comparison}</span>
    </div>
  );
};
```

`hosting/src/components/tabs/DealsTab.tsx`:
```tsx
import React, { useMemo, useState } from 'react';
import type { Region, RiskDeal } from '@/lib/types';
import { applyDealFilters, repName } from '@/lib/dealFilters';
import { riskScore } from '@/lib/dealMetrics';
import { regionLabel } from '@/lib/regions';
import { plural } from '@/lib/takeaways';
import { downloadDealsCsv } from '@/lib/exportCsv';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { DealDetailModal } from '@/components/dashboard/DealDetailModal';
import { useReviews } from '@/components/reviews/ReviewsContext';
import { DealCard } from '@/components/deals/DealCard';
import { DealFiltersBar, type DealsTabFilters } from '@/components/deals/DealFiltersBar';
import { RepSummary } from '@/components/deals/RepSummary';

const PAGE_SIZE = 24;

interface Props {
  /** Deals in the selected region. */
  deals: RiskDeal[];
  region: Region;
  filters: DealsTabFilters;
  onFiltersChange: (patch: Partial<DealsTabFilters>) => void;
  dealsError?: string;
}

export const DealsTab: React.FC<Props> = ({ deals, region, filters, onFiltersChange, dealsError }) => {
  const reviews = useReviews();
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<RiskDeal | null>(null);

  const filtered = useMemo(() => applyDealFilters(deals, filters), [deals, filters]);
  const visible = useMemo(
    () => (filters.hideReviewed ? filtered.filter(d => !reviews.isDone(d)) : filtered)
      .slice()
      .sort((a, b) => riskScore(b) - riskScore(a)),
    [filtered, filters.hideReviewed, reviews],
  );
  const shown = showAll ? visible : visible.slice(0, PAGE_SIZE);
  const scope = region === 'all' ? 'all regions' : regionLabel(region);

  let emptyMessage = 'No deals match these filters.';
  if (deals.length === 0) emptyMessage = dealsError ? 'Deals could not be loaded.' : 'No open deals in this view.';
  else if (filtered.length > 0 && filters.hideReviewed) emptyMessage = `All ${plural(filtered.length, 'deal')} here have been reviewed.`;

  return (
    <InsightPanel
      label="Deals"
      question="Which deals need work, and who owns them?"
      takeaway={`Showing ${plural(visible.length, 'deal')} of ${deals.length} in ${scope}, highest risk first.`}
    >
      {dealsError && (
        <div role="alert" style={{ padding: '0.6rem 0.85rem', borderRadius: 6, border: '1px solid var(--error)', background: 'var(--error-subtle)', color: 'var(--error-text)', fontSize: '0.8rem' }}>
          Could not load deals: {dealsError.replace(/\.$/, '')}. Showing the capped list embedded in the report.
        </div>
      )}
      <DealFiltersBar deals={deals} filters={filters} onChange={onFiltersChange} exportCount={filtered.length} onExport={() => downloadDealsCsv(filtered)} />
      {filters.rep && (
        <RepSummary
          rep={filters.rep}
          repDeals={deals.filter(d => repName(d) === filters.rep)}
          regionDeals={deals}
          regionName={region === 'all' ? 'all-regions' : regionLabel(region)}
        />
      )}
      {visible.length === 0 ? (
        <div style={{ padding: '1.25rem', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {emptyMessage}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '0.85rem' }}>
          {shown.map(deal => <DealCard key={`${deal.id}-${deal.value}`} deal={deal} onOpen={setSelected} />)}
        </div>
      )}
      {visible.length > PAGE_SIZE && (
        <button type="button" onClick={() => setShowAll(s => !s)} style={{
          alignSelf: 'center', minHeight: 40, padding: '0 1rem', borderRadius: 6, border: '1px solid var(--border-emphasis)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer',
        }}>
          {showAll ? 'Show fewer' : `Show all ${visible.length} deals`}
        </button>
      )}
      <DealDetailModal deal={selected} onClose={() => setSelected(null)} />
    </InsightPanel>
  );
};
```

**Step 4: Wire it in and retire RiskRadar**

- In `App.tsx`, import `DealsTab` and replace the `case 'deals':` block with:
  ```tsx
  case 'deals':
    return <DealsTab deals={regionDeals} region={view.region} filters={view} onFiltersChange={setFilters} dealsError={dealsError} />;
  ```
- Remove the `RiskRadar` import.
- Delete the old files:
  ```bash
  git rm src/components/dashboard/RiskRadar.tsx src/components/dashboard/RiskRadar.test.tsx src/hooks/useDealReviews.ts
  grep -rn "RiskRadar\|useDealReviews" src
  ```
  Expected: no matches.

> Everything RiskRadar did now lives elsewhere:
> - the bubble map, drivers and gauge are on the Overview (Task 15)
> - stage, rep, band and late filters, "hide reviewed" and CSV export are in `DealFiltersBar`
> - the deal list is now `DealCard`s
> - the late-stage strip became the Overview queue
>
> Its region chips are replaced by the global selector. The "Risk distribution by pipeline value" bar and the "Risk driver ranking" list are dropped on purpose; the radar and the RiskMap legend carry the same information. Mention this to the user.

**Step 5: Run everything**

Run: `npx vitest run && npx tsc --noEmit && npm run build` → PASS. App test 3 ("narrows the Deals tab…") still passes: `DealCard` keeps the `Open <name>` label.

**Step 6: Commit**
```bash
git add src/lib/exportCsv.ts src/lib/exportCsv.test.ts src/components/deals src/components/tabs/DealsTab.tsx src/components/tabs/DealsTab.test.tsx src/App.tsx
git commit -m "feat(hosting): Deals tab with filters, rep summary and shared reviews; retire RiskRadar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 17: Pipeline Health tab (click-through stages, buckets, reps)

**Files:**
- Modify (full rewrite below): `hosting/src/components/dashboard/RiskByStage.tsx`
- Modify (full rewrite below): `hosting/src/components/dashboard/ActivityHealth.tsx`
- Modify: `hosting/src/components/dashboard/RepHeatmap.tsx`
- Test: `hosting/src/components/dashboard/RepHeatmap.test.tsx` (new)
- Create: `hosting/src/components/tabs/PipelineHealthTab.tsx` + `PipelineHealthTab.test.tsx`
- Modify: `hosting/src/App.tsx` (health case)

**Step 1: Write the failing tests**

`RepHeatmap.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { RepHeatmap } from './RepHeatmap';

describe('RepHeatmap', () => {
  it('ranks reps riskiest first and opens a rep on click', () => {
    const onRepClick = vi.fn();
    render(<RepHeatmap risks={[makeDeal({ rep: 'Sam', healthScore: 80, level: 'LOW' }), makeDeal({ rep: 'Jo', healthScore: 30, level: 'HIGH' })]} onRepClick={onRepClick} />);
    const rows = screen.getAllByRole('button', { name: /^Show deals for / });
    expect(rows.map(r => r.getAttribute('aria-label'))).toEqual(['Show deals for Jo', 'Show deals for Sam']);
    fireEvent.click(rows[0]);
    expect(onRepClick).toHaveBeenCalledWith('Jo');
    // The panel header now comes from InsightPanel.
    expect(screen.queryByText('Rep Performance')).not.toBeInTheDocument();
  });
});
```

`PipelineHealthTab.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { PipelineHealthTab } from './PipelineHealthTab';

describe('PipelineHealthTab', () => {
  it('leads each panel with a takeaway and drills into Deals', () => {
    const onGoToDeals = vi.fn();
    render(
      <PipelineHealthTab
        deals={[makeDeal({ stage: 'Commit', level: 'HIGH', healthScore: 20, daysStalled: 20, rep: 'Jo' })]}
        funnel={[]}
        forecastStat={{ value: '70%', change: '—', dir: 'flat', sub: '' }}
        onGoToDeals={onGoToDeals}
      />,
    );
    expect(screen.getByText('Commit holds 1 HIGH-risk deal worth $10K.')).toBeInTheDocument();
    expect(screen.getByText(/the AI's own assessment/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show Commit deals (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show dormant deals (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show deals for Jo' }));
    expect(onGoToDeals).toHaveBeenNthCalledWith(1, { stage: 'Commit' });
    expect(onGoToDeals).toHaveBeenNthCalledWith(2, { activity: 'dormant' });
    expect(onGoToDeals).toHaveBeenNthCalledWith(3, { rep: 'Jo' });
  });
});
```

**Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/dashboard/RepHeatmap.test.tsx src/components/tabs/PipelineHealthTab.test.tsx` → FAIL.

**Step 3: Write the implementation**

`RiskByStage.tsx` (full file):
```tsx
import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { normalizeStage, STAGE_ORDER } from '@/lib/format';

interface Props {
  risks: RiskDeal[];
  /** When given, each stage row is a button that drills into that stage's deals. */
  onStageClick?: (stage: string) => void;
}

// Each band segment carries its count and a letter so the split is readable
// without relying on colour alone.
const segmentStyle: React.CSSProperties = {
  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  whiteSpace: 'nowrap', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.58rem', fontWeight: 700,
};

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem' };

export const RiskByStage: React.FC<Props> = ({ risks, onStageClick }) => {
  if (risks.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
        No risk data available
      </div>
    );
  }

  const stageMap: Record<string, { high: number; medium: number; low: number; total: number }> = {};
  for (const risk of risks) {
    const stage = normalizeStage(risk.stage);
    if (!stageMap[stage]) stageMap[stage] = { high: 0, medium: 0, low: 0, total: 0 };
    stageMap[stage].total++;
    if (risk.level === 'HIGH') stageMap[stage].high++;
    else if (risk.level === 'MEDIUM') stageMap[stage].medium++;
    else stageMap[stage].low++;
  }

  const orderedStages = [
    ...STAGE_ORDER.filter(s => stageMap[s]),
    ...Object.keys(stageMap).filter(s => !STAGE_ORDER.includes(s)),
  ];
  const maxTotal = Math.max(...orderedStages.map(s => stageMap[s].total), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {orderedStages.map(stage => {
        const { high, medium, low, total } = stageMap[stage];
        const barWidth = (total / maxTotal) * 100;
        const highPct = total > 0 ? (high / total) * barWidth : 0;
        const medPct = total > 0 ? (medium / total) * barWidth : 0;
        const lowPct = total > 0 ? (low / total) * barWidth : 0;

        const content = (
          <>
            <div style={{ width: 110, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {stage}
            </div>
            <div style={{ flex: 1, height: 14, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              {high > 0 && (
                <div aria-label={`${stage}: ${high} high risk`} title={`${high} high`} style={{ ...segmentStyle, width: `${highPct}%`, background: 'var(--error)' }}>{high} H</div>
              )}
              {medium > 0 && (
                <div aria-label={`${stage}: ${medium} medium risk`} title={`${medium} medium`} style={{ ...segmentStyle, width: `${medPct}%`, background: 'var(--warning)' }}>{medium} M</div>
              )}
              {low > 0 && (
                <div aria-label={`${stage}: ${low} low risk`} title={`${low} low`} style={{ ...segmentStyle, width: `${lowPct}%`, background: 'var(--success)' }}>{low} L</div>
              )}
            </div>
            <div style={{ width: 28, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              {total}
            </div>
          </>
        );

        return onStageClick ? (
          <button
            key={stage}
            type="button"
            onClick={() => onStageClick(stage)}
            aria-label={`Show ${stage} deals (${total})`}
            style={{ ...rowStyle, width: '100%', minHeight: 36, padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
          >
            {content}
          </button>
        ) : (
          <div key={stage} style={rowStyle}>{content}</div>
        );
      })}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {[
          { color: 'var(--error)', label: 'High' },
          { color: 'var(--warning)', label: 'Medium' },
          { color: 'var(--success)', label: 'Low' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          {risks.length} total{onStageClick ? ' · click a stage to see its deals' : ''}
        </div>
      </div>
    </div>
  );
};
```

`ActivityHealth.tsx` (full file; buckets now come from `lib/dealFilters`, with the same thresholds):
```tsx
import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { ACTIVITY_BUCKETS, activityBucket, type ActivityBucket } from '@/lib/dealFilters';

interface Props {
  risks: RiskDeal[];
  /** When given, each bucket is a button that drills into its deals. */
  onBucketClick?: (bucket: ActivityBucket) => void;
}

const COLOR: Record<ActivityBucket, string> = {
  active: 'var(--success)', cooling: 'var(--warning)', dormant: 'var(--error)', dark: 'var(--text-muted)',
};

export const ActivityHealth: React.FC<Props> = ({ risks, onBucketClick }) => {
  if (risks.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
        No activity data
      </div>
    );
  }

  const total = risks.length;
  const buckets = ACTIVITY_BUCKETS.map(b => {
    const deals = risks.filter(r => activityBucket(r.daysStalled) === b.key);
    return { ...b, color: COLOR[b.key], count: deals.length, pipelineValue: deals.reduce((sum, r) => sum + (r.pipelineValue ?? 0), 0) };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '0.75rem' }}>
      {buckets.map(b => {
        const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
        const cardStyle: React.CSSProperties = {
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderTop: `3px solid ${b.color}`,
          borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem',
        };
        const content = (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{b.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{b.range}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>{b.count}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{pct}%</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {b.pipelineValue > 0 ? formatCurrency(b.pipelineValue) : '—'}
            </div>
          </>
        );
        return onBucketClick ? (
          <button
            key={b.key}
            type="button"
            onClick={() => onBucketClick(b.key)}
            aria-label={`Show ${b.label.toLowerCase()} deals (${b.count})`}
            style={{ ...cardStyle, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
          >
            {content}
          </button>
        ) : (
          <div key={b.key} style={cardStyle}>{content}</div>
        );
      })}
    </div>
  );
};
```

`RepHeatmap.tsx`:
1. Change the props to:
   ```ts
   interface Props {
     risks: RiskDeal[];
     /** Opens the Deals tab filtered to this rep. */
     onRepClick: (rep: string) => void;
   }
   ```
   and the signature to `export function RepHeatmap({ risks, onRepClick }: Props)`.
2. In both the empty-state wrapper and the main wrapper `<div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem' }}>`, replace the style with `style={{ minWidth: 0 }}`. `InsightPanel` supplies the card now.
3. Delete the `{/* Header */}` block: the `<div style={{ marginBottom: '1rem' }}>` containing "Rep Performance" and "Ranked by avg health score · lowest first".
4. Change each row from `<div key={row.name} style={{ display: 'grid', … }}>…</div>` to a button. Keep the existing grid/padding/background values and put the border reset first:
   ```tsx
   <button
     key={row.name}
     type="button"
     onClick={() => onRepClick(row.name)}
     aria-label={`Show deals for ${row.name}`}
     style={{
       border: 'none',
       width: '100%',
       textAlign: 'left',
       font: 'inherit',
       color: 'inherit',
       cursor: 'pointer',
       display: 'grid',
       gridTemplateColumns: gridColumns,
       alignItems: 'center',
       gap: '0.75rem',
       padding: '0.65rem 0.5rem',
       minHeight: 44,
       background: isAlt ? 'var(--bg-elevated)' : 'transparent',
       borderBottom: isLast ? 'none' : '1px solid var(--border)',
       borderRadius: isAlt ? 4 : 0,
     }}
   >
   ```
   Close it with `</button>` where the row's `</div>` was.

`hosting/src/components/tabs/PipelineHealthTab.tsx`:
```tsx
import React from 'react';
import type { FunnelStage, RiskDeal, StatData } from '@/lib/types';
import type { DealFilters } from '@/lib/dealFilters';
import { activityTakeaway, forecastTakeaway, funnelTakeaway, repTakeaway, stageTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { RiskByStage } from '@/components/dashboard/RiskByStage';
import { ActivityHealth } from '@/components/dashboard/ActivityHealth';
import { ForecastIntegrity } from '@/components/dashboard/ForecastIntegrity';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { RepHeatmap } from '@/components/dashboard/RepHeatmap';

interface Props {
  deals: RiskDeal[];
  funnel: FunnelStage[];
  /** The AI's forecast confidence (report stats), shown labelled as the AI's view. */
  forecastStat: StatData;
  onGoToDeals: (filters: DealFilters) => void;
}

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: '1.25rem' };

/** Where is the pipeline weak, and who needs help? Every panel drills into the Deals tab. */
export const PipelineHealthTab: React.FC<Props> = ({ deals, funnel, forecastStat, onGoToDeals }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
    <div style={grid}>
      <InsightPanel label="Risk by stage" question="Which stages are leaking?" takeaway={stageTakeaway(deals)}>
        <RiskByStage risks={deals} onStageClick={stage => onGoToDeals({ stage })} />
      </InsightPanel>
      <InsightPanel label="Activity health" question="Are reps still working these deals?" takeaway={activityTakeaway(deals)}>
        <ActivityHealth risks={deals} onBucketClick={activity => onGoToDeals({ activity })} />
      </InsightPanel>
      <InsightPanel
        label="Forecast integrity"
        question="Does the forecast match deal reality?"
        takeaway={forecastTakeaway(deals)}
        note="Forecast confidence here is the AI's own assessment. The Overview gauge is computed from deal health."
      >
        <ForecastIntegrity risks={deals} forecastStat={forecastStat} />
      </InsightPanel>
      <InsightPanel label="Pipeline funnel" question="Is there enough pipeline coming through?" takeaway={funnelTakeaway(funnel)}>
        <PipelineFunnel stages={funnel} />
      </InsightPanel>
    </div>
    <InsightPanel label="Rep heatmap" question="Which reps need help?" takeaway={repTakeaway(deals)}>
      <RepHeatmap risks={deals} onRepClick={rep => onGoToDeals({ rep })} />
    </InsightPanel>
  </div>
);
```

**Step 4: Wire it in**

In `App.tsx`, import `PipelineHealthTab` and replace the `case 'health':` block with:
```tsx
case 'health':
  return <PipelineHealthTab deals={regionDeals} funnel={data.funnel} forecastStat={data.stats.forecast} onGoToDeals={goToDeals} />;
```
Then remove the now-unused imports: `Panel`, `RiskByStage`, `ActivityHealth`, `ForecastIntegrity`, `RepHeatmap`, `PipelineFunnel`, `isDormant`, `isDark`, `isMisaligned`.

**Step 5: Run everything.** Run: `npx vitest run && npx tsc --noEmit` → PASS. The existing `RiskByStage` test still passes, because the segment labels are unchanged.

**Step 6: Commit**
```bash
git add src/components/dashboard/RiskByStage.tsx src/components/dashboard/ActivityHealth.tsx src/components/dashboard/RepHeatmap.tsx src/components/dashboard/RepHeatmap.test.tsx src/components/tabs/PipelineHealthTab.tsx src/components/tabs/PipelineHealthTab.test.tsx src/App.tsx
git commit -m "feat(hosting): Pipeline Health tab with drill-through to Deals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 18: CRO Brief tab

**Files:**
- Move: `hosting/src/components/dashboard/TwentyQuestions.tsx` → `hosting/src/components/cro/QuestionDetail.tsx` (keep only the table rendering)
- Create: `hosting/src/lib/croQuestions.ts` + `croQuestions.test.ts`
- Create: `hosting/src/components/cro/CroQuestionsGrid.tsx` + `CroQuestionsGrid.test.tsx`
- Create: `hosting/src/components/cro/Interventions.tsx` + `Interventions.test.tsx`
- Create: `hosting/src/components/cro/ActionList.tsx` + `ActionList.test.tsx`
- Create: `hosting/src/components/tabs/CroBriefTab.tsx`
- Modify: `hosting/src/App.tsx` (cro case)
- Delete: `TwentyQuestions.test.tsx`, `Recommendations.tsx`, `Recommendations.test.tsx` (their behaviour is ported to the new tests)

**Step 1: Move the question detail renderer**
```bash
git mv src/components/dashboard/TwentyQuestions.tsx src/components/cro/QuestionDetail.tsx
git rm src/components/dashboard/TwentyQuestions.test.tsx
```
In `src/components/cro/QuestionDetail.tsx`:
- Delete `QUESTION_KEYS`, `QUESTION_BADGES` and the whole `export const TwentyQuestions …` component.
- Add `export` to `function QuestionDetail` and `function hasDetail`.
- Delete the now-unused imports: `useState`, `motion`, `itemVariants`, `TwentyQuestionsData`, `NotGeneratedPanel`.
- Change the `React` import to `import React from 'react';`.

**Step 2: Write the failing tests**

`croQuestions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { filterQuestionByRegion, questionStat } from './croQuestions';

const q = {
  label: 'Gone silent', answer: 'Deals went quiet.',
  silent7Days: [
    { name: 'Acme', rep: 'Jo', region: 'UK', mrr: '$1K', stage: 'Proposal', daysSinceActivity: 9 },
    { name: 'Beta', rep: 'Sam', region: 'North America', mrr: '$2,500', stage: 'Commit', daysSinceActivity: 12 },
  ],
};

describe('filterQuestionByRegion', () => {
  it('keeps only rows in the region, matching LLM region names', () => {
    expect(filterQuestionByRegion(q, 'uk').silent7Days?.map(r => r.name)).toEqual(['Acme']);
    expect(filterQuestionByRegion(q, 'all')).toBe(q);
  });
});

describe('questionStat', () => {
  it('counts deal rows and sums their MRR', () => {
    expect(questionStat(q)).toEqual({ count: 2, text: '2 deals · $4K' });
  });

  it('describes region-only and empty questions', () => {
    expect(questionStat({ label: 'Coverage', answer: '', regions: [{ region: 'UK' }, { region: 'AU' }] })).toEqual({ count: 2, text: '2 regions' });
    expect(questionStat({ label: 'x', answer: '' })).toEqual({ count: 0, text: 'Nothing flagged' });
  });
});
```

`CroQuestionsGrid.test.tsx` (ports the old TwentyQuestions tests):
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CroQuestionsGrid } from './CroQuestionsGrid';

const data = {
  question1: {
    label: 'Deals Gone Silent',
    answer: 'Three deals have gone quiet.',
    silent7Days: [{ name: 'Acme', rep: 'Jo', region: 'UK', mrr: '$1K', stage: 'Proposal', daysSinceActivity: 9 }],
  },
  question3: { label: 'Coverage', answer: 'Coverage is fine.' },
};

describe('CroQuestionsGrid', () => {
  it('renders nothing without a live report, and says when it was not generated', () => {
    const { container } = render(<CroQuestionsGrid data={undefined} region="all" />);
    expect(container).toBeEmptyDOMElement();
    render(<CroQuestionsGrid data={{ generatedAt: '2026-09-09' }} region="all" isLive />);
    expect(screen.getByText('Not generated for this run')).toBeInTheDocument();
  });

  it('shows a code-computed stat per card and expands the rows behind it', () => {
    render(<CroQuestionsGrid data={data} region="all" isLive />);
    expect(screen.getByText('1 deal · $1K')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'View 1 →' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Days Silent')).toBeInTheDocument();
  });

  it('offers "Read more" for questions with no rows', () => {
    render(<CroQuestionsGrid data={data} region="all" isLive />);
    expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument();
    expect(screen.getByText('Coverage is fine.')).toBeInTheDocument();
  });

  it('filters rows to the region and says the prose is global', () => {
    render(<CroQuestionsGrid data={data} region="na" isLive />);
    expect(screen.getAllByText('Nothing flagged')).toHaveLength(2);
    expect(screen.getByText(/the AI's written answers cover all regions/)).toBeInTheDocument();
  });
});
```

`Interventions.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { makeDeal } from '@/test/fixtures';
import { MemoryReviewsProvider } from '@/components/reviews/ReviewsContext';
import { Interventions } from './Interventions';

const data = {
  question10: {
    label: 'Top deals needing CRO intervention', answer: '',
    deals: [
      { name: 'Acme Renewal', rep: 'Jo', region: 'UK', mrr: '$12,000', croAction: 'Call the CFO', deadline: '2026-10-18' },
      { name: 'Unknown Co', rep: 'Sam', region: 'UK', mrr: '$3K', croAction: 'Exec sponsor' },
      { name: 'Far Away', rep: 'Lee', region: 'AU', mrr: '$5K', croAction: 'Re-qualify' },
    ],
  },
};

describe('Interventions', () => {
  it('lists the region\'s deals with action and deadline, and reviews matched deals', () => {
    render(
      <MemoryReviewsProvider>
        <Interventions data={data} region="uk" deals={[makeDeal({ value: 'Acme Renewal' })]} isLive />
      </MemoryReviewsProvider>,
    );
    expect(screen.getByText('2 deals worth $15K need you personally.')).toBeInTheDocument();
    expect(screen.getByText('Call the CFO')).toBeInTheDocument();
    expect(screen.getByText('by 18 Oct 2026')).toBeInTheDocument();
    expect(screen.queryByText('Far Away')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed: Acme Renewal' }));
    expect(screen.getByRole('region', { name: /1 of 2 reviewed/ })).toBeInTheDocument();
    // An AI row with no matching report deal has nothing to review.
    expect(screen.queryByRole('button', { name: /Unknown Co/ })).not.toBeInTheDocument();
  });

  it('says when the section was not generated', () => {
    render(<Interventions data={undefined} region="all" deals={[]} isLive />);
    expect(screen.getByText('Not generated for this run')).toBeInTheDocument();
  });
});
```

`ActionList.test.tsx` (ports the Recommendations tests):
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionList } from './ActionList';

describe('ActionList', () => {
  it('says so when there are no recommendations', () => {
    render(<ActionList items={[]} />);
    expect(screen.getByText('No recommendations were generated for this run.')).toBeInTheDocument();
  });

  it('shows one line per action, P1 first, and expands the detail', () => {
    render(<ActionList items={[
      { priority: 'P2', title: 'Coach on multithreading', desc: 'Run a session.', impact: '$20K' },
      { priority: 'P1', title: 'Call Acme', desc: 'Champion went dark', impact: '$40K' },
    ]} />);
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Call Acme');
    expect(screen.queryByText('Champion went dark')).not.toBeInTheDocument();
    fireEvent.click(rows[0]);
    expect(screen.getByText('Champion went dark')).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute('aria-expanded', 'true');
  });
});
```

**Step 3: Run them to verify they fail**

Run: `npx vitest run src/lib/croQuestions.test.ts src/components/cro` → FAIL.

**Step 4: Write the implementation**

`hosting/src/lib/croQuestions.ts`:
```ts
import type { Region, TQDealRow, TQGapDeal, TQQuestion, TQRegionRow, TQRepRow, TQSilentDeal, TQThreatRow, TwentyQuestionsData } from './types';
import { asArray } from './guards';
import { normalizeRegionKey } from './regions';
import { formatCurrency, parseMoney } from './format';
import { plural } from './takeaways';

export type QuestionKey = Exclude<keyof TwentyQuestionsData, 'generatedAt' | 'question10'>;

/** Questions 1–9 in display order. Question 10 (CRO interventions) has its own panel. */
export const CRO_QUESTIONS: { key: QuestionKey; label: string }[] = [
  { key: 'question1', label: 'Gone silent' },
  { key: 'question2', label: 'Slippage' },
  { key: 'question3', label: 'Coverage' },
  { key: 'question4', label: 'Rep risk' },
  { key: 'question5', label: 'No economic buyer' },
  { key: 'question6', label: 'Competitive' },
  { key: 'question7', label: 'Forecast fiction' },
  { key: 'question8', label: 'Risk by region' },
  { key: 'question9', label: 'Stage stalls' },
];

function keep<T extends { region?: string }>(rows: unknown, region: Region): T[] {
  return asArray<T>(rows).filter(r => normalizeRegionKey(r?.region) === region);
}

/** Narrow every row array to one region. The AI's prose answer is left untouched (it is global). */
export function filterQuestionByRegion(q: TQQuestion, region: Region): TQQuestion {
  if (region === 'all') return q;
  return {
    ...q,
    silent7Days: keep<TQSilentDeal>(q.silent7Days, region),
    silent14Days: keep<TQSilentDeal>(q.silent14Days, region),
    silent30Days: keep<TQSilentDeal>(q.silent30Days, region),
    deals: keep<TQDealRow>(q.deals, region),
    regions: keep<TQRegionRow>(q.regions, region),
    reps: keep<TQRepRow>(q.reps, region),
    threats: keep<TQThreatRow>(q.threats, region),
    optimismBias: keep<TQGapDeal>(q.optimismBias, region),
    sandbagging: keep<TQGapDeal>(q.sandbagging, region),
  };
}

/** A card's headline figure, counted from its rows (never read from the prose). */
export function questionStat(q: TQQuestion): { count: number; text: string } {
  const dealRows = [
    ...asArray<{ mrr?: string }>(q.silent7Days), ...asArray<{ mrr?: string }>(q.silent14Days),
    ...asArray<{ mrr?: string }>(q.silent30Days), ...asArray<{ mrr?: string }>(q.deals),
    ...asArray<{ mrr?: string }>(q.optimismBias), ...asArray<{ mrr?: string }>(q.sandbagging),
  ];
  if (dealRows.length) {
    const value = dealRows.reduce((sum, r) => sum + parseMoney(r?.mrr), 0);
    return { count: dealRows.length, text: `${plural(dealRows.length, 'deal')}${value > 0 ? ` · ${formatCurrency(value)}` : ''}` };
  }
  const reps = asArray(q.reps);
  if (reps.length) return { count: reps.length, text: plural(reps.length, 'rep') };
  const threats = asArray<TQThreatRow>(q.threats);
  if (threats.length) {
    const affected = threats.reduce((sum, t) => sum + (Number(t?.affectedDeals) || 0), 0);
    return { count: threats.length, text: `${plural(threats.length, 'competitor')} · ${plural(affected, 'deal')}` };
  }
  const regions = asArray(q.regions);
  if (regions.length) return { count: regions.length, text: plural(regions.length, 'region') };
  return { count: 0, text: 'Nothing flagged' };
}
```

`hosting/src/components/cro/CroQuestionsGrid.tsx`:
```tsx
import React, { useState } from 'react';
import type { Region, TwentyQuestionsData } from '@/lib/types';
import { CRO_QUESTIONS, filterQuestionByRegion, questionStat } from '@/lib/croQuestions';
import { regionLabel } from '@/lib/regions';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { NotGeneratedPanel } from '@/components/dashboard/NotGeneratedPanel';
import { linkButton, smallCaps } from '@/components/ui/tone';
import { QuestionDetail, hasDetail } from './QuestionDetail';

interface Props {
  data?: TwentyQuestionsData;
  region: Region;
  isLive?: boolean;
}

export const CroQuestionsGrid: React.FC<Props> = ({ data, region, isLive }) => {
  const [open, setOpen] = useState<string | null>(null);
  const questions = CRO_QUESTIONS.flatMap(meta => {
    const q = data?.[meta.key];
    return q && typeof q === 'object' ? [{ ...meta, question: filterQuestionByRegion(q, region) }] : [];
  });

  if (!questions.length) return isLive ? <NotGeneratedPanel title="CRO questions" /> : null;

  const flagged = questions.filter(q => questionStat(q.question).count > 0).length;
  const scope = region === 'all' ? 'across all regions' : `in ${regionLabel(region)}`;

  return (
    <InsightPanel
      label="CRO questions"
      question="What should I ask in the forecast call?"
      takeaway={`${flagged} of ${questions.length} questions flag something ${scope}.`}
      note={region !== 'all' ? `Counts and tables are for ${regionLabel(region)}; the AI's written answers cover all regions.` : undefined}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '0.85rem', alignItems: 'start' }}>
        {questions.map(({ key, label, question }) => {
          const stat = questionStat(question);
          const isOpen = open === key;
          const detail = hasDetail(question);
          const detailId = `cro-${key}-detail`;
          return (
            <article key={key} aria-label={label} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span style={{ ...smallCaps, color: 'var(--accent)' }}>{label}</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.count ? 'var(--text-primary)' : 'var(--success-text)' }}>{stat.text}</span>
              <p style={{
                margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                ...(isOpen ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
              }}>
                {question.answer}
              </p>
              <button type="button" aria-expanded={isOpen} aria-controls={detail && isOpen ? detailId : undefined} onClick={() => setOpen(isOpen ? null : key)} style={{ ...linkButton, alignSelf: 'flex-start', padding: 0 }}>
                {isOpen ? 'Hide' : detail ? `View ${stat.count} →` : 'Read more'}
              </button>
              {isOpen && detail && <div id={detailId}><QuestionDetail qKey={key} question={question} /></div>}
            </article>
          );
        })}
      </div>
    </InsightPanel>
  );
};
```

`hosting/src/components/cro/Interventions.tsx`:
```tsx
import React from 'react';
import type { Region, RiskDeal, TQDealRow, TwentyQuestionsData } from '@/lib/types';
import { asArray } from '@/lib/guards';
import { formatDate } from '@/lib/format';
import { normalizeRegionKey, regionLabel } from '@/lib/regions';
import { interventionsTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { NotGeneratedPanel } from '@/components/dashboard/NotGeneratedPanel';
import { ReviewButton } from '@/components/reviews/ReviewButton';
import { useReviews } from '@/components/reviews/ReviewsContext';

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

interface Props {
  data?: TwentyQuestionsData;
  region: Region;
  /** Report deals, used to attach a shared review to each AI-named deal. */
  deals: RiskDeal[];
  isLive?: boolean;
}

/** CRO question 10: the deals that need the CRO personally. */
export const Interventions: React.FC<Props> = ({ data, region, deals, isLive }) => {
  const reviews = useReviews();
  const q10 = data?.question10;
  if (!q10 || typeof q10 !== 'object') return isLive ? <NotGeneratedPanel title="Needs your intervention" /> : null;

  const rows = asArray<TQDealRow>(q10.deals).filter(r => region === 'all' || normalizeRegionKey(r?.region) === region);
  const matched = rows.map(row => ({
    row,
    deal: deals.find(d => norm(d.value) === norm(row.name) || (!!d.accountName && norm(d.accountName) === norm(row.name))),
  }));
  const done = matched.filter(m => m.deal && reviews.isDone(m.deal)).length;

  return (
    <InsightPanel
      label={`Needs your intervention · ${done} of ${rows.length} reviewed`}
      question="Which deals need the CRO personally?"
      takeaway={interventionsTakeaway(rows)}
      note={region !== 'all' ? `The AI picked these from all regions; showing the ones in ${regionLabel(region)}.` : undefined}
    >
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {matched.map(({ row, deal }, i) => (
          <li key={`${row.name}-${i}`} style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1rem', padding: '0.7rem 0.25rem',
            borderTop: '1px solid var(--border)', opacity: deal && reviews.isDone(deal) ? 0.6 : 1,
          }}>
            <div style={{ flex: '2 1 240px', minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{row.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {[row.rep, regionLabel(row.region), row.stage, row.mrr].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ flex: '3 1 280px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{row.croAction || row.urgencySignal || '—'}</div>
            {row.deadline && <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning-text)' }}>by {formatDate(row.deadline)}</div>}
            {deal && <ReviewButton deal={deal} />}
          </li>
        ))}
      </ul>
    </InsightPanel>
  );
};
```

`hosting/src/components/cro/ActionList.tsx`:
```tsx
import React, { useState } from 'react';
import type { Recommendation } from '@/lib/types';
import { asArray } from '@/lib/guards';
import { plural } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';

const ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
const PRIORITY_STYLE: Record<string, React.CSSProperties> = {
  P1: { background: 'var(--error-subtle)', color: 'var(--error-text)' },
  P2: { background: 'var(--accent-subtle)', color: 'var(--accent)' },
  P3: { background: 'var(--success-subtle)', color: 'var(--success-text)' },
};

/** This week's actions: one line each, P1 first, click for the detail. */
export const ActionList: React.FC<{ items: Recommendation[] }> = ({ items }) => {
  const [open, setOpen] = useState<number | null>(null);
  const list = asArray<Recommendation>(items)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (ORDER[a.item.priority] ?? 3) - (ORDER[b.item.priority] ?? 3));
  const p1 = list.filter(x => x.item.priority === 'P1').length;
  const takeaway = !list.length
    ? 'No recommendations were generated for this run.'
    : p1 ? `${plural(p1, 'P1 action')} this week, highest revenue impact first.` : `${plural(list.length, 'action')} this week; none are P1.`;

  return (
    <InsightPanel label="This week's actions" question="What should we do this week?" takeaway={takeaway}>
      {list.map(({ item, index }) => {
        const isOpen = open === index;
        return (
          <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : index)} style={{
              width: '100%', minHeight: 48, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.9rem',
              padding: '0.6rem 0.9rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', font: 'inherit',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, ...(PRIORITY_STYLE[item.priority] ?? {}) }}>{item.priority}</span>
              <span style={{ flex: '1 1 260px', fontWeight: 700, fontSize: '0.9rem' }}>{item.title}</span>
              {item.impact && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success-text)' }}>{item.impact}</span>}
              <span aria-hidden="true" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isOpen ? 'Hide' : 'More'}</span>
            </button>
            {isOpen && <p style={{ margin: 0, padding: '0 0.9rem 0.75rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{item.desc}</p>}
          </div>
        );
      })}
    </InsightPanel>
  );
};
```

`hosting/src/components/tabs/CroBriefTab.tsx`:
```tsx
import React from 'react';
import type { Recommendation, Region, RiskDeal, TwentyQuestionsData } from '@/lib/types';
import { Interventions } from '@/components/cro/Interventions';
import { ActionList } from '@/components/cro/ActionList';
import { CroQuestionsGrid } from '@/components/cro/CroQuestionsGrid';

interface Props {
  twentyQuestions?: TwentyQuestionsData;
  recommendations: Recommendation[];
  region: Region;
  deals: RiskDeal[];
  isLive?: boolean;
}

/** What do I need to push on this week? */
export const CroBriefTab: React.FC<Props> = ({ twentyQuestions, recommendations, region, deals, isLive }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
    <Interventions data={twentyQuestions} region={region} deals={deals} isLive={isLive} />
    <ActionList items={recommendations} />
    <CroQuestionsGrid data={twentyQuestions} region={region} isLive={isLive} />
  </div>
);
```

**Step 5: Wire it in and delete Recommendations**

In `App.tsx`, import `CroBriefTab`, then replace the `case 'cro':` block with:
```tsx
case 'cro':
  return <CroBriefTab twentyQuestions={twentyQuestions} recommendations={data.recommendations} region={view.region} deals={regionDeals} isLive={isLive} />;
```
Remove the `Recommendations` and `TwentyQuestions` imports. Then:
```bash
git rm src/components/dashboard/Recommendations.tsx src/components/dashboard/Recommendations.test.tsx
grep -rn "TwentyQuestions\b\|Recommendations\b" src --include=*.tsx | grep -v "lib/types"
```
Expected: no component references remain.

**Step 6: Run everything.** Run: `npx vitest run && npx tsc --noEmit` → PASS.

**Step 7: Commit**
```bash
git add src/lib/croQuestions.ts src/lib/croQuestions.test.ts src/components/cro src/components/tabs/CroBriefTab.tsx src/App.tsx
git commit -m "feat(hosting): CRO Brief tab (interventions, actions, question cards)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 19: Competition & Change tab

**Files:**
- Create: `hosting/src/lib/competitors.ts` + `competitors.test.ts`
- Create: `hosting/src/components/competition/WhatChanged.tsx` + `WhatChanged.test.tsx`
- Create: `hosting/src/components/competition/CompetitorCards.tsx`
- Modify: `hosting/src/components/dashboard/DeltaIntelligence.tsx` (`hideSummary` prop)
- Modify: `hosting/src/components/dashboard/DeltaIntelligence.test.tsx`
- Create: `hosting/src/components/tabs/CompetitionTab.tsx`
- Modify: `hosting/src/App.tsx` (comp case)

**Step 1: Write the failing tests**

`competitors.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildCompetitorCards } from './competitors';

const threats = [
  { competitor: 'JobLogic', region: 'UK', affectedDeals: 3, mrrAtRisk: '$12K', displacementPattern: 'Undercuts on price' },
  { competitor: 'joblogic ', region: 'North America', affectedDeals: 1, mrrAtRisk: '$2K', displacementPattern: 'x' },
  { competitor: 'ServiceM8', region: 'AU', affectedDeals: 5, mrrAtRisk: '$4K', displacementPattern: 'Mobile-first' },
];
const losses = [{ region: 'UK', competitor: 'JobLogic', statedReason: 'Price', realMechanism: 'Bundled scheduling', counter: 'Lead with 3-year cost' }];

describe('buildCompetitorCards', () => {
  it('groups by competitor case-insensitively and sorts by value at risk', () => {
    const cards = buildCompetitorCards(threats, losses, 'all');
    expect(cards.map(c => c.name)).toEqual(['JobLogic', 'ServiceM8']);
    expect(cards[0]).toMatchObject({ deals: 4, value: 14_000, regions: ['UK', 'North America'], howTheyWin: 'Undercuts on price', counter: 'Lead with 3-year cost' });
  });

  it('filters to a region and tolerates prose in array slots', () => {
    expect(buildCompetitorCards(threats, 'Not available in source data.', 'au').map(c => c.name)).toEqual(['ServiceM8']);
  });
});
```

`WhatChanged.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DeltaIntelligenceData } from '@/lib/types';
import { WhatChanged } from './WhatChanged';

const delta: DeltaIntelligenceData = {
  comparedTo: '2026-10-11',
  pipelineTrajectory: { direction: 'declining', headline: 'Pipeline softening', pipelineMrrDelta: '-$12K', activeDealsChange: '', winRateChange: '', riskTrajectory: '' },
  significantDealChanges: {
    deteriorated: [
      { deal: 'Acme', rep: 'Jo', region: 'UK', change: 'Champion left' },
      { deal: 'Beta', rep: 'Sam', region: 'North America', change: 'Slipped' },
    ],
    improved: [{ deal: 'Gamma', rep: 'Jo', region: 'UK', change: 'Exec sponsor confirmed' }],
    newPipeline: { count: 6, totalMrr: '$20K', qualityAssessment: 'Mostly early stage' },
  },
  earlyWarnings: [{ signal: 'Three Commit deals have gone quiet', severity: 'critical', affectedMrr: '$30K', recommendedAction: 'Scrub Commit' }],
};

describe('WhatChanged', () => {
  it('leads with direction and the code-computed takeaway, filtered to the region', () => {
    render(<WhatChanged data={delta} region="uk" isLive />);
    expect(screen.getByText('DECLINING')).toBeInTheDocument();
    expect(screen.getByText('1 deal got worse and 1 improved. Biggest concern: Acme.')).toBeInTheDocument();
    expect(screen.getByText('Champion left')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.queryByText(/6 new deals/)).not.toBeInTheDocument(); // portfolio-wide, All only
    expect(screen.getByText('Three Commit deals have gone quiet')).toBeInTheDocument();
  });

  it('shows new pipeline for All regions', () => {
    render(<WhatChanged data={delta} region="all" isLive />);
    expect(screen.getByText(/6 new deals · \$20K/)).toBeInTheDocument();
  });

  it('says when the comparison was not generated', () => {
    render(<WhatChanged data={undefined} region="all" isLive />);
    expect(screen.getByText('Not generated for this run')).toBeInTheDocument();
  });
});
```

Append to `DeltaIntelligence.test.tsx`:
```tsx
describe('DeltaIntelligence hideSummary', () => {
  it('leaves the trajectory, deal changes and warnings to WhatChanged', () => {
    render(<DeltaIntelligence data={malformed} hideSummary />);
    expect(screen.queryByText('Pipeline softening')).not.toBeInTheDocument();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  });
});
```

**Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/competitors.test.ts src/components/competition src/components/dashboard/DeltaIntelligence.test.tsx` → FAIL.

**Step 3: Write the implementation**

`hosting/src/lib/competitors.ts`:
```ts
import type { LossMechanism, Region, TQThreatRow } from './types';
import { asArray } from './guards';
import { parseMoney } from './format';
import { normalizeRegionKey, regionLabel } from './regions';

export interface CompetitorCard {
  name: string;
  deals: number;
  value: number;
  regions: string[];
  howTheyWin?: string;
  counter?: string;
}

/**
 * One card per competitor, from CRO question 6 threats (active pipeline) and
 * competitive-displacement loss mechanisms. Deal counts and values are summed
 * here, not taken from prose.
 */
export function buildCompetitorCards(threatsRaw: unknown, lossesRaw: unknown, region: Region): CompetitorCard[] {
  const inView = (r?: string) => region === 'all' || normalizeRegionKey(r) === region;
  const cards = new Map<string, CompetitorCard>();
  const cardFor = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!cards.has(key)) cards.set(key, { name: name.trim(), deals: 0, value: 0, regions: [] });
    return cards.get(key)!;
  };
  const addRegion = (card: CompetitorCard, r?: string) => {
    if (!r) return;
    const label = regionLabel(r);
    if (!card.regions.includes(label)) card.regions.push(label);
  };

  for (const t of asArray<TQThreatRow>(threatsRaw)) {
    if (!t?.competitor || !inView(t.region)) continue;
    const card = cardFor(t.competitor);
    card.deals += Number(t.affectedDeals) || 0;
    card.value += parseMoney(t.mrrAtRisk);
    addRegion(card, t.region);
    if (!card.howTheyWin && t.displacementPattern) card.howTheyWin = t.displacementPattern;
  }
  for (const l of asArray<LossMechanism>(lossesRaw)) {
    if (!l?.competitor || !inView(l.region)) continue;
    const card = cardFor(l.competitor);
    addRegion(card, l.region);
    if (!card.howTheyWin && l.realMechanism) card.howTheyWin = l.realMechanism;
    if (!card.counter && l.counter) card.counter = l.counter;
  }
  return [...cards.values()].sort((a, b) => b.value - a.value || b.deals - a.deals);
}
```

`hosting/src/components/competition/WhatChanged.tsx`:
```tsx
import React from 'react';
import type { DeltaDeal, DeltaIntelligenceData, EarlyWarning, Region } from '@/lib/types';
import { asArray, isRecord } from '@/lib/guards';
import { formatDate } from '@/lib/format';
import { normalizeRegionKey, regionLabel } from '@/lib/regions';
import { changeTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { NotGeneratedPanel } from '@/components/dashboard/NotGeneratedPanel';
import { smallCaps } from '@/components/ui/tone';

const DIRECTION: Record<string, { label: string; bg: string; color: string }> = {
  improving: { label: 'IMPROVING', bg: 'var(--success-subtle)', color: 'var(--success-text)' },
  stable: { label: 'STABLE', bg: 'var(--warning-subtle)', color: 'var(--warning-text)' },
  declining: { label: 'DECLINING', bg: 'var(--error-subtle)', color: 'var(--error-text)' },
};
const SEVERITY_COLOR: Record<string, string> = { critical: 'var(--error-text)', important: 'var(--warning-text)', watch: 'var(--text-muted)' };

const DealList: React.FC<{ title: string; color: string; textColor: string; deals: DeltaDeal[]; empty: string; children?: React.ReactNode }> = ({ title, color, textColor, deals, empty, children }) => (
  <div style={{ border: '1px solid var(--border)', borderTop: `4px solid ${color}`, borderRadius: 10, padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
    <span style={{ fontWeight: 800, color: textColor }}>{title}</span>
    {children}
    {deals.length === 0 && !children && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{empty}</span>}
    {deals.map((d, i) => (
      <div key={`${d.deal}-${i}`} style={{ padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700 }}>{d.deal}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{d.change}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{[d.rep, regionLabel(d.region), d.mrr].filter(Boolean).join(' · ')}</div>
      </div>
    ))}
  </div>
);

interface Props {
  data?: DeltaIntelligenceData;
  region: Region;
  isLive?: boolean;
}

/** What moved since the last run? Counts are from the delta rows; the headline is the AI's (global). */
export const WhatChanged: React.FC<Props> = ({ data, region, isLive }) => {
  const changes = isRecord(data?.significantDealChanges) ? data.significantDealChanges : undefined;
  const trajectory = isRecord(data?.pipelineTrajectory) ? data.pipelineTrajectory : undefined;
  const warnings = asArray<EarlyWarning>(data?.earlyWarnings);
  if (!data || (!changes && !trajectory && !warnings.length)) {
    return isLive ? <NotGeneratedPanel title="What changed" /> : null;
  }

  const inView = (d: DeltaDeal) => region === 'all' || normalizeRegionKey(d?.region) === region;
  const worse = asArray<DeltaDeal>(changes?.deteriorated).filter(inView);
  const better = asArray<DeltaDeal>(changes?.improved).filter(inView);
  const exited = isRecord(changes?.exited) ? changes.exited : undefined;
  const exitedDeals = [
    ...asArray<DeltaDeal>(exited?.closedWon).filter(inView).map(d => ({ ...d, change: `Closed won. ${d.change ?? ''}`.trim() })),
    ...asArray<DeltaDeal>(exited?.closedLost).filter(inView).map(d => ({ ...d, change: `Closed lost. ${d.change ?? ''}`.trim() })),
    ...asArray<DeltaDeal>(exited?.goneDark).filter(inView).map(d => ({ ...d, change: `Gone dark. ${d.change ?? ''}`.trim() })),
  ];
  const newPipeline = region === 'all' && isRecord(changes?.newPipeline) ? changes.newPipeline : undefined;
  const direction = trajectory?.direction ? DIRECTION[trajectory.direction] : undefined;
  const since = data.comparedTo ? ` since ${formatDate(data.comparedTo)}` : '';

  return (
    <InsightPanel
      label={`What changed${since}`}
      question="What moved since the last run?"
      takeaway={changeTakeaway(worse, better)}
      note={region !== 'all' && trajectory?.headline ? 'The headline and warnings below cover all regions.' : undefined}
      action={direction && (
        <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 6, background: direction.bg, color: direction.color }}>
          {direction.label}
        </span>
      )}
    >
      {trajectory?.headline && <p style={{ margin: 0, fontWeight: 600 }}>{trajectory.headline}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '0.85rem' }}>
        <DealList title={`↓ Got worse (${worse.length})`} color="var(--prism-red)" textColor="var(--error-text)" deals={worse} empty="Nothing got worse in this view." />
        <DealList title={`↑ Improved (${better.length})`} color="var(--prism-green)" textColor="var(--success-text)" deals={better} empty="Nothing improved in this view." />
        <DealList title={`New & exited (${(newPipeline ? 1 : 0) + exitedDeals.length})`} color="var(--prism-blue)" textColor="var(--text-primary)" deals={exitedDeals} empty="No new or exited deals in this view.">
          {newPipeline && typeof newPipeline.count === 'number' && (
            <div style={{ padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700 }}>{newPipeline.count} new deals · {newPipeline.totalMrr}</div>
              {newPipeline.qualityAssessment && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{newPipeline.qualityAssessment}</div>}
            </div>
          )}
        </DealList>
      </div>
      {warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={smallCaps}>Early warnings</span>
          {warnings.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ flex: '0 0 84px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: SEVERITY_COLOR[w.severity] ?? 'var(--text-muted)' }}>{w.severity}</span>
              <span style={{ flex: '1 1 260px' }}>{w.signal}</span>
              {w.recommendedAction && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{w.recommendedAction}</span>}
            </div>
          ))}
        </div>
      )}
    </InsightPanel>
  );
};
```

`hosting/src/components/competition/CompetitorCards.tsx`:
```tsx
import React from 'react';
import type { CompetitorCard } from '@/lib/competitors';
import { formatCurrency } from '@/lib/format';
import { plural } from '@/lib/takeaways';

export const CompetitorCards: React.FC<{ cards: CompetitorCard[] }> = ({ cards }) => {
  if (!cards.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.85rem' }}>
      {cards.map(card => (
        <article key={card.name} aria-label={card.name} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '1rem', fontWeight: 800 }}>{card.name}</span>
          <span style={{ fontWeight: 700, color: 'var(--error-text)' }}>
            {plural(card.deals, 'deal')}{card.value > 0 ? ` · ${formatCurrency(card.value)} at risk` : ''}
          </span>
          {card.regions.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.regions.join(' · ')}</span>}
          {card.howTheyWin && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>How they win:</strong> {card.howTheyWin}</span>}
          {card.counter && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>Counter-play:</strong> {card.counter}</span>}
        </article>
      ))}
    </div>
  );
};
```

`DeltaIntelligence.tsx`:
- Change the props to `interface Props { data?: DeltaIntelligenceData; isLive?: boolean; /** WhatChanged already shows trajectory, deal changes and warnings. */ hideSummary?: boolean; }` and destructure `hideSummary`.
- Replace `const hasContent = trajectory || earlyWarnings.length || forecastDrift;` with:
  ```ts
  const hasContent = hideSummary
    ? forecastDrift || regionalTrajectory.length > 0 || momentum
    : trajectory || earlyWarnings.length || forecastDrift;
  ```
- Replace `return isLive ? <NotGeneratedPanel title="Delta Intelligence" /> : null;` with `return isLive && !hideSummary ? <NotGeneratedPanel title="Delta Intelligence" /> : null;`.
- Guard the three summary blocks:
  - `{trajectory && (` → `{!hideSummary && trajectory && (`
  - `{dealChanges && (` → `{!hideSummary && dealChanges && (`
  - `{earlyWarnings.length > 0 && (` → `{!hideSummary && earlyWarnings.length > 0 && (`

`hosting/src/components/tabs/CompetitionTab.tsx`:
```tsx
import React, { useMemo } from 'react';
import type { CompetitiveDisplacementData, DeltaIntelligenceData, Region, TwentyQuestionsData } from '@/lib/types';
import { buildCompetitorCards } from '@/lib/competitors';
import { competitorTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { WhatChanged } from '@/components/competition/WhatChanged';
import { CompetitorCards } from '@/components/competition/CompetitorCards';
import { DeltaIntelligence } from '@/components/dashboard/DeltaIntelligence';
import { CompetitiveDisplacement } from '@/components/dashboard/CompetitiveDisplacement';

interface Props {
  delta?: DeltaIntelligenceData;
  displacement?: CompetitiveDisplacementData;
  twentyQuestions?: TwentyQuestionsData;
  region: Region;
  isLive?: boolean;
}

const disclosure: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem 1.1rem', background: 'var(--bg-surface)' };
const summary: React.CSSProperties = { cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', minHeight: 32 };

/** What moved, and who are we up against? The full AI analyses stay one click away. */
export const CompetitionTab: React.FC<Props> = ({ delta, displacement, twentyQuestions, region, isLive }) => {
  const cards = useMemo(
    () => buildCompetitorCards(twentyQuestions?.question6?.threats, displacement?.lossMechanisms, region),
    [twentyQuestions, displacement, region],
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <WhatChanged data={delta} region={region} isLive={isLive} />
      <details style={disclosure}>
        <summary style={summary}>More change detail: forecast drift, regional trajectory, competitor momentum</summary>
        <div style={{ marginTop: '1rem' }}><DeltaIntelligence data={delta} isLive={isLive} hideSummary /></div>
      </details>
      <InsightPanel label="Competition" question="Who are we up against, and where?" takeaway={competitorTakeaway(cards)}>
        <CompetitorCards cards={cards} />
      </InsightPanel>
      <details style={disclosure}>
        <summary style={summary}>Full competitive analysis: win mechanisms, regional arbitrage, re-warm opportunities</summary>
        <div style={{ marginTop: '1rem' }}><CompetitiveDisplacement data={displacement} isLive={isLive} /></div>
      </details>
    </div>
  );
};
```

**Step 4: Wire it in**

In `App.tsx`, import `CompetitionTab`, then replace the `case 'comp':` block with:
```tsx
case 'comp':
  return <CompetitionTab delta={deltaIntelligence} displacement={competitiveDisplacement} twentyQuestions={twentyQuestions} region={view.region} isLive={isLive} />;
```
Remove the `DeltaIntelligence` and `CompetitiveDisplacement` imports from `App.tsx`.

**Step 5: Run everything.** Run: `npx vitest run && npx tsc --noEmit` → PASS.

**Step 6: Commit**
```bash
git add src/lib/competitors.ts src/lib/competitors.test.ts src/components/competition src/components/dashboard/DeltaIntelligence.tsx src/components/dashboard/DeltaIntelligence.test.tsx src/components/tabs/CompetitionTab.tsx src/App.tsx
git commit -m "feat(hosting): Competition & Change tab (what changed, competitor cards)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 20: Clean-up, docs and full verification

**Files:**
- Modify: `hosting/src/App.tsx` (remove leftovers)
- Modify: `CLAUDE.md` (repo root)

**Step 1: Remove leftovers**

In `App.tsx`, delete anything no longer referenced, such as the `grid`/`stack` constants and the `regionLabel` import. Then run:
```bash
grep -rn "RegionTabs\|StatsRow\|RiskRadar\|useDealReviews\|Recommendations'\|TwentyQuestions'" src
```
Expected: no matches.

**Step 2: Update `CLAUDE.md`** (repo root, "Frontend (hosting)" and related sections)

- **`src/App.tsx` description:** replace the long top-to-bottom layout description with:
  - Header + UploadModal, PrismBar, sticky `DashboardNav` (one region selector + tabs), then one tab panel.
  - Tabs, in order: **Overview** (changes strip, collapsible briefing, KPI tiles, RiskMap, drivers radar + confidence gauge, review queue, region cards), **CRO Brief** (Q10 interventions, actions, Q1–9 cards), **Deals** (filters, rep summary, deal cards), **Pipeline Health** (stage, activity, forecast, funnel, rep heatmap; all drill into Deals), **Competition & Change** (what changed, competitor cards, full analyses in disclosures).
  - Tab, region and Deals filters live in the URL hash via `useDashboardView`.
- **Hooks:** add `useDashboardView.ts` and `useSharedReviews.ts`; remove `useDealReviews.ts`; note that `useRegion(region)` now takes the region.
- **Components:** list the new folders:
  - `tabs/`
  - `overview/`
  - `deals/`
  - `cro/`
  - `competition/`
  - `charts/` (RiskMap, RiskDriversRadar, ConfidenceGauge)
  - `reviews/` (ReviewsContext, ReviewButton)
  - `ui/InsightPanel` + `ui/tone`

  Remove RiskRadar, RegionTabs, StatsRow, Recommendations and TwentyQuestions from the widget list.
- **Lib:** add `dealMetrics`, `dealFilters`, `takeaways` (all panel takeaways computed in code), `dashboardView`, `reviews`, `croQuestions`, `competitors`, `exportCsv` and `schedule`.
- **Firestore Collections:** add `/dealReviews/{dealKey}`, shared deal reviews `{reviewedBy, reviewedByName, reviewedAt, riskAtReview}`.
- **Key Conventions:**
  - Amend "writes from the client are always denied" to: "…except `/dealReviews`, which allowlisted users may write under a narrow rule (own email, server timestamp, fixed fields). Rule tests: `cd hosting && npm run test:rules` (Firestore emulator)."
  - Add: "The app opens in light mode; dark mode is opt-in via the header toggle and remembered per browser."

**Step 3: Full verification**

Run each, and read the output before moving on:
```bash
cd hosting
npx vitest run          # expect: all green, test count well above the 111 baseline
npx tsc --noEmit        # expect: no output
npm run build           # expect: dist/ built, no errors
npm run test:rules      # expect: 8 rule tests pass against the emulator
```

**Step 4: Manual check against the emulators**

From the repo root:
1. Run `cd functions && npm run build`, then `npm run serve`.
2. In a second terminal: `cd hosting && npm run dev`.
3. Sign in with an allowlisted emulator account and upload `test-data/sample-opportunities.csv`.

Check each of these and note anything off:
- The app opens in **light** mode, even with macOS set to dark. Toggling to dark persists after reload.
- All five tabs render in light **and** dark, with no unreadable text on tinted backgrounds.
- At phone width (DevTools, 390px) there's no horizontal page scroll, and the nav wraps.
- Region selector:
  - Pick UK, then visit every tab: everything narrows.
  - Reload: UK is remembered.
  - Copy the URL into a private window: the same view opens.
- Overview click-throughs:
  - KPI tiles land on Deals with the right filter chip.
  - Bubbles open the deal popup.
  - Region cards toggle the region.
- Pipeline Health: stage bars, activity buckets and rep rows each open Deals filtered.
- Browser back returns to the previous tab or filter.
- Shared reviews:
  - Mark a deal reviewed in one browser profile; it shows "✓ Reviewed · <name>" in a second profile without a reload.
  - Un-tick it in the second profile.

**Step 5: Commit**
```bash
cd ..
git add CLAUDE.md hosting/src/App.tsx
git commit -m "docs: describe the tabbed dashboard, shared reviews and new modules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Step 6: Stop and report.** Do **not** push or deploy. Report to the user:
- test, build and rule-test results
- anything from the manual check
- the deliberate drops: the "Risk distribution by pipeline value" bar and the "Risk driver ranking" list

Pushing and deploying follow the user's rollout steps: deploy and merge `fix/briefing-figures-in-code` first, then push this branch as `bptowers`, run `firebase deploy --only hosting,firestore:rules` as `brad.towers@simprogroup.com`, verify in production, and merge.
