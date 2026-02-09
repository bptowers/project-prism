# Project Prism - Architecture Documentation

Comprehensive technical architecture and design rationale for the revenue intelligence platform.

## System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (Dashboard)                        │
│                    React/Vue/Next.js Frontend App                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    HTTP REST APIs (Cloud Functions)
                               │
     ┌─────────────────────────┼─────────────────────────┐
     │                         │                         │
┌────▼─────┐        ┌──────────▼──────────┐    ┌────────▼────────┐
│ getReport │        │getReportHistory    │    │   uploadCSV     │
│  (HTTP)   │        │    (HTTP)          │    │    (HTTP)       │
└────┬─────┘        └──────────┬──────────┘    └────────┬────────┘
     │                          │                       │
     └──────────────────────────┼───────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │   Firestore (DB)     │
                    │  /reports            │
                    │  /analyses           │
                    │  /executions         │
                    └──────────────────────┘
```

### Data Pipeline Diagram

```
Salesforce CSV
      │
      │ (gs://project-prism-uploads/)
      ▼
┌──────────────────────────────────────────────┐
│         onCSVUpload (Storage Trigger)         │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│          CSV Parser & Validation              │
│  • Parse CSV with field mapping               │
│  • Normalize Salesforce fields                │
│  • Detect PII (email, phone, SSN, etc.)      │
│  • Score data quality per record              │
│  • Auto-detect region                        │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│        Analyzer (Batch Processing)            │
│  • Create batches (25 records/batch)          │
│  • Call LLM provider (Claude/Gemini/OpenAI)  │
│  • Implement retry logic                      │
│  • Handle rate limiting                       │
│  • Enrich with metadata                       │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│      Aggregator (Report Generation)           │
│  • Group by region                            │
│  • Extract & rank themes                      │
│  • Identify at-risk deals                     │
│  • Aggregate competitors                      │
│  • Calculate sentiment trends                 │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│        Storage & Indexing                     │
│  /reports/{date}                             │
│  /analyses/{execId}/opportunities/{oppId}   │
│  /executions/{execId}                       │
└──────────────────────────────────────────────┘
```

## Layered Architecture

### Layer 1: LLM Provider Abstraction

```
┌─────────────────────────────────────────────┐
│           ILLMProvider Interface             │
│  • analyze(records, prompt)                  │
│  • validateConnection()                      │
│  • getProviderInfo()                         │
└──────────────────┬──────────────────────────┘
     ┌────────────────────────────────┐
     │    LLMProviderFactory          │
     │  (Pattern: Factory)            │
     └────────────┬───────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
    ┌───▼─┐   ┌───▼─┐   ┌──▼──┐
    │Claude   │Gemini   │OpenAI│
    └───────┘ └───────┘ └──────┘
```

**Rationale**: Allows switching between LLM providers without changing analysis code. Factory pattern ensures clean instantiation and testing.

### Layer 2: Data Pipeline

```
CSV Input
   │
   ▼
┌─────────────────┐
│ CSVParser       │
│ • parse()       │
│ • mapRecord()   │
│ • detectRegion()│
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ DataValidator        │
│ • validateBatch()    │
│ • validateRecord()   │
│ • detectPII()        │
│ • scrubText()        │
└──────────┬───────────┘
           │
           ▼
       Records Ready
      for Analysis
```

### Layer 3: Analysis Orchestration

```
Valid Records
      │
      ▼
┌──────────────────────────────┐
│  Analyzer                    │
│  • Batch creation            │
│  • LLM processing loop       │
│  • Retry logic               │
│  • Result enrichment         │
└──────────┬───────────────────┘
           │
           ▼
Individual Opportunity
    Analyses
```

### Layer 4: Aggregation & Reporting

```
OpportunityAnalysis[]
       │
       ▼
┌──────────────────────────────┐
│  Aggregator                  │
│  • groupByRegion()           │
│  • generateRegionReport()    │
│  • generateGlobalSummary()   │
│  • identifyAtRiskDeals()     │
│  • aggregateCompetitors()    │
│  • extractMarketSignals()    │
└──────────┬───────────────────┘
           │
           ▼
    AggregatedReport
```

## Data Models

### Opportunity Record (Input)
```
OpportunityRecord {
  opportunityId: string          // Unique SFDC ID
  accountName: string            // Customer account
  opportunityName: string        // Deal name
  stage: string                  // Sales stage
  amount?: number                // Deal value
  winLossStatus: won|lost|active // Outcome
  notes: string                  // Notes/summary
  dealReviewNotes?: string       // Detailed review
  region: string                 // Auto-detected
  industry?: string              // Customer industry
  [...other fields]
}
```

### Opportunity Analysis (LLM Output)
```
OpportunityAnalysis {
  opportunityId: string

  themes: {
    win: string[]              // Why won
    loss: string[]             // Why lost
    neutral?: string[]         // Other context
  }

  riskSignals: {
    level: high|medium|low     // Risk severity
    signals: string[]          // Specific risks
    summary: string            // Business context
  }

  competitors: {
    mentioned: string[]        // Competitor names
    context: string[]          // How mentioned
  }

  marketSignals: string[]      // Market trends

  sentiment: {
    score: -1 to 1            // Sentiment value
    label: positive|neutral|negative
  }

  confidence: 0 to 1          // Analysis confidence
  analysisDate: string        // Timestamp
}
```

### Aggregated Report (Output)
```
AggregatedReport {
  reportId: string            // Unique report ID
  reportDate: string          // Generation date
  period: string              // Week/month label

  regions: {
    [regionName]: RegionReport {
      totalOpportunities: number
      wins: number
      losses: number
      active: number
      winRate: number
      topWinThemes: ThemeCount[]
      topLossThemes: ThemeCount[]
      atRiskDeals: RiskDeal[]
      competitorActivity: CompetitorActivity[]
      sentimentTrend: { average, label }
    }
  }

  global: GlobalSummary {
    totalOpportunities: number
    totalWins: number
    totalLosses: number
    globalWinRate: number
    topWinThemes: ThemeCount[]
    topLossThemes: ThemeCount[]
    topCompetitors: CompetitorActivity[]
    highRiskCount: number
    mediumRiskCount: number
    globalSentiment: { average, label }
  }

  dataQuality: {
    averageQualityScore: number
    totalPiiIssuesCaught: number
  }
}
```

## LLM Provider Implementations

### Provider Selection Matrix

```
┌─────────────────┬──────────────┬────────────┬────────────┬───────────┐
│ Provider        │ Cost/1M Tokens│ Latency    │ Quality    │ Best For  │
├─────────────────┼──────────────┼────────────┼────────────┼───────────┤
│ Claude 3.5 S.   │ $3           │ 1-2s       │ Excellent  │ Batch ✓   │
│ Gemini 2.0 Flash│ $0.075       │ 0.5-1s     │ Very Good  │ Volume    │
│ GPT-4o          │ $5-15        │ 1-2s       │ Excellent  │ Quality   │
│ GPT-4 Turbo     │ $10          │ 2-3s       │ Excellent  │ Complex   │
└─────────────────┴──────────────┴────────────┴────────────┴───────────┘
```

**Recommendation**: Claude 3.5 Sonnet for balanced cost/quality in batch processing.

## Error Handling Strategy

### Hierarchical Error Recovery

```
Level 1: Per-Record Retry
  └─ Failed record → Retry up to 3x with exponential backoff
  └─ Continue processing other records

Level 2: Rate Limit Handling
  └─ 429 Status → Respect Retry-After header
  └─ Delay and retry after backoff

Level 3: Validation Errors
  └─ PII detected → Scrub and continue
  └─ Missing field → Log warning, process anyway

Level 4: Critical Failure
  └─ API unavailable → Fail execution
  └─ Log context → Store in Firestore for retry
```

## Performance Characteristics

### Processing Timeline for 1000 Records

```
CSV Parsing:        5 min   (1-2ms per record)
Validation:         5 min   (5ms per record)
LLM Processing:    30-60 min (3-5s per record, rate-limited)
Aggregation:       30 sec   (~30ms for 1000 records)
Storage:           5 min    (Firestore writes)
────────────────────────────
Total:             45-75 min

Bottleneck: LLM API calls (100 req/min rate limit)
Solution: Implement batch queue or parallel processing
```

### Cost Analysis

```
Per 1000 records analyzed:

Compute:
  - Cloud Functions: ~$1-2 (execution time + memory)
  - Storage: <$1

Data:
  - Firestore: <$1 (storage + operations)
  - Cloud Storage: <$1

LLM API (assuming Claude):
  - ~500 tokens per opportunity
  - 1000 records = 500k tokens
  - $3 per 1M tokens = $1.50

TOTAL: ~$4-7 per 1000 records
```

## Scalability Considerations

### Horizontal Scaling

```
Approach 1: Batch Queue (Recommended)
  CSV → Queue → Worker Functions → Results
  Benefits: Decouples processing, easy to scale

Approach 2: Parallel Processing
  Split CSV into chunks → Process in parallel
  Benefits: Faster wall-clock time
  Challenges: More complex state management

Approach 3: Distributed Workers
  Use Pub/Sub + Cloud Tasks for distributed processing
  Benefits: True horizontal scaling
  Challenges: More infrastructure complexity
```

### Current Limits

```
Cloud Functions:
  - Timeout: 540 seconds (9 minutes)
  - Memory: 512MB-8GB
  - Max instances: 100 (default)

Firestore:
  - Read/write: ~1.5M writes/hour with auto-scaling
  - Storage: Unlimited

LLM APIs:
  - Claude: 100k tokens/min
  - Gemini: Rate limit varies
  - OpenAI: 90k tokens/min (default)
```

## Security Architecture

### Authentication & Authorization

```
Cloud Functions:
  ├─ HTTP endpoints: Firebase Auth (token in header)
  ├─ Storage triggers: Automatic (service account)
  └─ Scheduled jobs: Cloud Scheduler (service account)

Firestore:
  └─ Rules-based access control
     ├─ Authenticated users can read reports
     ├─ Public read for aggregated reports
     └─ Only Cloud Functions can write
```

### Data Security

```
PII Handling:
  1. Detection: Regex patterns for emails, phones, SSNs
  2. Scrubbing: [EMAIL_REDACTED], [PHONE_REDACTED]
  3. Logging: PII issues logged but redacted

API Keys:
  1. Storage: Cloud Secret Manager
  2. Retrieval: Runtime injection via environment
  3. Rotation: Automated via GCP Secret Manager

Data Encryption:
  1. In-transit: HTTPS/TLS (Firebase managed)
  2. At-rest: Google-managed encryption (Firestore/Storage)
```

## Deployment Architecture

### Cloud Infrastructure

```
Google Cloud Platform
│
├─ Cloud Functions (Compute)
│  ├─ onCSVUpload (Storage trigger)
│  ├─ runWeeklyAnalysis (Pub/Sub trigger)
│  ├─ getReport (HTTP)
│  ├─ getReportHistory (HTTP)
│  └─ uploadCSV (HTTP)
│
├─ Cloud Storage
│  └─ project-prism-uploads/uploads/*.csv
│
├─ Firestore (Database)
│  ├─ /reports/{date}
│  ├─ /analyses/{execId}/opportunities/{oppId}
│  └─ /executions/{execId}
│
├─ Cloud Scheduler
│  └─ Weekly trigger (Monday 6am UTC)
│
├─ Cloud Logging
│  └─ Function logs + custom metrics
│
└─ Secret Manager
   ├─ llm-api-key
   ├─ llm-model
   └─ llm-provider
```

### Environment Isolation

```
Development
  ├─ Firebase Emulator Suite (local)
  ├─ Test data in sample.csv
  └─ Short processing windows

Staging
  ├─ Separate GCP project
  ├─ Real Firebase project
  ├─ Test LLM API key
  └─ Production-like data

Production
  ├─ Main GCP project
  ├─ Full Firebase features
  ├─ Production LLM API key
  └─ Real Salesforce data
```

## Monitoring & Observability

### Metrics Stack

```
Cloud Logging (Primary)
  ├─ Function execution logs
  ├─ Custom execution contexts
  └─ Error tracking

Cloud Monitoring (Dashboards)
  ├─ Function invocation rate
  ├─ Error rate
  ├─ Execution duration
  ├─ Memory usage
  └─ Cost tracking

Custom Metrics
  ├─ Records processed
  ├─ PII issues detected
  ├─ LLM token usage
  ├─ Batch success rate
  └─ Aggregation metrics
```

### Key Dashboards

```
Operations Dashboard
  • Function health
  • Error rates
  • Latency trends

Cost Dashboard
  • LLM API costs
  • Compute costs
  • Storage costs

Quality Dashboard
  • Data quality scores
  • Analysis confidence
  • PII detection rate

Business Dashboard
  • Win/loss rates by region
  • Top themes
  • Competitor mentions
```

## Best Practices

### Code Quality
- Strict TypeScript (no `any` types)
- JSDoc comments on public APIs
- Modular architecture (single responsibility)
- Error types for different failure modes

### Performance
- Batch processing for efficiency
- Rate limiting implementation
- Caching where applicable
- Minimal data transfer

### Reliability
- Retry logic with exponential backoff
- Graceful degradation
- Comprehensive error logging
- Health checks on API endpoints

### Security
- API key rotation (Secret Manager)
- PII detection and scrubbing
- Input validation
- Principle of least privilege (IAM)

### Operations
- Structured logging with execution IDs
- Monitoring and alerting
- Runbooks for common issues
- Regular backups of critical data

## Future Enhancements

### Short Term (1-2 months)
- [ ] Report export (PDF/PPTX)
- [ ] Custom field mapping UI
- [ ] Advanced filtering in getReport API
- [ ] Multi-language support

### Medium Term (3-6 months)
- [ ] Real-time dashboard with WebSocket
- [ ] Report comparison and trend analysis
- [ ] Fine-tuned models for industry-specific analysis
- [ ] Integration with other CRM platforms (HubSpot, etc.)

### Long Term (6-12 months)
- [ ] Predictive deal scoring
- [ ] Automated alert system
- [ ] Custom model training
- [ ] Mobile app for report access
- [ ] Advanced analytics (correlation analysis, cohort analysis)

## References

- [Firebase Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Claude API Documentation](https://docs.anthropic.com/claude)
- [Vertex AI Generative AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
