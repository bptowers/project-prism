import { describe, it, expect } from 'vitest';
import { parseCsvPreview } from './csvPreview';

describe('parseCsvPreview', () => {
  it('counts rows and columns and collects distinct regions', () => {
    const text = 'Opportunity Name,Region,Amount\nAcme,UK,100\nBeta,ANZ,200\nGamma,UK,300\n';
    expect(parseCsvPreview(text)).toEqual({
      rows: 3,
      columns: ['Opportunity Name', 'Region', 'Amount'],
      regions: ['UK', 'ANZ'],
    });
  });

  it('handles quoted fields containing commas and newlines', () => {
    const text = 'Account Name,Territory Region,Notes\n"Acme, Inc",NAMER,"line one\nline two"\n"Beta ""B"" Ltd",UK,ok\n';
    const preview = parseCsvPreview(text);
    expect(preview.rows).toBe(2);
    expect(preview.columns).toEqual(['Account Name', 'Territory Region', 'Notes']);
    expect(preview.regions).toEqual(['NAMER', 'UK']);
  });

  it('skips blank lines and Windows line endings', () => {
    const text = 'Name,Region\r\nAcme,UK\r\n\r\nBeta,AU\r\n';
    expect(parseCsvPreview(text).rows).toBe(2);
  });

  it('returns no regions when there is no region-like column', () => {
    const text = 'Name,Amount\nAcme,1\n';
    expect(parseCsvPreview(text).regions).toEqual([]);
  });

  it('throws on a file with no header row', () => {
    expect(() => parseCsvPreview('')).toThrow(/no header/i);
  });
});
