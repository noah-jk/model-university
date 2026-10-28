// What went wrong in a model call, safe to log and show: the HTTP status and
// Google's status name (like "429 RESOURCE_EXHAUSTED" when a quota is used
// up), picked from a fixed list. Never the error's message, which could
// quote the request.

const STATUS_NAMES = [
  "INVALID_ARGUMENT",
  "FAILED_PRECONDITION",
  "OUT_OF_RANGE",
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "NOT_FOUND",
  "RESOURCE_EXHAUSTED",
  "CANCELLED",
  "INTERNAL",
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
];

export function errorCode(error: unknown): string | undefined {
  const { status, message } = (error ?? {}) as { status?: unknown; message?: unknown };
  const name = typeof message === "string" ? STATUS_NAMES.find((n) => message.includes(n)) : undefined;
  const code = [typeof status === "number" ? String(status) : undefined, name].filter(Boolean).join(" ");
  return code || undefined;
}
