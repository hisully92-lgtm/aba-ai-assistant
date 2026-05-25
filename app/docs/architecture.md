# Architecture

## System Design
All AI operations flow through a single unified dispatcher route, with four dedicated sub-routes for specific features.

## Routes

### POST /api/ai
The main dispatcher. Accepts a `type` field and routes to the correct handler.

Rate limit: 100 requests/min (by IP)

Types:
- `note` → handleSessionNote
- `summary` → handleClientSummary
- `timeline` → handleClientTimeline
- `report` → handleExportReport

### POST /api/session-note
Generates a clinical ABA session note.
Feature flag: `ai_notes`
Rate limit: 20 requests/min (by user)
Inputs: `client_id`, `client_name`, `behaviors_observed`, `interventions_used`, `client_response`, `programs_targeted`, `date`, `staff_member`
Returns: `{ success: true, jobId }`

### POST /api/client-summary
Analyzes last 20 sessions and produces a clinical summary.
Feature flag: `ai_summary`
Rate limit: 20 requests/min (by user)
Inputs: `client_id`
Returns: `{ success: true, jobId }`

### POST /api/client-timeline
Analyzes up to 50 sessions in chronological order.
Feature flag: `client_timeline`
Rate limit: 20 requests/min (by user)
Inputs: `client_id`
Returns: `{ success: true, jobId }`

### POST /api/export-report
Generates a structured clinical export report from last 30 sessions.
Feature flag: `export_reports`
Rate limit: 20 requests/min (by user)
Inputs: `client_id`
Returns: `{ success: true, jobId }`

## Job Queue
All AI routes create async jobs via `createJob()`. Results are not returned directly — they are processed by the queue worker and cached.

## Caching
Cache keys:
- `ai:session-note:{client_id}:{date}`
- `ai:client-summary:{client_id}`
- `ai:client-timeline:{client_id}`
- `ai:export-report:{client_id}`

## Security
- All routes require authentication via Supabase
- All routes require Pro tier via `requirePro()`
- PHI fields are encrypted at rest and decrypted at the AI boundary via `safeDecrypt()`
- Session notes are flagged `containsPHI: true` in the job payload
- All actions are logged via `logEvent()` and `logAudit()`

## Folder Structure
/app
/docs
  /api
    ai.md
  architecture.md
  overview.md
/lib
  /billing
  /cache
  /features
  /observability
  /queue
  /rate-limit
  /security
  /supabase
README.md