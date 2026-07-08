/**
 * Project Prism - Firebase Cloud Functions Entry Point
 * Defines all Cloud Functions and orchestrates the complete pipeline
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { Storage } from "@google-cloud/storage";
import { Analyzer } from "./analysis/analyzer.js";
import { Aggregator } from "./analysis/aggregator.js";
import { CSVParser, getDefaultSalesforceMapping, getDefaultRegionMapping } from "./pipeline/csvParser.js";
import { BigQuerySource, getBigQueryConfig } from "./pipeline/bigquerySource.js";
import { DataValidator } from "./pipeline/validator.js";
import { ReportTransformer } from "./transforms/reportTransformer.js";
import {
  AggregatedReport,
  ExecutionContext,
  LLMConfig,
  OpportunityRecord,
} from "./types.js";

// Initialize Firebase Admin
admin.initializeApp();

// ISO date format validator for sinceDate parameter
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Max CSV payload size (10 MB) to prevent runaway LLM cost from huge uploads
const MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Verifies a Firebase ID token from the Authorization header.
 * Returns true and proceeds if valid; sends 401/403 and returns false if not.
 */
async function requireAuth(req: ExpressRequest, res: ExpressResponse): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  try {
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);
    return true;
  } catch {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
}

/**
 * Sanitizes a user-supplied filename for use as a Cloud Storage object name.
 * Returns null if the filename is invalid.
 */
function sanitizeFilename(raw: string): string | null {
  const name = raw.replace(/[/\\]/g, "").replace(/\.\./g, "").trim();
  if (!/^[\w\-. ]{1,128}\.csv$/i.test(name)) return null;
  return name;
}
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
const storage = new Storage();

/**
 * Configuration - typically loaded from environment variables or Firestore
 */
function getLLMConfig(providerOverride?: string): LLMConfig {
  const provider = providerOverride || process.env.LLM_PROVIDER || "claude";

  // Pick the right API key for the selected provider.
  // Falls back to ANTHROPIC_API_KEY / LLM_API_KEY so existing Claude deploys
  // keep working with zero config changes.
  let apiKey: string;
  if (provider === "openai") {
    apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "";
  } else if (provider === "gemini") {
    apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "";
  } else {
    apiKey = process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY || "";
  }

  if (!apiKey) {
    throw new Error(`API key not set for provider "${provider}". Add the secret in Firebase Console.`);
  }

  // Per-provider default models. Provider-specific env vars (e.g. GEMINI_MODEL)
  // take priority, then the generic LLM_MODEL (only if it matches the provider),
  // then the hardcoded default.
  const defaultModels: Record<string, string> = {
    openai: process.env.OPENAI_MODEL || "gpt-4o",
    gemini: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    claude: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
  };

  // Only use the generic LLM_MODEL if no provider override was requested
  // (i.e., it's the default provider from env, not a per-upload selection)
  const model = providerOverride
    ? defaultModels[provider] || "gemini-2.5-flash"
    : process.env.LLM_MODEL || defaultModels[provider] || "claude-sonnet-4-6";

  // 8192 default for all providers: the enrichment-phase JSON outputs
  // (Twenty Questions especially) routinely exceed 2000 output tokens and
  // truncated JSON silently fails the phase.
  const maxTokens = parseInt(process.env.LLM_MAX_TOKENS || "8192", 10);

  return {
    provider: provider as "claude" | "gemini" | "openai",
    model,
    apiKey,
    temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.3"),
    maxTokens,
    topP: parseFloat(process.env.LLM_TOP_P || "0.9"),
  };
}

/**
 * Creates execution context for tracking pipeline progress
 */
function createExecutionContext(jobType: ExecutionContext["jobType"], sourceFile?: string): ExecutionContext {
  return {
    executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    startTime: new Date(),
    jobType,
    sourceFile,
    recordsProcessed: 0,
    recordsSuccessful: 0,
    recordsFailed: 0,
    status: "running",
    errors: [],
  };
}

/**
 * Cloud Storage trigger: Processes CSV uploads
 * Function: onCSVUpload
 * Trigger: gs://project-prism-uploads/
 */
