import { describe, expect, it } from "vitest"

import { Game } from "../src/game"
import { buildRetrospective } from "../src/retrospective"
import { useDeterministicEngine } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 5,
})

describe("buildRetrospective", () => {
  it("produces a headline and paragraphs for an election win", () => {
    const game = Game.createNew().with({
      gameOver: {
        outcome: "won",
        cause: "election_won",
        reason: "Victory.",
        date: "2027-04-25T00:00:00.000Z",
      },
    })
    const retro = buildRetrospective(game)
    expect(retro.headline.length).toBeGreaterThan(10)
    expect(retro.paragraphs.length).toBeGreaterThanOrEqual(3)
    expect(retro.paragraphs.join(" ").length).toBeGreaterThan(80)
  })

  it("uses a distinct headline for bankruptcy", () => {
    const game = Game.createNew().with({
      gameOver: {
        outcome: "lost",
        cause: "bankruptcy",
        reason: "Default.",
        date: "2027-03-01T00:00:00.000Z",
      },
    })
    const retro = buildRetrospective(game)
    expect(retro.headline.toLowerCase()).toContain("default")
  })

  it("includes triggered story events as moments", () => {
    const game = Game.createNew().with({
      triggeredEvents: [
        {
          id: "fr-2026-heatwave",
          chosenAt: "2026-07-08T00:00:00.000Z",
          choiceId: "emergency-package",
        },
      ],
      gameOver: {
        outcome: "won",
        cause: "election_won",
        reason: "Victory.",
        date: "2027-04-25T00:00:00.000Z",
      },
    })
    const retro = buildRetrospective(game)
    const moment = retro.moments.find((m) => m.date === "2026-07-08")
    expect(moment).toBeDefined()
    expect(moment?.title).toContain("heatwave")
  })

  it("is deterministic across calls", () => {
    const game = Game.createNew().with({
      gameOver: {
        outcome: "lost",
        cause: "impeachment",
        reason: "Censure.",
        date: "2027-02-10T00:00:00.000Z",
      },
    })
    const a = buildRetrospective(game)
    const b = buildRetrospective(game)
    expect(a).toEqual(b)
  })
})
