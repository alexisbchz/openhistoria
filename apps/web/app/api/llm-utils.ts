import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import type { z } from "zod"

export const DEFAULT_MODEL = "openai/gpt-4o-mini"
export const LLM_TIMEOUT_MS = 15_000

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
 * Wraps `generateObject` with a timeout and a single retry so transient
 * OpenRouter slowness / 5xx blips don't surface as 502s to the player.
 * Caller still catches the final throw to apply a domain-specific fallback.
 */
export async function runLlmObject<S extends z.ZodTypeAny>(
  opts: RunLlmOptions<S>
): Promise<z.infer<S>> {
  const attempts = Math.max(1, opts.attempts ?? 2)
  const timeoutMs = opts.timeoutMs ?? LLM_TIMEOUT_MS
  const openrouter = createOpenRouter({ apiKey: opts.apiKey })
  const model = openrouter.chat(opts.modelId ?? DEFAULT_MODEL)

  let lastError: unknown = null
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(new Error("LLM timeout")), timeoutMs)
    try {
      const result = await generateObject({
        model,
        schema: opts.schema,
        system: opts.system,
        prompt: opts.prompt,
        abortSignal: ac.signal,
      })
      clearTimeout(timer)
      return result.object as z.infer<S>
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      // No need to retry on the final attempt; let the caller decide.
      if (i < attempts - 1) {
        await sleep(250 * (i + 1))
        continue
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("LLM call failed after retries")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return fallback
}
