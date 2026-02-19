# Project Prism - Quick Reference Guide

Fast lookup for developers and operators.

## Directory Structure

```
/sessions/friendly-nice-turing/mnt/Project Prism/
├── app/functions/
│   ├── src/
│   │   ├── types.ts                 ← All TypeScript interfaces
│   │   ├── index.ts                 ← Cloud Functions entry points
│   │   ├── llm/                     ← LLM provider implementations
│   │   ├── pipeline/                ← CSV parsing & validation
│   │   └── analysis/                ← Analysis & aggregation
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── DEPLOYMENT.md                     ← How to deploy
├── ARCHITECTURE.md                   ← System design
└── BUILD_SUMMARY.txt                ← What was built
```

## 5 Cloud Functions at a Glance

| Function | Type | Trigger | Purpose |
|----------|------|---------|---------|
| `onCSVUpload` | Async | Cloud Storage | Auto-process CSV uploads |
| `runWeeklyAnalysis` | Async | Cloud Scheduler (Mon 6am UTC) | Weekly automated analysis |
| `getReport` | HTTP | GET request | Fetch latest report |
| `getReportHistory` | HTTP | GET request | Fetch last 10 reports |
| `uploadCSV` | HTTP | POST request | Manual CSV upload |

## Data Flow

```
CSV Upload → Parse → Validate → LLM Analysis → Aggregate → Store → API
```

### Processing Time
- **1000 records**: 30-60 minutes (rate-limited to 100 req/min)
- **100 records**: 3-6 minutes
- **10 records**: 30-60 seconds

## Environment Variables (Required)

```bash
LLM_PROVIDER=claude                           # claude, gemini, or openai
LLM_API_KEY=sk-ant-...                       # Your API key
LLM_MODEL=claude-sonnet-4-5-20250929        # Model name
LLM_TEMPERATURE=0.3                          # 0-2 (lower = deterministic)
LLM_MAX_TOKENS=2000                          # Max output tokens
```

## Common Commands

### Local Development
```bash
cd app/functions
npm install
npm run build
npm run serve          # Starts emulator on localhost:5001
```

### Deployment
```bash
firebase deploy --only functions
```

### View Logs
```bash
firebase functions:log --tail
# Or via GCP:
gcloud logging read "resource.type=cloud_function"
```

### Test HTTP Functions
```bash
# Get latest report
curl https://region-project.cloudfunctions.net/getReport

# Get report history
curl https://region-project.cloudfunctions.net/getReportHistory

# Manual CSV upload
curl -X POST https://region-project.cloudfunctions.net/uploadCSV \
  -H "Content-Type: application/json" \
  -d '{"csv":"...", "filename":"test.csv"}'
```

## Key Interfaces

### OpportunityRecord (Input)
```typescript
{
  opportunityId: string
  accountName: string
  opportunityName: string
  stage: string
  winLossStatus: "won" | "lost" | "active"
  notes: string
  region: string
  // + optional fields (amount, industry, etc.)
}
```

### OpportunityAnalysis (LLM Output)
```typescript
{
  themes: { win: string[], loss: string[] }
  riskSignals: { level: "high"|"medium"|"low", signals: string[] }
  competitors: { mentioned: string[], context: string[] }
  marketSignals: string[]
  sentiment: { score: -1 to 1, label: "positive"|"neutral"|"negative" }
  confidence: 0 to 1
}
```

### AggregatedReport (Final Output)
```typescript
{
  reportId: string
  regions: { [region]: RegionReport }
  global: GlobalSummary
}
```

## Cost Quick Math

**Per 1000 records analyzed:**
- Claude: ~$1.50 (500 tokens × $3/1M tokens)
- Gemini: ~$0.08 (500 tokens × $0.15/1M tokens)
- OpenAI: ~$5-15 (depends on model)
- Compute: ~$1-2
- **Total: $3-20 per 1000 records**

## Firestore Collections

```
/reports/{date}
  └─ reportId, regions, global, dataQuality

/analyses/{executionId}/opportunities/{opportunityId}
  └─ Individual analysis results

/executions/{executionId}
  └─ Execution context, status, metrics
```

## Troubleshooting

### Function Won't Build
```bash
cd app/functions
npx tsc --noEmit        # Check TypeScript errors
npm run build
```

### Functions Timeout
- Increase timeout in firebase.json to 540s
- Reduce batch size (default 25, try 10)
- Check LLM API response times

### High Costs
```bash
# Check Firestore usage
gcloud monitoring time-series list \
  --filter='metric.type="firestore.googleapis.com/document/read_operations"'

# Monitor function invocation count
firebase functions:log | grep execution_count
```

### No Reports Generated
1. Check Cloud Logging: `gcloud logging read`
2. Verify LLM API key is set
3. Check Firestore quota
4. Validate CSV format

## LLM Provider Comparison

| Provider | Cost | Latency | Quality | Good For |
|----------|------|---------|---------|----------|
| Claude 3.5 Sonnet | $$$ | 1-2s | Excellent | Batch processing (RECOMMENDED) |
| Gemini 2.0 Flash | $ | 0.5-1s | Very Good | High volume, cost-sensitive |
| GPT-4o | $$$$ | 1-2s | Excellent | Maximum quality needed |

## Security Checklist

- [ ] API keys in Secret Manager (not environment)
- [ ] PII scrubbing enabled (default)
- [ ] Firestore rules restrict access
- [ ] Service account has minimal permissions
- [ ] Audit logging enabled
- [ ] Regular backups configured

## Performance Tips

1. **Batch Size**: Increase to 50 for better throughput (if latency allows)
2. **Provider Selection**: Use Gemini for cost, Claude for quality
3. **Region Mapping**: Add more regions for better geographic analysis
4. **Caching**: Consider caching competitor lists between runs

## Related Files

| File | Purpose |
|------|---------|
| `src/types.ts` | All type definitions |
| `src/index.ts` | Cloud Functions entry points |
| `src/llm/provider.ts` | LLM interface and factory |
| `src/llm/prompts.ts` | Analysis prompt templates |
| `src/pipeline/csvParser.ts` | CSV ingestion |
| `src/pipeline/validator.ts` | Data validation & PII |
| `src/analysis/analyzer.ts` | LLM orchestration |
| `src/analysis/aggregator.ts` | Report generation |

## URLs & Endpoints

### Local Emulator
- Functions: http://localhost:5001
- Firestore: http://localhost:8080
- Storage: http://localhost:4000

### Production (after deployment)
```
https://us-central1-PROJECT_ID.cloudfunctions.net/getReport
https://us-central1-PROJECT_ID.cloudfunctions.net/getReportHistory
https://us-central1-PROJECT_ID.cloudfunctions.net/uploadCSV
```

## Important Limits

| Resource | Limit |
|----------|-------|
| Cloud Functions timeout | 540 seconds |
| LLM rate limit (Claude) | 100 req/min |
| Firestore writes/sec | ~1.5M (auto-scaling) |
| Cloud Storage buckets | Unlimited |

## Next Steps

1. **Deploy**: Follow DEPLOYMENT.md
2. **Monitor**: Set up Cloud Logging dashboard
3. **Test**: Upload sample CSV and verify output
4. **Optimize**: Adjust batch size and LLM provider based on metrics
5. **Iterate**: Refine prompts based on analysis quality

## Contact & Support

- Check Cloud Logging for error details
- Review BUILD_SUMMARY.txt for complete feature list
- Consult ARCHITECTURE.md for system design rationale
- See DEPLOYMENT.md for production setup

---

**Last Updated**: February 2025
**Version**: 1.0.0 (Production Ready)
