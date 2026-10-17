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

  it('keeps newlines inside a quoted cell', () => {
    const csv = dealsToCsv([makeDeal({ summary: 'Line one\nLine two' })]);
    expect(csv).toContain('"Line one\nLine two"');
  });

  it.each(['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'neutralises a cell starting with a formula trigger: %j',
    (text) => {
      const csv = dealsToCsv([makeDeal({ value: text, accountName: text, rep: text, summary: text, action: text })]);
      const row = csv.slice(csv.indexOf('\n') + 1);
      const quoted = `"'${text.replace(/"/g, '""')}"`;
      // Account, opportunity, rep, summary and action all carry the leading apostrophe.
      expect(row.split(quoted)).toHaveLength(6);
    },
  );

  it('leaves ordinary text and numeric columns alone', () => {
    const csv = dealsToCsv([makeDeal({ value: 'Plain', level: 'HIGH', healthScore: 20, pipelineValue: 5000, daysStalled: 3, confidence: 60 })]);
    const row = csv.split('\n')[1];
    expect(row).toContain('"Plain"');
    expect(row).toContain(',HIGH,20,5000,3,60,');
  });
});
