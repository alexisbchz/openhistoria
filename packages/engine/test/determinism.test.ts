import { describe, expect, it } from "vitest"

import {
  makeDeterministicClock,
  resetClock,
  setClock,
} from "../src/clock"
import { Game } from "../src/game"

describe("engine determinism", () => {
  it("produces the same snapshot from the same seed after 200 ticks", () => {
    function runOnce(seed: number) {
      const clock = makeDeterministicClock({
        idPrefix: "id",
        seed,
        startDate: new Date("2026-05-21T08:00:00.000Z"),
      })
      setClock(clock)
      try {
        let game = Game.createNew().with({ paused: false })
        for (let i = 0; i < 200; i++) {
          if (game.pendingEvent) {
            game = game.resolveEventChoice(
              game.pendingEvent.id,
              game.pendingEvent.choices[0]!.id
            )
            game = game.with({ paused: false })
            continue
          }
          if (game.gameOver) break
          game = game.tick(1)
        }
        return game.toSnapshot()
      } finally {
        resetClock()
      }
    }
    const a = runOnce(42)
    const b = runOnce(42)
    // Briefing ids are deterministic via the clock counter, so snapshots
    // should be byte-identical after JSON round-trip.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it("different seeds produce different runs", () => {
    function runOnce(seed: number) {
      const clock = makeDeterministicClock({
        idPrefix: "id",
        seed,
        startDate: new Date("2026-05-21T08:00:00.000Z"),
      })
      setClock(clock)
      try {
        let game = Game.createNew().with({ paused: false })
        for (let i = 0; i < 60; i++) {
          if (game.pendingEvent) {
            game = game.resolveEventChoice(
              game.pendingEvent.id,
              game.pendingEvent.choices[0]!.id
            )
            game = game.with({ paused: false })
            continue
          }
          if (game.gameOver) break
          game = game.tick(1)
        }
        return game.toSnapshot()
      } finally {
        resetClock()
      }
    }
    const a = runOnce(1)
    const b = runOnce(2)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })
})
