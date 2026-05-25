import { z } from "zod";

export const SummarySchema = z.object({
  type: z.literal("summary"),
  client_id: z.string().min(1, "client_id is required"),
});

export const TimelineSchema = z.object({
  type: z.literal("timeline"),
  client_id: z.string().min(1, "client_id is required"),
});

export const ReportSchema = z.object({
  type: z.literal("report"),
  client_id: z.string().min(1, "client_id is required"),
});

export const NoteSchema = z.object({
  type: z.literal("note"),
  client_id: z.string().optional(),
  client_name: z.string().min(1, "client_name is required"),
  behaviors_observed: z.string().optional(),
  interventions_used: z.string().optional(),
  client_response: z.string().optional(),
  programs_targeted: z.string().optional(),
  date: z.string().optional(),
  staff_member: z.string().optional(),
});

export const WeeklySummarySchema = z.object({
  type: z.literal("weekly_summary"),
  total: z.number(),
  highRisk: z.number(),
  mediumRisk: z.number(),
  avgForecastScore: z.number(),
  escalationCount: z.number(),
});

export const AIRequestSchema = z.discriminatedUnion("type", [
  SummarySchema,
  TimelineSchema,
  ReportSchema,
  NoteSchema,
  WeeklySummarySchema,
]);

export type AIRequestInput = z.infer<typeof AIRequestSchema>;