export const onCSVUpload = onObjectFinalized(
  { bucket: "project-prism-489108-a9e2b.firebasestorage.app", region: "us-east1", timeoutSeconds: 540, memory: "1GiB", secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] },
  async (event) => {
    const filePath = event.data.name;
    const bucketName = event.data.bucket;

    if (!filePath || !filePath.startsWith("uploads/") || !filePath.endsWith(".csv")) {
      console.log(`Skipping non-CSV file: ${filePath}`);
      return;
    }

    const context = createExecutionContext("csv-upload", filePath);

    // Read provider from Storage object metadata (set by the upload modal).
    // Falls back to LLM_PROVIDER env var so the scheduled job and direct uploads keep working.
    const selectedProvider = event.data.metadata?.provider;
    console.log(`[${context.executionId}] CSV upload detected: ${filePath} | provider: ${selectedProvider || "env default"}`);

    try {
      // Read CSV from Cloud Storage
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);
      const [csvContent] = await file.download();
      const csvText = csvContent.toString("utf-8");

      // Parse CSV
      const parser = new CSVParser(
        getDefaultSalesforceMapping(),
        getDefaultRegionMapping()
      );
      const records = parser.parse(csvText);

      console.log(
        `[${context.executionId}] Parsed ${records.length} records from CSV`
      );

      // Compute funnel stages from raw CSV
      const funnelStages = CSVParser.calculateFunnel(records);

      // Run full pipeline with the provider selected in the upload modal (or env default)
      const report = await runAnalysisPipeline(
        records,
        context,
        getLLMConfig(selectedProvider)
      );

      // Add funnel stages from CSV data
      report.funnelStages = funnelStages;

      // Compute per-region funnel stages
      for (const [regionKey, regionReport] of Object.entries(report.regions)) {
        const regionRecords = records.filter(r => r.region === regionKey);
        regionReport.stageDistribution = CSVParser.calculateFunnel(regionRecords);
      }

      // Transform for frontend consumption (without LLM enrichment first)
      const transformed = ReportTransformer.transform(report);

      // Store base report in Firestore immediately so dashboard gets data.
      // Use merge:true so a previous executiveBriefing from an earlier run today
      // is preserved while Phase 2 enrichment runs (prevents "flash to sample" on dashboard).
      const reportDate = new Date().toISOString().split("T")[0];
      const reportRef = db.collection("reports").doc(reportDate);

      // Write all deals to subcollection BEFORE trimming (full uncapped set)
      const allDealsForSubcollection = ((transformed as unknown as Record<string, { risks?: Record<string, unknown>[] }>)['all']?.risks || []);
      await writeDealsSubcollection(reportDate, allDealsForSubcollection);

      const trimmedTransformed = trimTransformedForStorage(transformed as unknown as Record<string, unknown>);
      const docPayloadInitial = {
        ...trimReportForStorage(report),
        transformed: trimmedTransformed,
        reportDate: report.reportDate,
        createdAt: FieldValue.serverTimestamp(),
      };
      logDocSize(context.executionId, "initial", docPayloadInitial);
      await reportRef.set(docPayloadInitial, { merge: true });

      console.log(
        `[${context.executionId}] Report stored: ${report.reportId}`
      );

      // Try LLM enrichment as a follow-up (portfolio analysis, recommendations)
      try {
        const llmConfig = getLLMConfig(selectedProvider);
        let enrichedReport = await Aggregator.enrichWithLLM(report, llmConfig);
        console.log(
          `[${context.executionId}] Phase 2 enrichment complete: Portfolio Analysis`
        );

        // Phase 3–5: Twenty Questions, Competitive Displacement, Delta Intelligence
        enrichedReport = await runAdvancedEnrichment(enrichedReport, llmConfig, context.executionId);

        enrichedReport.funnelStages = funnelStages;
        const enrichedTransformed = ReportTransformer.transform(enrichedReport);
        const trimmedEnrichedTransformed = trimTransformedForStorage(enrichedTransformed as unknown as Record<string, unknown>);
        const docPayloadEnriched = {
          ...trimReportForStorage(enrichedReport),
          transformed: trimmedEnrichedTransformed,
          enrichedAt: FieldValue.serverTimestamp(),
        };
        logDocSize(context.executionId, "enriched", docPayloadEnriched);
        await reportRef.update(docPayloadEnriched);
        console.log(
          `[${context.executionId}] All enrichment phases complete`
        );
      } catch (enrichErr) {
        console.warn(
          `[${context.executionId}] LLM enrichment skipped: ${String(enrichErr)}`
        );
      }

      // Update execution status
      context.status = "completed";
      await db
        .collection("executions")
        .doc(context.executionId)
        .set(context);
    } catch (error) {
      context.status = "failed";
      context.errors.push(`Pipeline error: ${String(error)}`);
      console.error(`[${context.executionId}] Pipeline error:`, error);

      await db
        .collection("executions")
        .doc(context.executionId)
        .set(context);
      throw error;
    }
  }
);

