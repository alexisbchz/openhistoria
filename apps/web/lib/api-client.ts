import { errAsync, ResultAsync } from "neverthrow"

export type ApiError =
  | { kind: "network"; cause: Error }
  | { kind: "http"; status: number; message?: string }
  | { kind: "parse"; cause: Error }

export function describeApiError(error: ApiError, fallback = "Request failed"): string {
  switch (error.kind) {
    case "network":
      return error.cause.message || "Network error"
    case "http":
      return error.message || `HTTP ${error.status}`
    case "parse":
      return error.cause.message || fallback
  }
}

/**
 * Typed POST helper. Returns ResultAsync<T, ApiError> so callers can compose
 * follow-up steps and surface a single error path via `.match`. Never throws.
 */
export function postJson<T>(url: string, body: unknown): ResultAsync<T, ApiError> {
  return ResultAsync.fromPromise<Response, ApiError>(
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    (cause) => ({
      kind: "network",
      cause: cause instanceof Error ? cause : new Error(String(cause)),
    })
  ).andThen((res) => {
    if (!res.ok) {
      return ResultAsync.fromSafePromise(
        res.json().catch(() => ({}))
      ).andThen((maybeBody: unknown) => {
        const message =
          maybeBody &&
          typeof maybeBody === "object" &&
          "error" in maybeBody &&
          typeof (maybeBody as { error: unknown }).error === "string"
            ? (maybeBody as { error: string }).error
            : undefined
        return errAsync<T, ApiError>({
          kind: "http",
          status: res.status,
          message,
        })
      })
    }
    return ResultAsync.fromPromise<T, ApiError>(
      res.json() as Promise<T>,
      (cause) => ({
        kind: "parse",
        cause: cause instanceof Error ? cause : new Error(String(cause)),
      })
    )
  })
}
