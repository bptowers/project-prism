# Project Prism - Deployment Guide

Complete step-by-step instructions for deploying the Cloud Functions backend to production.

## Prerequisites

### Software Requirements
- Node.js 20+
- Firebase CLI 13+
- Google Cloud SDK
- Git

### Google Cloud Setup
- GCP Project with billing enabled
- Firebase Project initialized
- Service account with appropriate permissions
- API keys for chosen LLM provider(s)

### Installation

```bash
# Install Node.js dependencies
cd "app/functions"
npm install

# Install Firebase CLI globally
npm install -g firebase-tools

# Initialize Firebase (if not already done)
firebase init
```

## Step 1: Create GCP Project

```bash
# Create new GCP project
gcloud projects create PROJECT_ID --name="Project Prism"

# Set as default
gcloud config set project PROJECT_ID

# Enable required APIs
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  pubsub.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudlogging.googleapis.com
```

## Step 2: Configure Firebase Project

```bash
# Link Firebase to GCP project
firebase projects:addfirebase PROJECT_ID

# Initialize Firebase in your project directory
firebase init functions firestore storage

# Choose TypeScript when prompted
# Select "functions" collection for Firestore
# Create default storage bucket
```

## Step 3: Set Up LLM API Keys

### Option A: Using Cloud Secret Manager (Recommended)

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create secrets
echo -n "sk-ant-your-api-key" | \
  gcloud secrets create llm-api-key --data-file=-

echo -n "claude-3-5-sonnet-20241022" | \
  gcloud secrets create llm-model --data-file=-

echo -n "claude" | \
  gcloud secrets create llm-provider --data-file=-

# Grant Cloud Functions service account access
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding llm-api-key \
  --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### Option B: Using Environment Variables

```bash
# Create .env.local with your configuration
cp app/functions/.env.example app/functions/.env.local

# Edit with your API keys
nano app/functions/.env.local

# Set environment variables in Cloud Functions
firebase functions:config:set \
  llm.provider="claude" \
  llm.apikey="sk-ant-..." \
  llm.model="claude-3-5-sonnet-20241022" \
  llm.temperature="0.3" \
  llm.maxtokens="2000"
```

## Step 4: Configure Cloud Storage Bucket

```bash
# Create storage bucket for CSV uploads
gsutil mb -p PROJECT_ID gs://project-prism-uploads

# Set up lifecycle rules (optional - cleanup old files after 30 days)
cat > storage-lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
EOF

gsutil lifecycle set storage-lifecycle.json gs://project-prism-uploads

# Set bucket permissions
gsutil iam ch serviceAccount:PROJECT_ID@appspot.gserviceaccount.com:objectViewer gs://project-prism-uploads
```

## Step 5: Configure Firestore Database

```bash
# Create Firestore database in native mode
gcloud firestore databases create --location=us-central1

# Create indexes (optional - for better query performance)
firebase firestore:indexes
```

### Firestore Security Rules

Update `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read reports
    match /reports/{document=**} {
      allow read: if request.auth != null;
    }

    // Allow authenticated users to read analyses
    match /analyses/{document=**} {
      allow read: if request.auth != null;
    }

    // Allow Cloud Functions to write
    match /{document=**} {
      allow write: if request.auth.uid == null;
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

## Step 6: Build and Test Locally

```bash
cd app/functions

# Build TypeScript
npm run build

# Start emulator
npm run serve

# In another terminal, test the functions
curl http://localhost:5001/getReport
```

## Step 7: Deploy to Production

```bash
# Deploy functions only
firebase deploy --only functions

# Or deploy everything
firebase deploy

# Monitor deployment
firebase functions:list
```

## Step 8: Configure Cloud Scheduler

```bash
# Create Cloud Scheduler job for weekly analysis
gcloud scheduler jobs create pubsub run-weekly-analysis \
  --schedule="0 6 * * 1" \
  --time-zone="UTC" \
  --topic="projects/PROJECT_ID/topics/firebase-schedule-runWeeklyAnalysis" \
  --message-body='{}'

# Verify job
gcloud scheduler jobs describe run-weekly-analysis
```

## Step 9: Test Deployment

### Test CSV Upload Trigger

```bash
# Create sample CSV
cat > sample.csv << EOF
opportunityId,accountName,opportunityName,stage,amount,winLossStatus,notes
OPP001,Acme Corp,Enterprise Suite Implementation,Closed Won,500000,won,Customer praised scalability and support. Chose us over Competitor X due to faster implementation.
OPP002,TechStart Inc,Integration Platform,Closed Lost,250000,lost,Budget cut 40% due to economic uncertainty. Lower-cost competitor won.
OPP003,Global Enterprises,Analytics Dashboard,Active,750000,active,Evaluation ongoing. Risk: Extended sales cycle. Competing solution showing traction.
EOF

# Upload to Cloud Storage (triggers pipeline)
gsutil cp sample.csv gs://project-prism-uploads/uploads/sample.csv

# Monitor execution
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=onCSVUpload" \
  --limit 50 --format json

# Fetch generated report
curl https://us-central1-PROJECT_ID.cloudfunctions.net/getReport
```

### Test Scheduled Job

```bash
# Manually trigger weekly job (for testing)
gcloud scheduler jobs run run-weekly-analysis

