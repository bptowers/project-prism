# Project Prism - Cloud Functions Backend

Global Revenue Intelligence Engine powered by AI-driven analysis of Salesforce win/loss data.

## Overview

Project Prism is a sophisticated Firebase Cloud Functions backend that:
- Ingests CSV exports from Salesforce (opportunity data, deal reviews)
- Processes them through enterprise LLM providers (Claude, Gemini, OpenAI)
- Generates structured revenue intelligence (themes, risks, competitors, market signals)
- Stores analyzed data in Firestore for dashboard consumption

## Architecture

### High-Level Flow

```
CSV Upload → Validation → LLM Analysis → Aggregation → Firestore Storage → API
```

### Modules

#### LLM Layer (`src/llm/`)
- **provider.ts**: Abstract interface and factory pattern for LLM providers
- **claude.ts**: Anthropic Claude implementation
- **gemini.ts**: Google Gemini (Vertex AI) implementation
- **openai.ts**: OpenAI GPT implementation
- **prompts.ts**: Engineering-grade analysis prompts with few-shot examples

Each provider:
- Implements the `ILLMProvider` interface
- Handles rate limiting (100 req/min)
- Parses structured JSON responses
- Implements retry logic with exponential backoff
- Validates API connections

#### Pipeline Layer (`src/pipeline/`)
- **csvParser.ts**: CSV ingestion with field mapping and region tagging
- **validator.ts**: Data quality scoring, PII detection/scrubbing, completeness analysis

#### Analysis Layer (`src/analysis/`)
- **analyzer.ts**: Main orchestrator for validation → LLM processing → enrichment
- **aggregator.ts**: Aggregates individual analyses into regional and global reports

#### Core (`src/`)
- **types.ts**: Single source of truth for all TypeScript interfaces
- **index.ts**: Cloud Function entry points (5 functions)

## Cloud Functions

### 1. onCSVUpload (Storage Trigger)
**Trigger**: Cloud Storage (`gs://project-prism-uploads/uploads/*.csv`)

Automatically processes any CSV uploaded to the uploads/ bucket:
```bash
# Triggered automatically when file appears in Cloud Storage
```

### 2. runWeeklyAnalysis (Scheduled)
**Trigger**: Cloud Scheduler (every 3 days at 6:00 AM UTC)

Runs automated analysis on the latest BigQuery data. The schedule is defined in
code via the `onSchedule` config in `src/index.ts` (`0 6 */3 * *`); the gcloud
command below is illustrative only:
```bash
gcloud scheduler jobs create pubsub run-weekly-analysis \
  --schedule="0 6 */3 * *" \
  --time-zone="UTC" \
  --topic="projects/YOUR_PROJECT/topics/projects/YOUR_PROJECT/topics/firebase-schedule-runWeeklyAnalysis"
```

### 3. getReport (HTTP)
**Endpoint**: `GET /getReport`

Returns the latest aggregated report:
```bash
curl https://region-project.cloudfunctions.net/getReport
```

Response:
```json
{
  "success": true,
  "report": {
    "reportId": "report_1234567890",
    "reportDate": "2024-01-15T12:00:00Z",
    "period": "Week 3, January 2024",
    "regions": { ... },
    "global": { ... }
  }
}
```

### 4. getReportHistory (HTTP)
**Endpoint**: `GET /getReportHistory`

Returns last 10 reports:
```bash
curl https://region-project.cloudfunctions.net/getReportHistory
```

### 5. uploadCSV (HTTP)
**Endpoint**: `POST /uploadCSV`

Manual CSV upload endpoint:
```bash
curl -X POST https://region-project.cloudfunctions.net/uploadCSV \
  -H "Content-Type: application/json" \
  -d '{
    "csv": "opportunityId,accountName,...",
    "filename": "salesforce_export_jan.csv"
  }'
```

## Configuration

### Environment Variables

Required:
```bash
LLM_PROVIDER=claude              # claude, gemini, or openai
ANTHROPIC_API_KEY=sk-ant-...              # Provider-specific key (GEMINI_API_KEY / OPENAI_API_KEY for the others)
LLM_MODEL=claude-sonnet-4-5-20250929  # Model name
LLM_TEMPERATURE=0.3             # 0-2, lower=more deterministic
LLM_MAX_TOKENS=2000             # Max output tokens
LLM_TOP_P=0.9                   # Nucleus sampling
GCP_PROJECT_ID=your-project     # For Gemini (Vertex AI)
```

### Firestore Collections

```
/reports/{date}                  - Aggregated reports by date
/analyses/{executionId}/opportunities/{opportunityId}  - Individual analyses
/executions/{executionId}        - Execution context and logs
```

## Data Models

### OpportunityRecord (Input)
```typescript
{
  opportunityId: string;
  accountName: string;
  opportunityName: string;
  stage: string;
  amount?: number;
  closedDate?: string;
  winLossStatus: "won" | "lost" | "active";
  notes: string;
  dealReviewNotes?: string;
  region: string;
  // ...
}
```

### OpportunityAnalysis (LLM Output)
```typescript
{
  opportunityId: string;
  themes: {
    win: string[];      // Why deals are won
    loss: string[];     // Why deals are lost
  };
  riskSignals: {
    level: "high" | "medium" | "low" | "none";
    signals: string[];
    summary: string;
  };
  competitors: {
    mentioned: string[];
    context: string[];
  };
  marketSignals: string[];
  sentiment: {
    score: -1 to 1;
    label: "positive" | "neutral" | "negative";
  };
  confidence: 0 to 1;
  // ... plus metadata
}
```

