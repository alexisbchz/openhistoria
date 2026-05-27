import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { errAsync, okAsync, ResultAsync } from "neverthrow"
import type { z } from "zod"

export const DEFAULT_MODEL = "openai/gpt-4o-mini"
export const LLM_TIMEOUT_MS = 15_000

export type LlmError =
  | { kind: "missing_api_key" }
  | { kind: "timeout"; attempts: number }
  | { kind: "inference_failed"; cause: Error; attempts: number }

export interface RunLlmOptions<S extends z.ZodTypeAny> {
  apiKey: string
  schema: S
  system: string
  prompt: string
  /** Override the default model. */
  modelId?: string
  /** Per-call timeout. */
  timeoutMs?: number
  /** Total attempts (initial + retries). Default 2. */
  attempts?: number
}

/**
 * Run a structured-output LLM call with timeout + retry. Returns a
 * `ResultAsync<T, LlmError>` so callers can compose follow-up steps with
 * `.andThen` and map the error to a domain-appropriate fallback without ever
 * touching `try`/`catch`.
 */
export function runLlmObject<S extends z.ZodTypeAny>(
  opts: RunLlmOptions<S>
): ResultAsync<z.infer<S>, LlmError> {
  const attempts = Math.max(1, opts.attempts ?? 2)
  const timeoutMs = opts.timeoutMs ?? LLM_TIMEOUT_MS
  const openrouter = createOpenRouter({ apiKey: opts.apiKey })
  const model = openrouter.chat(opts.modelId ?? DEFAULT_MODEL)

  const attempt = (i: number): ResultAsync<z.infer<S>, LlmError> =>
    fromTimedPromise(
      generateObject({
        model,
        schema: opts.schema,
        system: opts.system,
        prompt: opts.prompt,
        abortSignal: makeAbortSignal(timeoutMs),
      }),
      timeoutMs,
      attempts
    )
      .map((result) => result.object as z.infer<S>)
      .orElse((error) => {
        if (i + 1 >= attempts) return errAsync(error)
        return ResultAsync.fromSafePromise(sleep(250 * (i + 1))).andThen(() =>
          attempt(i + 1)
        )
      })

  return attempt(0)
}

function fromTimedPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  attempts: number
): ResultAsync<T, LlmError> {
  return ResultAsync.fromPromise<T, LlmError>(promise, (cause) => {
    const e = cause instanceof Error ? cause : new Error(String(cause))
    if (e.name === "AbortError" || /timed?\s*out/i.test(e.message)) {
      return { kind: "timeout", attempts }
    }
    return { kind: "inference_failed", cause: e, attempts }
  })
}

function makeAbortSignal(timeoutMs: number): AbortSignal {
  const ac = new AbortController()
  setTimeout(() => ac.abort(new Error("LLM timeout")), timeoutMs)
  return ac.signal
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return fallback
}

export function describeLlmError(error: LlmError): string {
  switch (error.kind) {
    case "missing_api_key":
      return "OPENROUTER_API_KEY is not set"
    case "timeout":
      return `LLM call timed out after ${error.attempts} attempt(s)`
    case "inference_failed":
      return error.cause.message
  }
}

/** No-op helper used by routes that need an okAsync entry point. */
export function okStart<T>(value: T): ResultAsync<T, never> {
  return okAsync(value)
}