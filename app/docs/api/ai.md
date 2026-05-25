# AI API

## Dispatcher Route

POST /api/ai

Rate limit: 100 requests/min (by IP)
Auth: not required at dispatcher level (handled per sub-route)

---

## Types

### note

POST /api/ai
POST /api/session-note

Body:
{
  "type": "note",
  "client_name": "string",
  "behaviors_observed": "string",
  "interventions_used": "string",
  "client_response": "string",
  "programs_targeted": "string",
  "date": "string",
  "staff_member": "string"
}

Returns:
{
  "success": true,
  "jobId": "uuid"
}

Feature flag: ai_notes
Rate limit: 20 requests/min (by user)
PHI: true — decrypted at AI boundary

---

### summary

POST /api/ai
POST /api/client-summary

Body:
{
  "type": "summary",
  "client_id": "string"
}

Returns:
{
  "success": true,
  "jobId": "uuid"
}

Feature flag: ai_summary
Rate limit: 20 requests/min (by user)
Sessions analyzed: last 20 (descending)

---

### timeline

POST /api/ai
POST /api/client-timeline

Body:
{
  "type": "timeline",
  "client_id": "string"
}

Returns:
{
  "success": true,
  "jobId": "uuid"
}

Feature flag: client_timeline
Rate limit: 20 requests/min (by user)
Sessions analyzed: up to 50 (ascending/chronological)

---

### report

POST /api/ai
POST /api/export-report

Body:
{
  "type": "report",
  "client_id": "string"
}

Returns:
{
  "success": true,
  "jobId": "uuid"
}

Feature flag: export_reports
Rate limit: 20 requests/min (by user)
Sessions analyzed: last 30 (descending)

---

## Shared Behaviors

All routes:
- Require Pro subscription
- Require valid Supabase session
- Check feature flag before processing
- Return cached result if available (cached: true)
- Queue async job via createJob()
- Log via logEvent() and logAudit()

## Error Responses

401 — Unauthorized (no session)
403 — Feature not available (flag disabled or not Pro)
400 — Missing required fields
429 — Rate limit exceeded
500 — Internal server error