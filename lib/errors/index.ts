// =========================
// APP ERROR SYSTEM
// =========================

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "AI_ERROR"
  | "DB_ERROR"
  | "BILLING_ERROR"
  | "JOB_ERROR"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      status?: number;
      context?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? statusFromCode(code);
    this.context = options?.context;

    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

// =========================
// TYPED CONSTRUCTORS
// =========================

export const Errors = {
  unauthorized(message = "Unauthorized") {
    return new AppError("UNAUTHORIZED", message, { status: 401 });
  },

  forbidden(message = "Forbidden") {
    return new AppError("FORBIDDEN", message, { status: 403 });
  },

  notFound(resource: string) {
    return new AppError("NOT_FOUND", `${resource} not found`, { status: 404 });
  },

  validation(message: string, context?: Record<string, unknown>) {
    return new AppError("VALIDATION_ERROR", message, { status: 400, context });
  },

  rateLimited(message = "Too many requests") {
    return new AppError("RATE_LIMITED", message, { status: 429 });
  },

  ai(message: string, cause?: unknown) {
    return new AppError("AI_ERROR", message, { status: 502, cause });
  },

  db(message: string, cause?: unknown) {
    return new AppError("DB_ERROR", message, { status: 500, cause });
  },

  billing(message: string) {
    return new AppError("BILLING_ERROR", message, { status: 402 });
  },

  job(message: string, cause?: unknown) {
    return new AppError("JOB_ERROR", message, { status: 500, cause });
  },

  internal(message = "Internal server error", cause?: unknown) {
    return new AppError("INTERNAL", message, { status: 500, cause });
  },
};

// =========================
// STATUS MAP
// =========================

function statusFromCode(code: ErrorCode): number {
  const map: Record<ErrorCode, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    RATE_LIMITED: 429,
    AI_ERROR: 502,
    DB_ERROR: 500,
    BILLING_ERROR: 402,
    JOB_ERROR: 500,
    INTERNAL: 500,
  };
  return map[code];
}

// =========================
// ROUTE HANDLER HELPER
// =========================

export function toErrorResponse(err: unknown): {
  error: string;
  code: ErrorCode | "INTERNAL";
  status: number;
} {
  if (err instanceof AppError) {
    return {
      error: err.message,
      code: err.code,
      status: err.status,
    };
  }

  const message =
    err instanceof Error ? err.message : "Internal server error";

  return {
    error: message,
    code: "INTERNAL",
    status: 500,
  };
}

// =========================
// TYPE GUARD
// =========================

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}