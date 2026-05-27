import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Game } from "../src/game"
import {
  clearGame,
  clearQuarantine,
  clearSlot,
  listSaveSlots,
  loadFromSlot,
  loadGame,
  loadGameResult,
  loadGameWithStatus,
  saveGame,
  saveToSlot,
} from "../src/storage"
import { useDeterministicEngine } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 1,
})

// Vitest defaults to a `node` environment; jsdom is not available here, so we
// install a small in-memory localStorage stand-in on globalThis.window.
function installFakeWindow() {
  const store = new Map<string, string>()
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size
      },
      clear: () => store.clear(),
    },
  }
  return store
}

describe("storage round-trip", () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installFakeWindow()
  })

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it("saveGame + loadGame restores the same state", () => {
    const a = Game.createNew()
      .with({ paused: false, treasury: 1234 })
      .proposeAlliance("GB")
    saveGame(a)
    const b = loadGame()!
    expect(b).not.toBeNull()
    expect(b.treasury).toBe(1234)
    expect(b.getRelation("GB").allied).toBe(true)
    expect(b.toSnapshot().version).toBe(5)
  })

  it("quarantines a corrupt save and returns null", () => {
    store.set("openhistoria:save", "{not valid json")
    const result = loadGameWithStatus()
    expect(result.game).toBeNull()
    expect(result.corrupted).toBe(true)
    expect(result.quarantineKey).toBe("openhistoria:save.bak")
    expect(store.has("openhistoria:save")).toBe(false)
    expect(store.get("openhistoria:save.bak")).toBe("{not valid json")
  })

  it("returns null without quarantine when no save exists", () => {
    const result = loadGameWithStatus()
    expect(result.game).toBeNull()
    expect(result.corrupted).toBeUndefined()
  })

  it("clearGame and clearQuarantine wipe their slots", () => {
    saveGame(Game.createNew())
    store.set("openhistoria:save.bak", "junk")
    clearGame()
    clearQuarantine()
    expect(store.has("openhistoria:save")).toBe(false)
    expect(store.has("openhistoria:save.bak")).toBe(false)
  })

  it("loadGameResult exposes a discriminated Result", () => {
    // Happy path returns ok with the game.
    saveGame(Game.createNew().with({ treasury: 999 }))
    const ok = loadGameResult()
    expect(ok.isOk()).toBe(true)
    if (ok.isOk()) {
      expect(ok.value?.treasury).toBe(999)
    }
  })

  it("loadGameResult returns err with parse_error and quarantines on bad JSON", () => {
    store.set("openhistoria:save", "{nope")
    const result = loadGameResult()
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.kind).toBe("parse_error")
    }
    expect(store.has("openhistoria:save")).toBe(false)
    expect(store.has("openhistoria:save.bak")).toBe(true)
  })

  it("saveGame returns a Result; mapping happens via the ok branch", () => {
    const result = saveGame(Game.createNew())
    expect(result.isOk()).toBe(true)
  })

  it("save slots: write / list / load / clear round-trip", () => {
    const game = Game.createNew().with({ treasury: 7777 })
    const saved = saveToSlot("slot-1", game, "Mid-term")
    expect(saved.isOk()).toBe(true)

    const list = listSaveSlots()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe("slot-1")
    expect(list[0]?.label).toBe("Mid-term")
    expect(list[0]?.savedAt).toMatch(/T/)

    const loaded = loadFromSlot("slot-1")
    expect(loaded.isOk()).toBe(true)
    if (loaded.isOk() && loaded.value) {
      expect(loaded.value.treasury).toBe(7777)
    }

    clearSlot("slot-1")
    expect(listSaveSlots()).toHaveLength(0)
  })

  it("save slots: empty slot returns ok(null)", () => {
    const result = loadFromSlot("slot-2")
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBeNull()
  })

  it("sanitises NaN/Infinity in stored stats on load", () => {
    const game = Game.createNew()
    const snapshot = game.toSnapshot()
    snapshot.stats.economy.gdpUsd = Number.NaN
    snapshot.stats.economy.unemploymentPct = Number.POSITIVE_INFINITY
    snapshot.stats.demographics.population = 0
    store.set("openhistoria:save", JSON.stringify(snapshot))
    const loaded = loadGame()!
    expect(Number.isFinite(loaded.stats.economy.gdpUsd)).toBe(true)
    expect(loaded.stats.economy.unemploymentPct).toBeLessThanOrEqual(100)
    expect(loaded.stats.demographics.population).toBeGreaterThanOrEqual(1)
  })
})
