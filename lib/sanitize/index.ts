import { z } from "zod";

// =========================
// STRING SANITIZERS
// =========================

// Strip HTML tags and trim
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

// Remove null bytes and control characters
export function stripControlChars(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

// Sanitize a general text field — strip HTML + control chars
export function sanitizeText(value: string): string {
  return stripControlChars(stripHtml(value));
}

// Sanitize a UUID — reject anything that doesn't match UUID format
export function sanitizeUUID(value: string): string | null {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value.trim()) ? value.trim() : null;
}

// Sanitize a number — clamp to safe range
export function sanitizeNumber(
  value: unknown,
  min = 0,
  max = 1_000_000
): number | null {
  const num = Number(value);
  if (isNaN(num)) return null;
  return Math.min(max, Math.max(min, num));
}

// =========================
// OBJECT SANITIZER
// =========================

// Recursively sanitize all string values in an object
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeText(value);
    } else if (typeof value === "number") {
      result[key] = sanitizeNumber(value) ?? value;
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? sanitizeText(item)
          : typeof item === "object" && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// =========================
// ZOD SANITIZE MIDDLEWARE
// =========================

// Wrap any Zod schema to auto-sanitize string fields before parsing
export function withSanitization<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((input) => {
    if (input !== null && typeof input === "object" && !Array.isArray(input)) {
      return sanitizeObject(input as Record<string, unknown>);
    }
    return input;
  }, schema);
}

// =========================
// AI REQUEST SANITIZER
// =========================

// Sanitize AI prompt content before sending to model
export function sanitizePrompt(prompt: string): string {
  return sanitizeText(prompt)
    .replace(/\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?\b/gi, "")
    .replace(/\byou\s+are\s+now\s+a\b/gi, "")
    .replace(/\bact\s+as\s+(a|an)\b/gi, "")
    .replace(/\bdo\s+anything\s+now\b/gi, "")
    .trim();
}