/**
 * Scheduled function: Runs weekly analysis
 * Trigger: Every Monday at 6:00 AM UTC
 */
export const runWeeklyAnalysis = onSchedule(
  { schedule: "0 6 */3 * *", timeZone: "UTC", timeoutSeconds: 1800, memory: "2GiB", secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] },
  async () => {
    const context = createExecutionContext("scheduled-bigquery", "bigquery");
    console.log(`[${context.executionId}] Scheduled BigQuery analysis started`);

    try {
      // Fetch records directly from BigQuery
      const bqConfig = getBigQueryConfig();
      const source = new BigQuerySource(bqConfig);
      const records = await source.fetchRecords();

      console.log(
        `[${context.executionId}] Fetched ${records.length} records from BigQuery`
      );

      if (records.length === 0) {
        console.log(`[${context.executionId}] No records found in BigQuery`);
        context.status = "completed";
        await db
          .collection("executions")
          .doc(context.executionId)
          .set(context);
        return;
      }

      // Calculate funnel stages
      const funnelStages = CSVParser.calculateFunnel(records);

      // Run existing pipeline (validate -> analyze -> aggregate)
      const report = await runAnalysisPipeline(records, context, getLLMConfig());
      report.funnelStages = funnelStages;

      // Compute per-region funnel stages
      for (const [regionKey, regionReport] of Object.entries(report.regions)) {
        const regionRecords = records.filter(r => r.region === regionKey);
        regionReport.stageDistribution = CSVParser.calculateFunnel(regionRecords);
      }

      // Transform and store (merge:true preserves existing data during enrichment gap)
      const transformed = ReportTransformer.transform(report);
      const reportDate = new Date().toISOString().split("T")[0];
      const reportRef = db.collection("reports").doc(reportDate);

      // Write all deals to subcollection BEFORE trimming (full uncapped set)
      const allDealsForSubcollection = ((transformed as unknown as Record<string, { risks?: Record<string, unknown>[] }>)['all']?.risks || []);
      await writeDealsSubcollection(reportDate, allDealsForSubcollection);

      const trimmedTransformed = trimTransformedForStorage(transformed as unknown as Record<string, unknown>);
      const docPayloadInitial = {
        ...trimReportForStorage(report),
        transformed: trimmedTransformed,
        reportDate: report.reportDate,
        createdAt: FieldValue.serverTimestamp(),
        dataSource: "bigquery",
      };
      logDocSize(context.executionId, "initial", docPayloadInitial);
      await reportRef.set(docPayloadInitial, { merge: true });

      console.log(
        `[${context.executionId}] Report stored: ${report.reportId}`
      );

      // Try LLM enrichment (non-fatal) — use same provider as Phase 1
      const scheduledLlmConfig = getLLMConfig();
      try {
        let enrichedReport = await Aggregator.enrichWithLLM(
          report,
          scheduledLlmConfig
        );
        console.log(
          `[${context.executionId}] Phase 2 enrichment complete: Portfolio Analysis`
        );

        // Phase 3–5: Twenty Questions, Competitive Displacement, Delta Intelligence
        enrichedReport = await runAdvancedEnrichment(enrichedReport, scheduledLlmConfig, context.executionId);

        enrichedReport.funnelStages = funnelStages;
        const enrichedTransformed = ReportTransformer.transform(enrichedReport);
        const trimmedEnrichedTransformed = trimTransformedForStorage(enrichedTransformed as unknown as Record<string, unknown>);
        const docPayloadEnriched = {
          ...trimReportForStorage(enrichedReport),
          transformed: trimmedEnrichedTransformed,
          enrichedAt: FieldValue.serverTimestamp(),
        };
        logDocSize(context.executionId, "enriched", docPayloadEnriched);
        await reportRef.update(docPayloadEnriched);
        console.log(
          `[${context.executionId}] All enrichment phases complete`
        );
      } catch (enrichErr) {
        console.warn(
          `[${context.executionId}] LLM enrichment skipped: ${String(enrichErr)}`
        );
      }

      context.status = "completed";
      await db
        .collection("executions")
        .doc(context.executionId)
        .set(context);
    } catch (error) {
      context.status = "failed";
      context.errors.push(`Scheduled analysis error: ${String(error)}`);
      console.error(`[${context.executionId}] Error:`, error);

      await db
        .collection("executions")
        .doc(context.executionId)
        .set(context);
      throw error;
    }
  }
);

