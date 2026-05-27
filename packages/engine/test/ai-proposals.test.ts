import { describe, expect, it } from "vitest"

import { maybeGenerateAiProposal } from "../src/ai-nations"
import type { RelationState } from "../src/game"
import { useDeterministicEngine } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 33,
})

describe("maybeGenerateAiProposal", () => {
  it("returns null when the chance roll fails", () => {
    const out = maybeGenerateAiProposal({
      playerNation: "FR",
      relations: {},
      currentDate: new Date("2026-06-01T00:00:00.000Z"),
      baseChancePerDay: 0,
    })
    expect(out).toBeNull()
  })

  it("emits a high-severity diplomacy event when a roll passes", () => {
    const out = maybeGenerateAiProposal({
      playerNation: "FR",
      relations: {},
      currentDate: new Date("2026-06-01T00:00:00.000Z"),
      baseChancePerDay: 1,
    })
    expect(out).not.toBeNull()
    expect(out!.severity).toBe("high")
    expect(out!.category).toBe("diplomacy")
    expect(out!.choices.length).toBeGreaterThanOrEqual(2)
  })

  it("skips nations the player interacted with recently", () => {
    // Every AI nation pinned with a fresh interaction; the cooldown filter
    // should leave nobody eligible, so the function returns null even on a
    // forced roll.
    const fresh = "2026-05-21T08:00:00.000Z"
    const relations: Record<string, RelationState> = {}
    for (const code of [
      "US",
      "GB",
      "DE",
      "IT",
      "ES",
      "RU",
      "CN",
      "JP",
      "BR",
      "IN",
      "AU",
      "CA",
    ]) {
      relations[code] = {
        opinion: 0,
        allied: false,
        lastInteractionAt: fresh,
      }
    }
    const out = maybeGenerateAiProposal({
      playerNation: "FR",
      relations,
      currentDate: new Date("2026-06-01T00:00:00.000Z"),
      baseChancePerDay: 1,
    })
    expect(out).toBeNull()
  })
})
