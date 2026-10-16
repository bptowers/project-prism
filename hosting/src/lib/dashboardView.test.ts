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

  it('reads a tab with no query string', () => {
    expect(parseHash('#cro')).toEqual({ tab: 'cro' });
  });

  it('does not throw on malformed percent-encoding', () => {
    expect(() => parseHash('#deals?rep=%E0%A4%A&stage=%&region=uk')).not.toThrow();
    expect(parseHash('#deals?rep=%E0%A4%A&region=uk')).toMatchObject({ tab: 'deals', region: 'uk' });
  });
});
