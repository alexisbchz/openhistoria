import { Game, type GameSnapshot } from "./game"

const STORAGE_KEY = "openhistoria:save"

export function saveGame(game: Game): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game.toSnapshot()))
}

export function loadGame(): Game | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const snapshot = JSON.parse(raw) as GameSnapshot
    return Game.fromSnapshot(snapshot)
  } catch {
    return null
  }
}

export function clearGame(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}
