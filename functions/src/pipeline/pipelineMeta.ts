/**
 * Project Prism - Pipeline provenance metadata
 * Pure helper combining source telemetry (row cap) with validator rejections
 * into the PipelineMeta written to /executions/{id} and /reports/{date}.
 */

import { PipelineMeta, ValidationReport } from "../types.js";
import { FetchTelemetry } from "./bigquerySource.js";

/**
 * @param source  Fetch telemetry from a capped source (BigQuery), or undefined
 *                for uncapped sources such as CSV uploads.
 * @param validation  The single validation pass run over the fetched records.
 */
export function buildPipelineMeta(
  source: FetchTelemetry | undefined,
  validation: ValidationReport
): PipelineMeta {
  return {
    sourceTruncated: source?.truncated ?? false,
    sourceRowLimit: source?.rowLimit ?? null,
    sourceRowCount: source?.rowCount ?? validation.totalRecords,
    rejectedCount: validation.rejected.length,
    rejectedRecords: validation.rejected,
  };
}

/**
 * Bounds rejectedRecords before a Firestore write. A CSV with a broken header
 * rejects every row, and thousands of entries would push a document past the
 * 1 MiB limit. rejectedCount keeps the true total. Returns the same object
 * when nothing needs capping; never mutates the input.
 */
export function capRejectedRecords(
  meta: PipelineMeta | undefined,
  maxEntries: number
): PipelineMeta | undefined {
  if (!meta || meta.rejectedRecords.length <= maxEntries) return meta;
  return { ...meta, rejectedRecords: meta.rejectedRecords.slice(0, maxEntries) };
}