/**
 * HTTP function: Returns the latest aggregated report
 * GET /getReport
 */
export const getReport = onRequest({ invoker: "public", secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] }, async (req, res) => {
  if (!await requireAuth(req, res)) return;
  try {
    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Try to fetch report for today
    let reportDoc = await db.collection("reports").doc(today).get();

    // If not found, get the most recent report
    if (!reportDoc.exists) {
      const snapshot = await db
        .collection("reports")
        .orderBy("reportDate", "desc")
        .limit(1)
        .get();

      if (snapshot.empty) {
        res.status(404).json({ error: "No reports found" });
        return;
      }

      reportDoc = snapshot.docs[0];
    }

    const report = reportDoc.data() as AggregatedReport;

    res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

/**
 * HTTP function: Returns report history (last 10 reports)
 * GET /getReportHistory
 */
export const getReportHistory = onRequest({ invoker: "public", secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] }, async (req, res) => {
  if (!await requireAuth(req, res)) return;
  try {
    const snapshot = await db
      .collection("reports")
      .orderBy("reportDate", "desc")
      .limit(10)
      .get();

    const reports = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as AggregatedReport),
    }));

    res.status(200).json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error("Error fetching report history:", error);
    res.status(500).json({ error: "Failed to fetch report history" });
  }
});

/**
 * HTTP function: Accepts CSV file upload via multipart form
 * POST /uploadCSV
 */
export const uploadCSV = onRequest({ invoker: "public", secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] }, async (req, res) => {
  if (!await requireAuth(req, res)) return;
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!req.body.csv) {
      res.status(400).json({ error: "CSV content required" });
      return;
    }

    const csvContent = req.body.csv;

    if (Buffer.byteLength(csvContent, "utf-8") > MAX_CSV_SIZE_BYTES) {
      res.status(413).json({ error: "CSV file too large. Maximum 10 MB." });
      return;
    }

    const rawFilename = req.body.filename;
    let filename: string;
    if (rawFilename) {
      const safe = sanitizeFilename(String(rawFilename));
      if (!safe) {
        res.status(400).json({ error: "Invalid filename. Use only letters, numbers, dashes, underscores, and spaces. Must end in .csv." });
        return;
      }
      filename = safe;
    } else {
      filename = `upload_${Date.now()}.csv`;
    }

    // Upload to Cloud Storage
    const bucket = storage.bucket("project-prism-489108-a9e2b.firebasestorage.app");
    const file = bucket.file(`uploads/${filename}`);

    await file.save(csvContent, {
      metadata: {
        contentType: "text/csv",
      },
    });

    console.log(`CSV uploaded: ${filename}`);

    res.status(200).json({
      success: true,
      message: "CSV uploaded successfully",
      filename,
    });
  } catch (error) {
    console.error("Error uploading CSV:", error);
    res.status(500).json({ error: "Failed to upload CSV" });
  }
});

