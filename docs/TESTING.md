# Local Testing Guide

## Prerequisites

Your `functions/.env` is already configured with your Anthropic API key (set up Feb 11). No additional setup needed.

## Quick Start

### 1. Build the backend

```bash
cd functions && npm run build
```

### 2. Start Firebase emulators (from project root)

```bash
npm run serve
```

This starts:
- Functions on `:5001`
- Firestore on `:8080`
- Storage on `:9199`
- Emulator UI at http://localhost:4000

### 3. Start the frontend (in a separate terminal)

```bash
cd hosting && npm run dev
```

Dashboard runs at http://localhost:5173 and auto-connects to the emulators.

### 4. Upload a test CSV

**Via the dashboard UI** — use the upload widget at http://localhost:5173

**Via curl** (from project root):
```bash
curl -X POST http://localhost:5001/project-prism/us-central1/uploadCSV \
  -H "Content-Type: application/json" \
  -d "{\"csv\": \"$(cat test-data/sample-3-opportunities.csv)\", \"filename\": \"test.csv\"}"
```

## Test Data

- `test-data/sample-3-opportunities.csv` — 3 records, best for quick testing
- `test-data/sample-opportunities.csv` — 10 records, fuller pipeline run

## Where to Watch

- **Emulator UI** at http://localhost:4000 — function logs and Firestore writes
- **Terminal** running `npm run serve` — function execution logs
- **Dashboard** — auto-updates when the report lands in Firestore
