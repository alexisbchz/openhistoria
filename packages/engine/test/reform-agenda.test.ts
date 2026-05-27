import { describe, expect, it } from "vitest"

import { evaluateReformAgenda, Game, REFORM_AGENDAS } from "../src/game"
import { useDeterministicEngine } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 4,
})

describe("REFORM_AGENDAS", () => {
  it("exposes three distinct ids", () => {
    const ids = new Set(REFORM_AGENDAS.map((a) => a.id))
    expect(ids.size).toBe(3)
  })
})

describe("setReformAgenda", () => {
  it("stores the chosen agenda and logs a briefing", () => {
    const game = Game.createNew().setReformAgenda("fiscal_discipline")
    expect(game.reformAgenda?.id).toBe("fiscal_discipline")
    expect(game.briefing[0]?.title).toContain("Fiscal discipline")
  })

  it("ignores re-setting the same agenda", () => {
    const game = Game.createNew().setReformAgenda("social_renewal")
    const again = game.setReformAgenda("social_renewal")
    expect(again).toBe(game)
  })
})

describe("evaluateReformAgenda", () => {
  it("returns false when no agenda is set", () => {
    expect(evaluateReformAgenda(Game.createNew())).toBe(false)
  })

  it("succeeds on european_leadership with EU allies + positive average opinion", () => {
    const game = Game.createNew()
      .setReformAgenda("european_leadership")
      .proposeAlliance("DE")
      .proposeAlliance("GB")
      .with({
        relations: {
          DE: { opinion: 80, allied: true, lastInteractionAt: null },
          GB: { opinion: 80, allied: true, lastInteractionAt: null },
          IT: { opinion: 40, allied: false, lastInteractionAt: null },
          ES: { opinion: 40, allied: false, lastInteractionAt: null },
        },
      })
    expect(evaluateReformAgenda(game)).toBe(true)
  })

  it("fails on european_leadership when opinions are sour", () => {
    const game = Game.createNew().setReformAgenda("european_leadership")
    expect(evaluateReformAgenda(game)).toBe(false)
  })
})
