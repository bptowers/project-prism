PROJECT PRISM - Sample Data & Configuration Files
==================================================

All configuration and sample data files have been successfully created.

FILE MANIFEST:
==============

1. firebase.json
   - Firebase project configuration for Cloud Functions, Hosting, Firestore, and Storage
   - Defines API rewrites for /api/report, /api/report/history, /api/upload endpoints
   - Specifies Firestore and Storage security rules files

2. .env.example
   - Environment variable template for developers
   - LLM provider configuration (Claude/Anthropic, Gemini/Google, OpenAI)
   - Firebase project settings
   - Analysis configuration (batch size, retries, temperature)
   - Report distribution settings (email recipients, cron schedule)

3. firestore.rules
   - Firestore security rules (version 2)
   - Reports collection: read by authenticated users, write by Cloud Functions only
   - Analyses collection: read by authenticated users, write by Cloud Functions only
   - Config collection: read by authenticated users, write by admins only

4. storage.rules
   - Firebase Storage security rules (version 2)
   - Uploads path: authenticated users can write CSV files up to 50MB
   - Reports path: read by authenticated users, write by functions only

5. package.json
   - Root monorepo package configuration
   - Scripts for build, serve, deploy (functions, hosting)
   - Project metadata: Project Prism v1.0.0

6. sample-data/opportunities.csv
   - Realistic Salesforce export with 36 opportunities (plus header row)
   - 37 rows total
   
   DISTRIBUTION:
   - Stages: 11 Closed Won, 8 Closed Lost, 4 Negotiation, 5 Proposal, 5 Discovery, 3 Qualification
   - Regions: NA (17 deals), UK (9 deals), ANZ (10 deals)
   - Total Pipeline Value: $8.536M
   - Average Deal Size: $237K
   - Deal Range: $85K - $450K
   
   COLUMNS:
   - Opportunity_ID (OPP-00145 through OPP-00180)
   - Opportunity_Name (anonymized, realistic company names)
   - Region (NA, UK, ANZ)
   - Stage (Deal lifecycle stages)
   - Close_Date (January-February 2026)
   - Deal_Value (in thousands)
   - Win_Loss_Reason (for closed deals)
   - Competitor (ServiceMax, FieldEdge, ServiceTitan, Jobber, In-house, None)
   - Owner (Sales rep names)
   - Win_Loss_Notes (2-4 sentence detailed notes - REALISTIC CONTENT)
   - Deal_Review_Notes (structured review commentary)
   
   DATA QUALITY FEATURES:
   - Authentic win/loss narratives with specific details
   - Competitive context with named competitors
   - Customer pain points quantified (e.g., "2 hours/day per dispatcher")
   - ROI metrics and financial justifications
   - Deal risks and blockers clearly articulated
   - Decision makers identified with titles
   - Timeline and next steps specific
   - Implementation quality and customer satisfaction noted
   - Pattern analysis: feature gaps, pricing objections, competitive losses
   - Some deals with minimal notes (realistic data quality variation)

DIRECTORY STRUCTURE:
====================
/sessions/friendly-nice-turing/mnt/Project Prism/app/
├── .env.example
├── firebase.json
├── firestore.rules
├── storage.rules
├── package.json
├── sample-data/
│   └── opportunities.csv
├── functions/          (existing)
└── hosting/            (existing)

USAGE INSTRUCTIONS:
===================

1. Copy .env.example to .env and populate with actual API keys and Firebase project ID
2. Deploy Firestore and Storage rules to Firebase
3. Upload opportunities.csv to Cloud Storage for AI analysis
4. Cloud Functions will read and process opportunities, generating revenue intelligence reports
5. Use firebase CLI: firebase deploy --only functions,firestore,storage

SAMPLE DATA FEATURES:
====================

The opportunities.csv includes realistic narratives suitable for LLM analysis:

✓ Win notes include: product fit drivers, differentiators, champion involvement, 
  competitive context, implementation speed, and customer satisfaction
  
✓ Loss notes include: specific reasons (price, features, competitor, politics),
  quantified gaps, decision maker context, and recovery potential signals
  
✓ Active deal notes include: champion details, risk signals, competitive threats,
  timeline clarity, and next steps
  
✓ Data variety: some deals with rich narrative detail, others minimal (realistic)

✓ Regional diversity: demonstrates geographic patterns and regional preferences

✓ Competitive landscape: includes multiple competitors with realistic win/loss patterns

✓ Customer segment diversity: company size ranges from 18 to 110 people

