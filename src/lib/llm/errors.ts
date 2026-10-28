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

// For a 400 (the request was rejected as malformed), Google's one-line
// message says which setting it didn't accept, which no status name can.
// It's logged with any text from the request removed (the search, and
// record names in a summary prompt), cut to 200 characters. Nothing else
// from an error is kept.
export function badRequestDetail(error: unknown, requestText: string[]): string | undefined {
  const { status, message } = (error ?? {}) as { status?: unknown; message?: unknown };
  if (status !== 400 || typeof message !== "string") return undefined;
  let detail = message;
  try {
    // The SDK's message is often Google's JSON error body
    const parsed = JSON.parse(message) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string") detail = parsed.error.message;
  } catch {}
  for (const text of requestText) {
    const words = text.trim();
    if (words.length > 2) detail = detail.split(words).join("[request text]");
  }
  return detail.replace(/\s+/g, " ").trim().slice(0, 200) || undefined;
}
