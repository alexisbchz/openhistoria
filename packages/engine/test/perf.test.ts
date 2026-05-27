import { describe, expect, it } from "vitest"

import { Game } from "../src/game"
import { useDeterministicEngine } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 1234,
})

/**
 * Sanity-check that the engine can sim a full mandate (~340 ticks with event
 * resolution) in well under one human second. Generous threshold so this
 * doesn't flake on slow CI runners — failure indicates we accidentally
 * introduced O(n²) work, not micro-regressions.
 */
const SOFT_BUDGET_MS = 2000

describe("engine perf", () => {
  it("completes a 1-year sim under 2s", () => {
    const t0 = performance.now()
    let game = Game.createNew().with({ paused: false })
    let safety = 5000
    while (!game.gameOver && safety-- > 0) {
      if (game.pendingEvent) {
        const choice = game.pendingEvent.choices[0]!
        game = game.resolveEventChoice(game.pendingEvent.id, choice.id)
        game = game.with({ paused: false })
        continue
      }
      game = game.tick(7)
    }
    const dt = performance.now() - t0
    expect(safety).toBeGreaterThan(0)
    expect(dt).toBeLessThan(SOFT_BUDGET_MS)
  })
})
