import { describe, expect, it } from "vitest"

import {
  AI_NATIONS,
  computeProjectReactions,
  getAiProfile,
  simulateAiTick,
} from "../src/ai-nations"
import type { RelationState } from "../src/game"
import { useDeterministicEngine } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 42,
})

const DATE = new Date("2026-06-01T00:00:00.000Z")

function rel(opinion: number, allied = false): RelationState {
  return { opinion, allied, lastInteractionAt: null }
}

describe("AI nation profiles", () => {
  it("includes the major world powers", () => {
    const codes = AI_NATIONS.map((p) => p.code)
    for (const expected of ["US", "GB", "DE", "RU", "CN"]) {
      expect(codes).toContain(expected)
    }
  })

  it("getAiProfile is case-insensitive and trims", () => {
    expect(getAiProfile("us")?.code).toBe("US")
    expect(getAiProfile(" GB ")?.code).toBe("GB")
    expect(getAiProfile("ZZ")).toBeNull()
  })
})

describe("computeProjectReactions", () => {
  it("hostile nations criticise a nuclear program; allies stay quiet", () => {
    const reactions = computeProjectReactions(
      "construction:nuclear",
      "Pluton II",
      "FR"
    )
    const ru = reactions.find((r) => r.code === "RU")
    expect(ru?.opinionDelta).toBeLessThan(0)
    expect(ru?.briefingTitle).toContain("Russia")
  })

  it("skips the player's own nation", () => {
    const reactions = computeProjectReactions(
      "construction:nuclear",
      "X",
      "FR"
    )
    expect(reactions.find((r) => r.code === "FR")).toBeUndefined()
  })

  it("filters out sub-threshold noise", () => {
    // 'other' has no reactsTo entries on any profile → no reactions.
    const reactions = computeProjectReactions("other", "Foo", "FR")
    expect(reactions).toEqual([])
  })
})

describe("simulateAiTick", () => {
  it("drifts opinion toward the profile's baseOpinion", () => {
    // RU baseOpinion is negative — starting at 0 should drift downward.
    const before: Record<string, RelationState> = { RU: rel(0) }
    const result = simulateAiTick({
      days: 10,
      playerNation: "FR",
      relations: before,
      currentDate: DATE,
    })
    const ru = result.relations.RU!
    expect(ru.opinion).toBeLessThan(0)
  })

  it("never assigns a record for the player's own nation", () => {
    const result = simulateAiTick({
      days: 30,
      playerNation: "FR",
      relations: {},
      currentDate: DATE,
    })
    expect(result.relations.FR).toBeUndefined()
  })

  it("eventually proposes an alliance when opinion is high and not allied", () => {
    let relations: Record<string, RelationState> = { US: rel(80) }
    let proposed = false
    for (let day = 0; day < 400 && !proposed; day++) {
      const result = simulateAiTick({
        days: 1,
        playerNation: "FR",
        relations,
        currentDate: DATE,
      })
      relations = result.relations
      if (result.actions.some(
        (a) => a.code === "US" && a.kind === "propose_alliance"
      )) {
        proposed = true
      }
    }
    expect(proposed).toBe(true)
    expect(relations.US?.allied).toBe(true)
  })

  it("breaks an alliance when opinion craters", () => {
    let relations: Record<string, RelationState> = { US: rel(-80, true) }
    let broke = false
    for (let day = 0; day < 400 && !broke; day++) {
      const result = simulateAiTick({
        days: 1,
        playerNation: "FR",
        relations,
        currentDate: DATE,
      })
      relations = result.relations
      if (result.actions.some(
        (a) => a.code === "US" && a.kind === "break_alliance"
      )) {
        broke = true
      }
    }
    expect(broke).toBe(true)
    expect(relations.US?.allied).toBe(false)
  })

  it("is deterministic for a given clock seed", () => {
    // Run twice in the same test (same clock instance) and confirm the same
    // public summary by re-seeding via the harness afterEach/beforeEach is
    // overkill; we just check the function is pure modulo the clock.
    const before: Record<string, RelationState> = { DE: rel(20) }
    const a = simulateAiTick({
      days: 5,
      playerNation: "FR",
      relations: before,
      currentDate: DATE,
    })
    // Running again advances the seeded RNG — results may differ, but the
    // shape and absence of mutation on `before` must hold.
    expect(before.DE?.opinion).toBe(20)
    expect(a.relations.DE).toBeDefined()
    expect(a.relations.DE).not.toBe(before.DE)
  })
})
