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

  it('sorts unknown stages by locale, not code point', () => {
    const deals = [makeDeal({ stage: 'Zebra Stage' }), makeDeal({ stage: 'apple stage' }), makeDeal({ stage: 'Discovery' })];
    expect(stagesIn(deals)).toEqual(['Discovery', 'apple stage', 'Zebra Stage']);
  });
});
