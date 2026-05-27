import { describe, expect, it } from "vitest"

import { simulateAiTick } from "../src/ai-nations"
import type { RelationState } from "../src/game"
import { useDeterministicEngine } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 17,
})

const DATE = new Date("2026-06-01T00:00:00.000Z")

function rel(opinion: number, allied = false): RelationState {
  return { opinion, allied, lastInteractionAt: null }
}

describe("AI economic actions", () => {
  it("eventually fires a trade_deal or foreign_investment for a friendly nation", () => {
    let relations: Record<string, RelationState> = { US: rel(70) }
    let fired = false
    for (let q = 0; q < 8 && !fired; q++) {
      const result = simulateAiTick({
        days: 90,
        playerNation: "FR",
        relations,
        currentDate: new Date(DATE.getTime() + q * 90 * 86_400_000),
      })
      relations = result.relations
      if (
        result.actions.some(
          (a) =>
            a.code === "US" &&
            (a.kind === "trade_deal" || a.kind === "foreign_investment")
        )
      ) {
        fired = true
      }
    }
    expect(fired).toBe(true)
  })

  it("eventually fires a sanctions or tariffs action for a hostile nation", () => {
    let relations: Record<string, RelationState> = { RU: rel(-70) }
    let fired = false
    for (let q = 0; q < 8 && !fired; q++) {
      const result = simulateAiTick({
        days: 90,
        playerNation: "FR",
        relations,
        currentDate: new Date(DATE.getTime() + q * 90 * 86_400_000),
      })
      relations = result.relations
      if (
        result.actions.some(
          (a) =>
            a.code === "RU" &&
            (a.kind === "sanctions" || a.kind === "tariffs")
        )
      ) {
        fired = true
      }
    }
    expect(fired).toBe(true)
  })

  it("respects the economic-action cooldown", () => {
    // Set lastEconomicActionAt to today; the next 30-day tick should not fire
    // a second economic action against the same nation.
    let relations: Record<string, RelationState> = {
      US: {
        opinion: 80,
        allied: false,
        lastInteractionAt: DATE.toISOString(),
        lastEconomicActionAt: DATE.toISOString(),
      },
    }
    let fired = 0
    for (let i = 0; i < 30; i++) {
      const result = simulateAiTick({
        days: 1,
        playerNation: "FR",
        relations,
        currentDate: new Date(DATE.getTime() + (i + 1) * 86_400_000),
      })
      relations = result.relations
      fired += result.actions.filter(
        (a) =>
          a.code === "US" &&
          (a.kind === "trade_deal" || a.kind === "foreign_investment")
      ).length
    }
    expect(fired).toBe(0)
  })
})
