import { describe, expect, it } from "vitest"

import { Game } from "../src/game"
import { useDeterministicEngine, tickDays } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 11,
})

describe("Game bankruptcy", () => {
  it("ends the game with cause=bankruptcy when treasury stays catastrophically negative", () => {
    let game = Game.createNew().with({ paused: false, treasury: -600_000 })
    // Tick a month at a time; bankruptcy trips at 30 days underwater.
    for (let i = 0; i < 6 && !game.gameOver; i++) {
      // Resolve any pending event quickly so the tick can keep advancing.
      if (game.pendingEvent) {
        const choice = game.pendingEvent.choices[0]!
        game = game.resolveEventChoice(game.pendingEvent.id, choice.id)
        game = game.with({ paused: false })
      }
      game = tickDays(game, 10)
    }
    expect(game.gameOver).not.toBeNull()
    expect(game.gameOver?.outcome).toBe("lost")
    expect(game.gameOver?.cause).toBe("bankruptcy")
  })

  it("does not trip bankruptcy when treasury recovers", () => {
    let game = Game.createNew().with({ paused: false, treasury: -600_000 })
    game = tickDays(game, 5)
    expect(game.bankruptcyDays).toBeGreaterThan(0)
    // Recover.
    game = game.with({ treasury: 5_000 })
    game = tickDays(game, 5)
    expect(game.bankruptcyDays).toBe(0)
    expect(game.gameOver).toBeNull()
  })
})

describe("Game impeachment", () => {
  it("ends the game with cause=impeachment when approval stays below the floor", () => {
    let game = Game.createNew().with({ paused: false, approval: 8 })
    for (let i = 0; i < 6 && !game.gameOver; i++) {
      if (game.pendingEvent) {
        const choice = game.pendingEvent.choices[0]!
        game = game.resolveEventChoice(game.pendingEvent.id, choice.id)
        game = game.with({ paused: false })
      }
      // Pin approval down — drift would otherwise pull it up toward 35.
      game = game.with({ approval: 8 })
      game = tickDays(game, 10)
    }
    expect(game.gameOver).not.toBeNull()
    expect(game.gameOver?.cause).toBe("impeachment")
  })
})

describe("weekly history", () => {
  it("samples treasury/approval/gdp at weekly cadence", () => {
    let game = Game.createNew().with({ paused: false })
    const before = game.history.length
    game = tickDays(game, 30)
    expect(game.history.length).toBeGreaterThan(before)
    const last = game.history[game.history.length - 1]!
    expect(typeof last.treasury).toBe("number")
    expect(typeof last.approval).toBe("number")
    expect(last.gdpUsd).toBeGreaterThan(0)
  })
})
