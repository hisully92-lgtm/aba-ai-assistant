# Project Overview

## What is this?
An AI-powered ABA (Applied Behavior Analysis) therapy assistant that generates clinical documentation for therapists and staff.

## How it works
All AI operations are submitted through dedicated routes. Each route validates the user, checks feature flags, applies rate limiting, decrypts PHI, builds a prompt, and queues an async job. Results are cached and returned on subsequent requests.

## Features
| Feature | Route | Flag |
|---|---|---|
| Session Notes | POST /api/session-note | `ai_notes` |
| Client Summary | POST /api/client-summary | `ai_summary` |
| Client Timeline | POST /api/client-timeline | `client_timeline` |
| Export Report | POST /api/export-report | `export_reports` |

## Access Control
- All features require a Pro subscription
- All features are gated by feature flags
- All PHI is encrypted at rest and decrypted only at the AI boundary

## Key Libraries
- `supabaseAdmin` — database + auth
- `rateLimit` — per-user and per-IP throttling
- `requirePro` — billing enforcement
- `hasFeature` — feature flag checks
- `createJob` — async job queue
- `getCache` — result caching
- `decrypt` / `safeDecrypt` — PHI encryption
- `logEvent` / `logAudit` — observability

## Docs
- API reference: `/docs/api/ai.md`
- Architecture: `/docs/architecture.md`