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
    rejectedRecords: validation.rejected,
  };
}
