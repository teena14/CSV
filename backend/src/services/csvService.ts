import { parse } from 'csv-parse/sync';

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse a CSV buffer into headers + rows.
 * Handles: BOM, quoted fields, mixed line endings, empty rows.
 */
export function parseCSV(buffer: Buffer): ParsedCSV {
  // Strip UTF-8 BOM if present
  const raw = buffer.toString('utf-8').replace(/^\uFEFF/, '');

  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
    cast: false,
  }) as Record<string, string>[];

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  // Extract headers from the first parsed record keys
  const headers = Object.keys(records[0]);

  // Normalize all values to strings
  const rows = records.map((record) => {
    const normalized: Record<string, string> = {};
    for (const key of headers) {
      normalized[key] = record[key] != null ? String(record[key]).trim() : '';
    }
    return normalized;
  });

  return { headers, rows };
}

/**
 * Split rows into batches of a given size.
 */
export function batchRows<T>(rows: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }
  return batches;
}