### AggregatedReport (Output)
```typescript
{
  reportId: string;
  reportDate: string;
  period: string;
  regions: {
    [region]: RegionReport
  };
  global: GlobalSummary;
}
```

## LLM Providers

### Claude (Recommended)
Best balance of quality and cost for analysis tasks.
```typescript
{
  provider: "claude",
  model: "claude-sonnet-4-5-20250929",
  apiKey: "sk-ant-...",
  temperature: 0.3,
  maxTokens: 2000
}
```

### Gemini
Native Google Cloud integration via Vertex AI.
```typescript
{
  provider: "gemini",
  model: "gemini-2.0-flash",
  apiKey: "not-used-with-gcp-credentials",
  temperature: 0.3,
  maxTokens: 2000
}
```

### OpenAI
For organizations already on OpenAI platform.
```typescript
{
  provider: "openai",
  model: "gpt-4o",
  apiKey: "sk-...",
  temperature: 0.3,
  maxTokens: 2000
}
```

## Processing Pipeline

### 1. CSV Parsing
- Parses CSV with configurable field mapping
- Normalizes Salesforce field names
- Auto-detects region based on account name
- Handles encoding issues and malformed rows

### 2. Validation
- Checks required fields (opportunityId, accountName, stage, notes)
- Detects PII: emails, phone numbers, SSNs, credit cards, IPs
- Optionally scrubs PII from text fields
- Scores data quality 0-100 per record
- Generates validation report with statistics

### 3. Analysis
- Batches records (25 per batch by default)
- Calls LLM provider for each record
- Implements exponential backoff retry (up to 3 attempts)
- Handles rate limiting gracefully
- Enriches results with metadata

### 4. Aggregation
- Groups analyses by region
- Extracts and ranks themes (win/loss)
- Identifies at-risk deals (risk level + signals)
- Aggregates competitor mentions and context
- Extracts emerging market signals
- Calculates sentiment trends
- Generates regional and global summaries

### 5. Storage
- Stores individual analyses in Firestore
- Stores aggregated reports by date
- Logs execution context for debugging

## Error Handling

The system implements comprehensive error handling:
- **Validation errors**: Flagged but don't block processing (continues with valid records)
- **LLM API errors**: Automatic retry with exponential backoff
- **Rate limit errors**: Smart delay based on provider feedback
- **Parsing errors**: Logged and skipped, processing continues
- **PII detection**: Logged and optionally scrubbed

All errors are stored in execution context for audit trail.

## Performance Characteristics

- **CSV Parsing**: ~1-2ms per record
- **Validation**: ~5ms per record
- **LLM Analysis**: ~3-5 seconds per record (depends on LLM + network)
- **Aggregation**: ~50ms for 1000 records
- **Total**: ~1000 records in ~30-60 minutes (rate-limited to 100 req/min)

### Scaling
- Batch size configurable (default 25)
- Rate limiting per provider
- Firestore auto-scaling
- Cloud Functions timeout: 540s (9 minutes)
- For large datasets (10k+ records): Consider scheduled batch jobs

## Development

### Building
```bash
npm install
npm run build
```

### Local Development
```bash
npm run serve
# Starts Firebase emulator for functions, Firestore, and Storage
```

### Testing (Planned)
```bash
npm test
```

### Deployment
```bash
firebase deploy --only functions
```

## Security Considerations

1. **API Keys**: Store in Cloud Secret Manager, inject via environment variables
2. **PII Handling**: Automatic detection and scrubbing enabled by default
3. **Authentication**: Functions can be restricted to authenticated users
4. **Data Access**: Firestore rules should restrict access to authenticated users
5. **Audit Logging**: All executions logged with timestamp and status

## Monitoring

All functions log to Cloud Logging with execution IDs:
```
[exec_1234567890_abc123] CSV upload detected: uploads/salesforce_export.csv
[exec_1234567890_abc123] Parsed 250 records from CSV
[exec_1234567890_abc123] Validation complete: 245/250 valid (avg quality: 87.5)
[exec_1234567890_abc123] Processing batch 1/10 (25 records)
...
```

Set up alerts:
```bash
gcloud monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Project Prism Function Errors" \
  --condition-display-name="Error rate > 5%" \
  --condition-expression='resource.type="cloud_function" AND metric.type="cloudfunctions.googleapis.com/execution_count" AND metric.status="error"'
```

## Cost Estimation

For 1000 records/month:
- Cloud Storage: <$1 (CSV uploads)
- Cloud Functions: ~$1-2 (invocation + compute)
- Firestore: <$1 (storage + reads/writes)
- LLM API: $0.50-2.00 (depends on provider and model)
  - Claude: ~$0.01/1000 tokens (analysis uses ~500 tokens/record)
  - Gemini: ~$0.005/1000 tokens
  - OpenAI: ~$0.015/1000 tokens

**Total: ~$3-6 per 1000 records**

## Future Enhancements

- Web UI for report visualization
- Scheduled report exports (PDF/PPTX)
- Real-time dashboard updates via WebSocket
- Additional LLM providers (Anthropic Claude 3 Opus, etc.)
- Fine-tuned models for industry-specific analysis
- Multi-language support
- Custom field mapping UI
- Report comparison and trend analysis

## Support

For issues or questions:
1. Check Cloud Logging for execution details
2. Review execution context in Firestore
3. Validate LLM API keys and quotas
4. Check Cloud Function memory and timeout settings
