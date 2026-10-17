import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import { dealsToCsv, downloadDealsCsv } from './exportCsv';

const rowsOf = (csv: string) => csv.split('\r\n');

describe('dealsToCsv', () => {
  it('quotes every free-text field so commas and quotes survive', () => {
    const csv = dealsToCsv([makeDeal({ value: 'Acme, Inc "Renewal"', accountName: 'Acme', region: 'uk', summary: 'Went dark', action: 'Call' })]);
    const [header, row] = rowsOf(csv);
    expect(header.startsWith('Account Name,Opportunity Name,Region')).toBe(true);
    expect(row).toContain('"Acme, Inc ""Renewal"""');
    expect(row).toContain('"UK"');
  });

  it('ends rows with CRLF for Excel and starts without a BOM', () => {
    const csv = dealsToCsv([makeDeal(), makeDeal()]);
    expect(rowsOf(csv)).toHaveLength(3);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('keeps newlines inside a quoted cell', () => {
    const csv = dealsToCsv([makeDeal({ summary: 'Line one\nLine two' })]);
    expect(csv).toContain('"Line one\nLine two"');
  });

  it.each(['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd', ' =1+1'])(
    'neutralises a cell starting with a formula trigger: %j',
    (text) => {
      const csv = dealsToCsv([makeDeal({ value: text, accountName: text, rep: text, summary: text, action: text })]);
      const row = csv.slice(csv.indexOf('\r\n') + 2);
      const quoted = `"'${text.replace(/"/g, '""')}"`;
      // Account, opportunity, rep, summary and action all carry the leading apostrophe.
      expect(row.split(quoted)).toHaveLength(6);
    },
  );

  it('leaves ordinary text and finite numbers alone', () => {
    const csv = dealsToCsv([makeDeal({ value: 'Plain', level: 'HIGH', healthScore: 20, pipelineValue: 5000, daysStalled: 3, confidence: 60 })]);
    const row = rowsOf(csv)[1];
    expect(row).toContain('"Plain"');
    expect(row).toContain(',"HIGH",20,5000,3,60,');
  });

  it('quotes a non-numeric value that arrives in a numeric column', () => {
    const odd = makeDeal({ healthScore: undefined, confidence: '=1+1' as unknown as number, daysStalled: Number.NaN });
    const row = rowsOf(dealsToCsv([odd]))[1];
    // Health, value, days stalled, confidence.
    expect(row).toContain(`,"",10000,"NaN","'=1+1",`);
  });
});

describe('downloadDealsCsv', () => {
  const { createObjectURL, revokeObjectURL } = URL;
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
  });

  it('prefixes a BOM, clicks an attached link, then cleans up', async () => {
    vi.useFakeTimers();
    let blob: Blob | undefined;
    const create = vi.fn((b: Blob) => { blob = b; return 'blob:prism'; });
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    let attachedOnClick = false;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      attachedOnClick = document.body.contains(this);
    });

    downloadDealsCsv([makeDeal({ value: 'Acme' })], new Date('2026-10-17T12:00:00Z'));

    expect(attachedOnClick).toBe(true);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:prism');
    vi.useRealTimers();

    // jsdom's Blob has no arrayBuffer(); FileReader reads it.
    const buffer = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob!);
    });
    const bytes = new Uint8Array(buffer);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});