/**
 * HTTP function: Fetches data from BigQuery and runs analysis pipeline
 * POST /fetchFromBigQuery
 * Optional body: { sinceDate: "2026-02-18" } for incremental pulls
 */
export const fetchFromBigQuery = onRequest(
  { invoker: "public", timeoutSeconds: 3600, memory: "1GiB", secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] },
  async (req, res) => {
    if (!await requireAuth(req, res)) return;
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const context = createExecutionContext("bigquery-fetch", "bigquery");
      console.log(`[${context.executionId}] BigQuery fetch initiated`);

      // Read BigQuery config from environment
      const bqConfig = getBigQueryConfig();
      if (req.body?.sinceDate !== undefined) {
        if (typeof req.body.sinceDate !== "string" || !ISO_DATE_RE.test(req.body.sinceDate)) {
          res.status(400).json({ error: "Invalid sinceDate. Expected format: YYYY-MM-DD" });
          return;
        }
        bqConfig.sinceDate = req.body.sinceDate;
      }

      // Fetch from BigQuery
      const source = new BigQuerySource(bqConfig);
      const records = await source.fetchRecords();

      console.log(
        `[${context.executionId}] Fetched ${records.length} records from BigQuery`
      );

      if (records.length === 0) {
        res.status(200).json({
          success: true,
          message: "No records found in BigQuery",
          recordCount: 0,
        });
        return;
      }

      // Calculate funnel stages
      const funnelStages = CSVParser.calculateFunnel(records);

      // Run existing pipeline (validate -> analyze -> aggregate)
      const report = await runAnalysisPipeline(records, context, getLLMConfig());
      report.funnelStages = funnelStages;

      // Compute per-region funnel stages
      for (const [regionKey, regionReport] of Object.entries(report.regions)) {
        const regionRecords = records.filter(r => r.region === regionKey);
        regionReport.stageDistribution = CSVParser.calculateFunnel(regionRecords);
      }

      // Transform and store (merge:true preserves existing executiveBriefing during Phase 2 gap)
      const transformed = ReportTransformer.transform(report);
      const reportDate = new Date().toISOString().split("T")[0];
      const reportRef = db.collection("reports").doc(reportDate);

      // Write all deals to subcollection BEFORE trimming (full uncapped set)
      const allDealsForSubcollection = ((transformed as unknown as Record<string, { risks?: Record<string, unknown>[] }>)['all']?.risks || []);
      await writeDealsSubcollection(reportDate, allDealsForSubcollection);

      const trimmedTransformed = trimTransformedForStorage(transformed as unknown as Record<string, unknown>);
      await reportRef.set({
        ...trimReportForStorage(report),
        transformed: trimmedTransformed,
        reportDate: report.reportDate,
        createdAt: FieldValue.serverTimestamp(),
        dataSource: "bigquery",
      }, { merge: true });

      console.log(
        `[${context.executionId}] Report stored: ${report.reportId}`
      );

      // Try LLM enrichment (non-fatal) — use same provider as Phase 1
      const bqLlmConfig = getLLMConfig();
      try {
        let enrichedReport = await Aggregator.enrichWithLLM(
          report,
          bqLlmConfig
        );
        console.log(
          `[${context.executionId}] Phase 2 enrichment complete: Portfolio Analysis`
        );

        // Phase 3–5: Twenty Questions, Competitive Displacement, Delta Intelligence
        enrichedReport = await runAdvancedEnrichment(enrichedReport, bqLlmConfig, context.executionId);

        enrichedReport.funnelStages = funnelStages;
        const enrichedTransformed = ReportTransformer.transform(enrichedReport);
        const trimmedEnrichedTransformed = trimTransformedForStorage(enrichedTransformed as unknown as Record<string, unknown>);
        await reportRef.update({
          ...trimReportForStorage(enrichedReport),
          transformed: trimmedEnrichedTransformed,
          enrichedAt: FieldValue.serverTimestamp(),
        });
        console.log(
          `[${context.executionId}] All enrichment phases complete`
        );
      } catch (enrichErr) {
        console.warn(
          `[${context.executionId}] LLM enrichment skipped: ${String(enrichErr)}`
        );
      }

      // Update execution status
      context.status = "completed";
      await db
        .collection("executions")
        .doc(context.executionId)
        .set(context);

      res.status(200).json({
        success: true,
        reportId: report.reportId,
        recordCount: records.length,
        reportDate,
      });
    } catch (error) {
      console.error("BigQuery fetch error:", error);
      res.status(500).json({ error: "BigQuery fetch failed" });
    }
  }
);

