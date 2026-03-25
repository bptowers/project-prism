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
    gemini: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
    claude: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
  };

  // Only use the generic LLM_MODEL if no provider override was requested
  // (i.e., it's the default provider from env, not a per-upload selection)
  const model = providerOverride
    ? defaultModels[provider] || "gemini-3.1-pro-preview"
    : process.env.LLM_MODEL || defaultModels[provider] || "claude-sonnet-4-6";

  return {
    provider: provider as "claude" | "gemini" | "openai",
    model,
    apiKey,
    temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.3"),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "2000", 10),
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
      await reportRef.set({
        ...report,
        transformed,
        reportDate: report.reportDate,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });

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
        await reportRef.update({
          ...enrichedReport,
          transformed: enrichedTransformed,
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
      await reportRef.set({
        ...report,
        transformed,
        reportDate: report.reportDate,
        createdAt: FieldValue.serverTimestamp(),
        dataSource: "bigquery",
      }, { merge: true });

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
        await reportRef.update({
          ...enrichedReport,
          transformed: enrichedTransformed,
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
export const getReport = onRequest({ secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] }, async (req, res) => {
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
export const getReportHistory = onRequest({ secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] }, async (req, res) => {
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
export const uploadCSV = onRequest({ secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] }, async (req, res) => {
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
  { timeoutSeconds: 3600, memory: "1GiB", secrets: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"] },
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
      await reportRef.set({
        ...report,
        transformed,
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
        await reportRef.update({
          ...enrichedReport,
          transformed: enrichedTransformed,
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

  // Step 3: Store individual analyses
  const batch = db.batch();
  for (const analysis of analyses) {
    const docRef = db
      .collection("analyses")
      .doc(context.executionId)
      .collection("opportunities")
      .doc(analysis.opportunityId);

    batch.set(docRef, analysis);
  }
  await batch.commit();

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
