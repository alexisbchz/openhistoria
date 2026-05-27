import { err, ok, Result } from "neverthrow"

import { Game, type GameSnapshot } from "./game"

const STORAGE_KEY = "openhistoria:save"
const QUARANTINE_KEY = "openhistoria:save.bak"

export type StorageError =
  | { kind: "no_window" }
  | { kind: "empty" }
  | { kind: "parse_error"; raw: string; cause: Error; quarantineKey: string }
  | { kind: "migration_error"; raw: string; cause: Error; quarantineKey: string }
  | { kind: "quota_exceeded"; cause: Error }

export interface LoadGameResult {
  game: Game | null
  /** True if a save was present but couldn't be parsed. */
  corrupted?: boolean
  quarantineKey?: string
  error?: string
}

/**
 * Persist a snapshot. Returns ok(void) on success, or err for a quota/blocked
 * write. Callers can choose to log; this never throws.
 */
export function saveGame(game: Game): Result<void, StorageError> {
  if (typeof window === "undefined") return err({ kind: "no_window" })
  return Result.fromThrowable(
    (snapshot: string) => window.localStorage.setItem(STORAGE_KEY, snapshot),
    toQuotaError
  )(JSON.stringify(game.toSnapshot())).map(() => undefined)
}

/**
 * Best-effort load. Returns ok(null) when no save exists, ok(Game) on a clean
 * read, and err(parse_error/migration_error) when the stored blob is broken.
 * On the error paths the broken blob is moved to QUARANTINE_KEY so it isn't
 * silently lost.
 */
export function loadGameResult(): Result<Game | null, StorageError> {
  if (typeof window === "undefined") return err({ kind: "no_window" })
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return ok(null)

  const parsed = Result.fromThrowable(
    (s: string) => JSON.parse(s) as GameSnapshot,
    (e) => toQuarantineError("parse_error", raw, e)
  )(raw)
  if (parsed.isErr()) {
    quarantine(raw)
    return err(parsed.error)
  }

  const built = Result.fromThrowable(
    (s: GameSnapshot) => Game.fromSnapshot(s),
    (e) => toQuarantineError("migration_error", raw, e)
  )(parsed.value)
  if (built.isErr()) {
    quarantine(raw)
    return err(built.error)
  }
  return ok(built.value)
}

/**
 * Backwards-compatible adaptor for call sites that want the old "Game or null"
 * shape. Prefer `loadGameResult` in new code.
 */
export function loadGame(): Game | null {
  const r = loadGameResult()
  return r.isOk() ? r.value : null
}

export function loadGameWithStatus(): LoadGameResult {
  const result = loadGameResult()
  if (result.isOk()) {
    return { game: result.value }
  }
  const e = result.error
  if (e.kind === "no_window" || e.kind === "empty") return { game: null }
  if (e.kind === "parse_error" || e.kind === "migration_error") {
    if (typeof console !== "undefined") {
      console.warn("[openhistoria] corrupt save quarantined", e.cause.message)
    }
    return {
      game: null,
      corrupted: true,
      quarantineKey: e.quarantineKey,
      error: e.cause.message,
    }
  }
  return { game: null, error: e.cause.message }
}

export function clearGame(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function clearQuarantine(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(QUARANTINE_KEY)
}

function quarantine(raw: string): void {
  if (typeof window === "undefined") return
  // Both writes are best-effort; if quota is full we still want to clear the
  // main slot so the next bootstrap doesn't loop on the same broken blob.
  Result.fromThrowable(
    () => window.localStorage.setItem(QUARANTINE_KEY, raw),
    () => undefined
  )()
  Result.fromThrowable(
    () => window.localStorage.removeItem(STORAGE_KEY),
    () => undefined
  )()
}

function toQuarantineError(
  kind: "parse_error" | "migration_error",
  raw: string,
  cause: unknown
): StorageError {
  return {
    kind,
    raw,
    cause: cause instanceof Error ? cause : new Error(String(cause)),
    quarantineKey: QUARANTINE_KEY,
  }
}

function toQuotaError(cause: unknown): StorageError {
  return {
    kind: "quota_exceeded",
    cause: cause instanceof Error ? cause : new Error(String(cause)),
  }
}
