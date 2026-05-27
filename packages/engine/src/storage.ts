import { Game, type GameSnapshot } from "./game"

const STORAGE_KEY = "openhistoria:save"
const QUARANTINE_KEY = "openhistoria:save.bak"

export interface LoadGameResult {
  game: Game | null
  /** True if a save was present but couldn't be parsed; original is in `quarantineKey`. */
  corrupted?: boolean
  quarantineKey?: string
  error?: string
}

export function saveGame(game: Game): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game.toSnapshot()))
  } catch (err) {
    // Most common cause: quota exceeded. Don't crash the tick loop.
    if (typeof console !== "undefined") {
      console.warn("[openhistoria] saveGame failed", err)
    }
  }
}

export function loadGame(): Game | null {
  return loadGameWithStatus().game
}

/**
 * Detailed loader. If the stored save is corrupt or fails migration it gets
 * moved to `openhistoria:save.bak` so the player can recover it; the main slot
 * is wiped so the next bootstrap creates a clean game instead of looping on
 * the same broken blob.
 */
export function loadGameWithStatus(): LoadGameResult {
  if (typeof window === "undefined") return { game: null }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return { game: null }
  try {
    const snapshot = JSON.parse(raw) as GameSnapshot
    const game = Game.fromSnapshot(snapshot)
    return { game }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (typeof console !== "undefined") {
      console.warn("[openhistoria] corrupt save quarantined", message)
    }
    try {
      window.localStorage.setItem(QUARANTINE_KEY, raw)
    } catch {
      // Quota / other; the original is still in STORAGE_KEY for forensics.
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    return {
      game: null,
      corrupted: true,
      quarantineKey: QUARANTINE_KEY,
      error: message,
    }
  }
}

export function clearGame(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function clearQuarantine(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(QUARANTINE_KEY)
}