/**
 * Recursively caps array lengths and over-long strings inside a freeform JSON
 * payload. Used for the LLM enrichment objects (twentyQuestions,
 * competitiveDisplacement, deltaIntelligence) which are stored as
 * Record<string, unknown> and can balloon unpredictably.
 */
function capJsonSize<T>(value: T, maxArrayLen: number, maxStrLen: number): T {
  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayLen)
      .map((v) => capJsonSize(v, maxArrayLen, maxStrLen)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = capJsonSize(v, maxArrayLen, maxStrLen);
    }
    return out as unknown as T;
  }
  if (typeof value === "string" && value.length > maxStrLen) {
    return (value.slice(0, maxStrLen) + "…") as unknown as T;
  }
  return value;
}

/**
 * Writes all active deals to the Firestore deals subcollection at
 * /reports/{date}/deals/{opportunityId}. This removes the 50-deals-per-region
 * cap that was needed to keep the main document under 1 MiB.
 * Uses batched writes (max 500 ops per batch).
 */
async function writeDealsSubcollection(
  reportDate: string,
  deals: Array<Record<string, unknown>>
): Promise<void> {
  if (!deals.length) return;
  const BATCH_SIZE = 500;
  let written = 0;
  for (let i = 0; i < deals.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = deals.slice(i, i + BATCH_SIZE);
    for (const deal of chunk) {
      const dealId = String(deal.opportunityId || `deal-${deal.id ?? i + chunk.indexOf(deal)}`);
      const docRef = db.collection("reports").doc(reportDate).collection("deals").doc(dealId);
      batch.set(docRef, deal);
    }
    await batch.commit();
    written += chunk.length;
  }
  console.log(`[writeDealsSubcollection] wrote ${written} deals to /reports/${reportDate}/deals`);
}

/**
 * Trims unbounded arrays before writing to Firestore.
 * Firestore has a hard 1 MiB document limit. At 500+ records the LLM enrichment
 * payloads (twentyQuestions / competitiveDisplacement / deltaIntelligence) and
 * the per-region deal arrays can push the doc past 1 MiB. This caps them and
 * logs the resulting size so future runs are observable.
 */
function trimReportForStorage(report: AggregatedReport): AggregatedReport {
  const r = JSON.parse(JSON.stringify(report)) as AggregatedReport;

  const trimThemes = (themes: AggregatedReport["global"]["topWinThemes"]) =>
    themes.map((t) => ({ ...t, examples: (t.examples || []).slice(0, 5) }));

  const trimCompetitors = (competitors: AggregatedReport["global"]["topCompetitors"]) =>
    competitors.map((c) => ({ ...c, contexts: (c.contexts || []).slice(0, 5) }));

  r.global.topWinThemes = trimThemes(r.global.topWinThemes);
  r.global.topLossThemes = trimThemes(r.global.topLossThemes);
  r.global.topCompetitors = trimCompetitors(r.global.topCompetitors);
  r.global.emergingMarketSignals = (r.global.emergingMarketSignals || []).slice(0, 20);

  for (const region of Object.values(r.regions)) {
    region.topWinThemes = trimThemes(region.topWinThemes);
    region.topLossThemes = trimThemes(region.topLossThemes);
    region.competitorActivity = trimCompetitors(region.competitorActivity);
    region.marketSignals = (region.marketSignals || []).slice(0, 20);
    region.atRiskDeals = (region.atRiskDeals || [])
      .slice(0, 40)
      .map((d) => ({ ...d, signals: (d.signals || []).slice(0, 6) }));
    // Deals are written to the /reports/{date}/deals subcollection instead of
    // being embedded here. Clearing this avoids blowing the 1 MiB document limit.
    region.allActiveDeals = [];
  }

  // Cap LLM enrichment payloads — these are unstructured Record<string,unknown>
  // and the LLM occasionally emits long deal lists / verbose narratives.
  if (r.twentyQuestions) {
    r.twentyQuestions = capJsonSize(r.twentyQuestions, 12, 600);
  }
  if (r.competitiveDisplacement) {
    r.competitiveDisplacement = capJsonSize(r.competitiveDisplacement, 12, 600);
  }
  if (r.deltaIntelligence) {
    r.deltaIntelligence = capJsonSize(r.deltaIntelligence, 12, 600);
  }

  // Observability: emit the serialized size so we can diagnose future blowouts.
  const size = Buffer.byteLength(JSON.stringify(r), "utf8");
  console.log(
    `[trimReportForStorage] report size=${size} bytes (${(size / 1024).toFixed(1)} KiB) — Firestore limit is 1,048,576`
  );

  return r;
}

