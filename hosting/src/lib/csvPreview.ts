import Papa from 'papaparse';

export interface CsvPreview {
  rows: number;
  columns: string[];
  regions: string[];
}

/**
 * Summarise a CSV for the upload preview using a real parser, so quoted
 * commas and embedded newlines (common in Salesforce notes fields) don't
 * inflate the row count or split columns.
 */
export function parseCsvPreview(text: string): CsvPreview {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const columns = (parsed.meta.fields ?? []).filter(Boolean);
  if (columns.length === 0) {
    throw new Error('CSV has no header row');
  }

  const rows = parsed.data;
  const regionCol = columns.find(h => /region/i.test(h));
  const regions: string[] = [];
  if (regionCol) {
    const seen = new Set<string>();
    for (const row of rows) {
      const value = (row[regionCol] ?? '').trim();
      if (value && !seen.has(value)) {
        seen.add(value);
        regions.push(value);
      }
    }
  }

  return { rows: rows.length, columns, regions };
}
