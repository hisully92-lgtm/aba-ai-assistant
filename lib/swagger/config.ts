import { createSwaggerSpec } from "next-swagger-doc";

export function getSwaggerSpec() {
  return createSwaggerSpec({
    apiFolder: "app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "ABA AI Assistant API",
        version: "1.0.0",
        description: "Clinical AI platform API — ABA session notes, summaries, timelines, reports, and supervisor workflows.",
      },
      servers: [
        {
          url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          description: "Primary server",
        },
      ],
      tags: [
        { name: "AI", description: "AI generation endpoints" },
        { name: "Reports", description: "PDF report generation" },
        { name: "Jobs", description: "Background job status" },
        { name: "Worker", description: "Job queue processing" },
        { name: "Health", description: "System health checks" },
        { name: "Migrations", description: "Database migrations" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Supabase JWT token",
          },
        },
        schemas: {
          AIRequest: {
            type: "object",
            discriminator: { propertyName: "type" },
            oneOf: [
              { "$ref": "#/components/schemas/SummaryRequest" },
              { "$ref": "#/components/schemas/TimelineRequest" },
              { "$ref": "#/components/schemas/ReportRequest" },
              { "$ref": "#/components/schemas/NoteRequest" },
              { "$ref": "#/components/schemas/WeeklySummaryRequest" },
            ],
          },
          SummaryRequest: {
            type: "object",
            required: ["type", "client_id"],
            properties: {
              type: { type: "string", enum: ["summary"] },
              client_id: { type: "string", format: "uuid" },
            },
          },
          TimelineRequest: {
            type: "object",
            required: ["type", "client_id"],
            properties: {
              type: { type: "string", enum: ["timeline"] },
              client_id: { type: "string", format: "uuid" },
            },
          },
          ReportRequest: {
            type: "object",
            required: ["type", "client_id"],
            properties: {
              type: { type: "string", enum: ["report"] },
              client_id: { type: "string", format: "uuid" },
            },
          },
          NoteRequest: {
            type: "object",
            required: ["type", "client_name", "behaviors_observed"],
            properties: {
              type: { type: "string", enum: ["note"] },
              client_id: { type: "string", format: "uuid" },
              client_name: { type: "string" },
              behaviors_observed: { type: "string" },
              interventions_used: { type: "string" },
              client_response: { type: "string" },
              programs_targeted: { type: "string" },
              date: { type: "string", format: "date" },
              staff_member: { type: "string" },
            },
          },
          WeeklySummaryRequest: {
            type: "object",
            required: ["type", "total", "highRisk", "mediumRisk", "avgForecastScore", "escalationCount"],
            properties: {
              type: { type: "string", enum: ["weekly_summary"] },
              total: { type: "integer" },
              highRisk: { type: "integer" },
              mediumRisk: { type: "integer" },
              avgForecastScore: { type: "number" },
              escalationCount: { type: "integer" },
            },
          },
          AIResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              jobId: { type: "string", format: "uuid" },
              result: { type: "string" },
              cached: { type: "boolean" },
              error: { type: "string" },
              code: { type: "string" },
            },
          },
          ErrorResponse: {
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string" },
              details: { type: "object" },
            },
          },
          JobStatus: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              type: { type: "string" },
              status: { type: "string", enum: ["pending", "processing", "complete", "failed", "dead"] },
              result: { type: "object" },
              error: { type: "string" },
              attempts: { type: "integer" },
              created_at: { type: "string", format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
            },
          },
        },
      },
      paths: {
        "/api/ai": {
          post: {
            tags: ["AI"],
            summary: "Unified AI request endpoint",
            description: "Handles all AI generation requests — summary, timeline, report, note, weekly_summary.",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { "$ref": "#/components/schemas/AIRequest" },
                  examples: {
                    summary: {
                      summary: "Client summary",
                      value: { type: "summary", client_id: "uuid-here" },
                    },
                    note: {
                      summary: "Session note",
                      value: {
                        type: "note",
                        client_name: "John Doe",
                        behaviors_observed: "Aggression toward peers",
                        interventions_used: "Redirection",
                        client_response: "Responded well",
                        programs_targeted: "Social skills",
                        date: "2026-01-01",
                        staff_member: "Jane Smith",
                      },
                    },
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "AI job queued or result returned",
                content: {
                  "application/json": {
                    schema: { "$ref": "#/components/schemas/AIResponse" },
                  },
                },
              },
              "400": {
                description: "Validation error",
                content: {
                  "application/json": {
                    schema: { "$ref": "#/components/schemas/ErrorResponse" },
                  },
                },
              },
              "401": { description: "Unauthorized" },
              "403": { description: "Pro plan required" },
              "429": { description: "Rate limit exceeded" },
              "500": { description: "Internal server error" },
            },
          },
        },
        "/api/reports": {
          post: {
            tags: ["Reports"],
            summary: "Generate analytics PDF report",
            description: "Generates a PDF clinical report for a client and saves to clinical_reports.",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["client_id"],
                    properties: {
                      client_id: { type: "string", format: "uuid" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "PDF file returned" },
              "404": { description: "Client not found" },
              "500": { description: "Report generation failed" },
            },
          },
        },
        "/api/jobs": {
          get: {
            tags: ["Jobs"],
            summary: "Get job status",
            description: "Returns the current status and result of a background job.",
            parameters: [
              {
                name: "id",
                in: "query",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "Job ID",
              },
            ],
            responses: {
              "200": {
                description: "Job details",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        job: { "$ref": "#/components/schemas/JobStatus" },
                      },
                    },
                  },
                },
              },
              "400": { description: "Missing jobId" },
              "404": { description: "Job not found" },
            },
          },
        },
        "/api/queue/worker": {
          post: {
            tags: ["Worker"],
            summary: "Process pending jobs",
            description: "Runs the job queue worker. Called by Vercel cron or manually with worker secret.",
            parameters: [
              {
                name: "x-worker-secret",
                in: "header",
                required: false,
                schema: { type: "string" },
                description: "Worker secret for manual invocation",
              },
            ],
            responses: {
              "200": {
                description: "Worker run complete",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        processed: { type: "integer" },
                        succeeded: { type: "integer" },
                        failed: { type: "integer" },
                        skipped: { type: "integer" },
                      },
                    },
                  },
                },
              },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/api/health": {
          get: {
            tags: ["Health"],
            summary: "System health check",
            description: "Validates all required environment secrets are present.",
            responses: {
              "200": {
                description: "System healthy",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        status: { type: "string", enum: ["healthy", "degraded"] },
                        secrets: {
                          type: "object",
                          properties: {
                            valid: { type: "boolean" },
                            missing: { type: "array", items: { type: "string" } },
                            warnings: { type: "array", items: { type: "string" } },
                          },
                        },
                        timestamp: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/api/migrate": {
          post: {
            tags: ["Migrations"],
            summary: "Run database migrations",
            description: "Runs any pending schema migrations. Requires worker secret.",
            parameters: [
              {
                name: "x-migrate-secret",
                in: "header",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "Migration results",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        ran: { type: "array", items: { type: "string" } },
                        skipped: { type: "array", items: { type: "string" } },
                        failed: { type: "array", items: { type: "string" } },
                      },
                    },
                  },
                },
              },
              "401": { description: "Unauthorized" },
            },
          },
        },
      },
    },
  });
}