/**
 * The frontend `transformed` payload (Record<region, RegionData>) duplicates
 * deal data across the four region slices (all/na/uk/au), so it can easily add
 * 600+ KB to the Firestore doc. Strip the risks array entirely (deals are now
 * served from the /reports/{date}/deals subcollection) and cap other arrays.
 */
function trimTransformedForStorage(
  transformed: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [regionKey, regionData] of Object.entries(transformed)) {
    if (!regionData || typeof regionData !== "object") {
      out[regionKey] = regionData;
      continue;
    }
    // Strip risks — they are served from the deals subcollection at read time.
    // Cap all other arrays at 50 items and strings at 400 chars.
    const { risks: _risks, ...regionWithoutRisks } = regionData as Record<string, unknown>;
    out[regionKey] = { ...capJsonSize(regionWithoutRisks, 50, 400), risks: [] };
  }
  return out;
}

/**
 * Logs the size of the full Firestore payload (report + transformed + extras)
 * before write so blowouts are immediately diagnosable. Note: Firestore's
 * actual document size can be 2-3x the JSON byte count due to per-field
 * overhead in the underlying storage format, so we flag any payload over
 * ~350 KB JSON as a candidate for further trimming.
 */
function logDocSize(
  executionId: string,
  phase: "initial" | "enriched",
  payload: Record<string, unknown>
): void {
  // Strip server timestamp sentinels from the size measurement (they aren't
  // serializable but also contribute negligibly to actual stored size).
  const measurable: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v && typeof v === "object" && "_methodName" in v) continue;
    measurable[k] = v;
  }
  const jsonBytes = Buffer.byteLength(JSON.stringify(measurable), "utf8");
  console.log(
    `[docSize:${phase}] [${executionId}] json=${jsonBytes} bytes (${(jsonBytes / 1024).toFixed(1)} KiB) — Firestore actual size is typically 2-3× this; doc limit is 1,048,576 bytes`
  );
}

/**
 * Fetches the most recent previous report from Firestore for delta intelligence.
 * Returns null if no prior report exists (first run).
 */
async function fetchPreviousReport(): Promise<AggregatedReport | null> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const snapshot = await db
      .collection("reports")
      .orderBy("reportDate", "desc")
      .limit(2) // Get up to 2: today's (if exists) and the one before
      .get();

    if (snapshot.empty) return null;

    // Find the first report that isn't today's
    for (const doc of snapshot.docs) {
      if (doc.id !== today) {
        return doc.data() as AggregatedReport;
      }
    }
    return null;
  } catch (error) {
    console.warn("Could not fetch previous report for delta intelligence:", String(error));
    return null;
  }
}

/**
 * Runs Phase 3–5 enrichment passes on a report (non-fatal).
 * Phase 3: Pete's 20 Questions (CRO intelligence)
 * Phase 4: Competitive Displacement Intelligence
 * Phase 5: Delta Intelligence (temporal comparison)
 */