# Check logs
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=runWeeklyAnalysis" \
  --limit 50
```

### Test HTTP Endpoints

```bash
# Get latest report
curl https://us-central1-PROJECT_ID.cloudfunctions.net/getReport

# Get report history
curl https://us-central1-PROJECT_ID.cloudfunctions.net/getReportHistory

# Upload CSV via API
curl -X POST https://us-central1-PROJECT_ID.cloudfunctions.net/uploadCSV \
  -H "Content-Type: application/json" \
  -d '{
    "csv": "opportunityId,accountName,...",
    "filename": "test_upload.csv"
  }'
```

## Step 10: Set Up Monitoring and Alerts

### Cloud Logging

```bash
# View function logs
gcloud logging read "resource.type=cloud_function" --limit 50 --format json

# Create custom metric
gcloud logging metrics create csv_uploads_total \
  --description="Total CSV uploads processed" \
  --log-filter='resource.type="cloud_function" AND resource.labels.function_name="onCSVUpload"'
```

### Create Alerts

```bash
# Alert on function errors
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Project Prism Function Errors" \
  --condition-display-name="Error rate > 5%" \
  --condition-expression='
    resource.type="cloud_function" AND
    metric.type="cloudfunctions.googleapis.com/execution_count" AND
    resource.labels.function_name=~"(onCSVUpload|runWeeklyAnalysis|.*Report)"
  '

# Alert on high latency
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Project Prism High Latency" \
  --condition-display-name="Execution time > 30s" \
  --condition-expression='
    resource.type="cloud_function" AND
    metric.type="cloudfunctions.googleapis.com/execution_times"
  '
```

## Step 11: Configure CI/CD (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main
    paths:
      - 'app/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: app/functions
        run: npm ci

      - name: Build
        working-directory: app/functions
        run: npm run build

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
```

Setup secrets in GitHub:

```bash
# Generate service account key
gcloud iam service-accounts keys create firebase-key.json \
  --iam-account=PROJECT_ID@appspot.gserviceaccount.com

# Add to GitHub secrets as FIREBASE_SERVICE_ACCOUNT (base64 encoded)
```

## Step 12: Performance Optimization

### Cold Start Optimization

```bash
# Increase memory allocation (faster CPU)
firebase functions:config:set functions.memory="512MB"

# Reduce dependencies
npm prune --production

# Enable code minification
```

### Scaling Configuration

Update `firebase.json`:

```json
{
  "functions": {
    "maxInstances": 100,
    "minInstances": 2,
    "timeoutSeconds": 540,
    "memory": "512MB"
  }
}
```

## Step 13: Backup and Recovery

### Backup Firestore

```bash
# Create backup
gcloud firestore backups create \
  --collection-filter='collection_id:reports OR collection_id:analyses' \
  --retention=30d

# Schedule regular backups
gcloud scheduler jobs create app-engine backup-firestore \
  --schedule="0 2 * * *" \
  --http-method=POST \
  --uri="https://firestore.googleapis.com/v1/projects/PROJECT_ID/databases/backups" \
  --oidc-service-account-email=PROJECT_ID@appspot.gserviceaccount.com
```

### Backup Storage

```bash
# Enable versioning on storage bucket
gsutil versioning set on gs://project-prism-uploads

# Create scheduled backup to GCS archive bucket
gsutil -m cp -r gs://project-prism-uploads gs://project-prism-backups-archive
```

## Troubleshooting

### Function Won't Deploy

```bash
# Check build logs
firebase functions:log --only onCSVUpload

# Verify TypeScript compilation
cd app/functions && npm run build

# Check for type errors
npx tsc --noEmit
```

### Functions Timing Out

```bash
# Increase timeout in firebase.json to 540s
# Reduce batch size for LLM processing
# Monitor execution time in Cloud Logging
```

### High Costs

```bash
# Check Firestore usage
gcloud monitoring time-series list \
  --filter='metric.type="firestore.googleapis.com/document/read_operations"'

# Monitor function execution count
firebase functions:log --tail | grep "execution_count"

# Optimize query patterns and batch operations
```

## Post-Deployment Checklist

- [ ] All 5 Cloud Functions deployed successfully
- [ ] Cloud Scheduler job running without errors
- [ ] CSV uploads trigger onCSVUpload function
- [ ] Reports stored in Firestore
- [ ] HTTP endpoints responding correctly
- [ ] Monitoring and alerts configured
- [ ] Backup jobs running
- [ ] Documentation updated with project-specific URLs
- [ ] Team trained on deployment and monitoring
- [ ] Runbooks created for common issues

## Rollback Procedure

```bash
# Revert to previous version
firebase deploy --only functions:onCSVUpload@VERSION_HASH

# Or redeploy from git history
git checkout COMMIT_HASH
firebase deploy --only functions
```

## Support and Escalation

For deployment issues:
1. Check Cloud Logging: `gcloud logging read`
2. Review Firebase Dashboard for quota/billing alerts
3. Validate environment variables and API keys
4. Check Cloud Function memory and timeout settings
5. Contact your LLM provider for rate limit issues
