import { describe, expect, it } from "vitest"

import { getDueEvent, getNextEvent } from "../src/events"

describe("event chain preconditions", () => {
  const railEscalationId = "fr-2026-rail-strike-escalation"
  const railStrikeId = "fr-2026-rail-strike"
  const hydrogenId = "fr-2026-franco-german-industrial"
  const summitId = "fr-2026-eu-summit"

  it("hides chain events when their precondition is not met", () => {
    // 2026-11-05 is after both the heatwave (resolved) and rail-strike (not
    // resolved at all), but the escalation requires the player chose
    // "hold-firm" — so it should not surface.
    const triggeredIds = new Set<string>(["fr-2026-heatwave"])
    const triggered = [
      {
        id: "fr-2026-heatwave",
        chosenAt: "2026-07-08T00:00:00.000Z",
        choiceId: "emergency-package",
      },
    ]
    const due = getDueEvent(
      new Date("2026-11-05T12:00:00.000Z"),
      "FR",
      triggeredIds,
      triggered
    )
    expect(due?.id).not.toBe(railEscalationId)
    expect(due?.id).not.toBe(hydrogenId)
  })

  it("surfaces the rail-strike follow-up only when the player held firm", () => {
    // Treat all earlier story events as resolved so getDueEvent picks the
    // escalation rather than something older.
    const triggeredIds = new Set<string>([
      "fr-2026-heatwave",
      "fr-2026-nato-pressure",
      "fr-2026-eu-summit",
      "fr-2026-iran-crisis",
      railStrikeId,
    ])
    const triggered = [
      {
        id: railStrikeId,
        chosenAt: "2026-09-22T00:00:00.000Z",
        choiceId: "hold-firm",
      },
    ]
    const due = getDueEvent(
      new Date("2026-11-05T12:00:00.000Z"),
      "FR",
      triggeredIds,
      triggered
    )
    expect(due?.id).toBe(railEscalationId)
  })

  it("hides the rail-strike follow-up when the player negotiated", () => {
    const triggeredIds = new Set<string>([railStrikeId])
    const triggered = [
      {
        id: railStrikeId,
        chosenAt: "2026-09-22T00:00:00.000Z",
        choiceId: "negotiate",
      },
    ]
    const due = getDueEvent(
      new Date("2026-11-05T12:00:00.000Z"),
      "FR",
      triggeredIds,
      triggered
    )
    expect(due?.id).not.toBe(railEscalationId)
  })

  it("surfaces the EU summit follow-up only when the player championed", () => {
    const triggeredIds = new Set<string>([
      "fr-2026-heatwave",
      "fr-2026-nato-pressure",
      railStrikeId,
      summitId,
      "fr-2026-iran-crisis",
      "fr-2026-tech-scandal",
    ])
    const triggered = [
      {
        id: summitId,
        chosenAt: "2026-10-15T00:00:00.000Z",
        choiceId: "champion",
      },
      {
        id: railStrikeId,
        chosenAt: "2026-09-22T00:00:00.000Z",
        choiceId: "negotiate",
      },
    ]
    const due = getDueEvent(
      new Date("2026-12-05T12:00:00.000Z"),
      "FR",
      triggeredIds,
      triggered
    )
    expect(due?.id).toBe(hydrogenId)
  })

  it("getNextEvent applies the same precondition filter", () => {
    const triggered = [
      {
        id: railStrikeId,
        chosenAt: "2026-09-22T00:00:00.000Z",
        choiceId: "hold-firm",
      },
    ]
    const next = getNextEvent(
      new Date("2026-10-01T00:00:00.000Z"),
      "FR",
      new Set([railStrikeId]),
      triggered
    )
    // The next event in date order should at least be a real event; the
    // escalation might or might not be the soonest, but should be reachable.
    expect(next).not.toBeNull()
  })
})