async function runAdvancedEnrichment(
  report: AggregatedReport,
  llmConfig: LLMConfig,
  executionId: string
): Promise<AggregatedReport> {
  // Phase 3: Twenty Questions
  try {
    report = await Aggregator.enrichWithTwentyQuestions(report, llmConfig);
    console.log(`[${executionId}] Phase 3 enrichment complete: Twenty Questions`);
  } catch (err) {
    console.warn(`[${executionId}] Phase 3 skipped (Twenty Questions): ${String(err)}`);
  }

  // Phase 4: Competitive Displacement
  try {
    report = await Aggregator.enrichWithCompetitiveDisplacement(report, llmConfig);
    console.log(`[${executionId}] Phase 4 enrichment complete: Competitive Displacement`);
  } catch (err) {
    console.warn(`[${executionId}] Phase 4 skipped (Competitive Displacement): ${String(err)}`);
  }

  // Phase 5: Delta Intelligence (requires previous report)
  try {
    const previousReport = await fetchPreviousReport();
    report = await Aggregator.enrichWithDeltaIntelligence(report, previousReport, llmConfig);
    console.log(`[${executionId}] Phase 5 enrichment complete: Delta Intelligence`);
  } catch (err) {
    console.warn(`[${executionId}] Phase 5 skipped (Delta Intelligence): ${String(err)}`);
  }

  return report;
}

/**
 * Main analysis pipeline orchestrator
 * Coordinates: Validation -> Analysis -> Aggregation -> Storage
 */
async function runAnalysisPipeline(
  records: OpportunityRecord[],
  context: ExecutionContext,
  llmConfig: LLMConfig
): Promise<AggregatedReport> {
  const pipelineStartTime = context.startTime.toISOString();

  // Step 1: Validate records
  console.log(`[${context.executionId}] Running validation...`);
  const validator = new DataValidator(true);
  const validationReport = validator.validateBatch(records);

  console.log(
    `[${context.executionId}] Validation complete: ${validationReport.validRecords}/${validationReport.totalRecords} valid`
  );

  // Step 2: Create analyzer and run analysis
  console.log(`[${context.executionId}] Initializing analyzer...`);
  const analyzer = await Analyzer.create(llmConfig, 25, 3, 1000);

  console.log(`[${context.executionId}] Running LLM analysis...`);
  const analyses = await analyzer.analyze(records, context);

  console.log(
    `[${context.executionId}] Analysis complete: ${analyses.length} successful analyses`
  );

  if (validationReport.validRecords > 0 && analyses.length === 0) {
    throw new Error(
      `LLM analysis produced 0 successful analyses from ${validationReport.validRecords} valid records. Check LLM_PROVIDER/LLM_MODEL and provider API access.`
    );
  }

  // Step 3: Store individual analyses in chunks (Firestore hard limit: 500 ops/batch)
  const FIRESTORE_BATCH_SIZE = 400; // safe buffer below the 500 limit
  for (let i = 0; i < analyses.length; i += FIRESTORE_BATCH_SIZE) {
    const chunk = analyses.slice(i, i + FIRESTORE_BATCH_SIZE);
    const batch = db.batch();
    for (const analysis of chunk) {
      const docRef = db
        .collection("analyses")
        .doc(context.executionId)
        .collection("opportunities")
        .doc(analysis.opportunityId);
      batch.set(docRef, analysis);
    }
    await batch.commit();
    console.log(`[${context.executionId}] Stored analyses chunk ${Math.floor(i / FIRESTORE_BATCH_SIZE) + 1}/${Math.ceil(analyses.length / FIRESTORE_BATCH_SIZE)} (${chunk.length} records)`);
  }

  console.log(`[${context.executionId}] Stored ${analyses.length} individual analyses`);

  // Step 4: Aggregate results
  console.log(`[${context.executionId}] Aggregating results...`);
  const report = Aggregator.aggregate(
    analyses,
    pipelineStartTime,
    analyzer.getProviderInfo().name,
    analyzer.getProviderInfo().model,
    validationReport.averageQualityScore
  );

  console.log(`[${context.executionId}] Aggregation complete: ${report.reportId}`);

  return report;
}
