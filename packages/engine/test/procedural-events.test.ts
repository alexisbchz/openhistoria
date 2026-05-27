import { describe, expect, it } from "vitest"

import { maybeGenerateProceduralEvent } from "../src/procedural-events"
import { useDeterministicEngine } from "./helpers"

useDeterministicEngine({ seed: 1 })

describe("maybeGenerateProceduralEvent", () => {
  it("returns null when the chance roll is too high", () => {
    const out = maybeGenerateProceduralEvent({
      nation: "FR",
      date: new Date("2026-06-01"),
      triggeredIds: new Set(),
      baseChancePerDay: 0,
    })
    expect(out).toBeNull()
  })

  it("generates a well-formed event when the roll passes", () => {
    const out = maybeGenerateProceduralEvent({
      nation: "FR",
      date: new Date("2026-06-01"),
      triggeredIds: new Set(),
      baseChancePerDay: 1,
    })
    expect(out).not.toBeNull()
    expect(out!.choices.length).toBeGreaterThanOrEqual(2)
    expect(out!.choices.every((c) => typeof c.label === "string")).toBe(true)
    expect(out!.id.includes("2026-06-01")).toBe(true)
  })

  it("does not re-generate a template that already triggered", () => {
    const first = maybeGenerateProceduralEvent({
      nation: "FR",
      date: new Date("2026-06-02"),
      triggeredIds: new Set(),
      baseChancePerDay: 1,
    })
    expect(first).not.toBeNull()
    const templateId = first!.id.split("-").slice(0, -2).join("-")
    const triggered = new Set([first!.id])
    const second = maybeGenerateProceduralEvent({
      nation: "FR",
      date: new Date("2026-06-03"),
      triggeredIds: triggered,
      baseChancePerDay: 1,
    })
    expect(second).not.toBeNull()
    expect(second!.id.startsWith(templateId)).toBe(false)
  })

  it("respects per-template cooldown when triggeredEvents history is provided", () => {
    // Simulate a recent firing of the very first generated template. The same
    // template should not be picked again until its cooldown elapses.
    const first = maybeGenerateProceduralEvent({
      nation: "FR",
      date: new Date("2026-06-02"),
      triggeredIds: new Set(),
      baseChancePerDay: 1,
    })!
    const templateId = first.id.split("-").slice(0, -2).join("-")
    const triggeredEvents = [
      {
        id: first.id,
        chosenAt: "2026-06-02T00:00:00.000Z",
        choiceId: "x",
      },
    ]
    // 5 days later: cooldown still active (every template has at least 60d).
    const second = maybeGenerateProceduralEvent({
      nation: "FR",
      date: new Date("2026-06-07"),
      triggeredIds: new Set(),
      triggeredEvents,
      baseChancePerDay: 1,
    })
    if (second) {
      expect(second.id.startsWith(templateId)).toBe(false)
    }
  })

  it("emits an event with a declared severity", () => {
    const out = maybeGenerateProceduralEvent({
      nation: "FR",
      date: new Date("2026-06-02"),
      triggeredIds: new Set(),
      baseChancePerDay: 1,
    })
    expect(out).not.toBeNull()
    expect(["low", "medium", "high"]).toContain(out!.severity)
  })
})
