import { describe, expect, it } from "vitest"

import { getCabinetEffects } from "../src/cabinet"
import { Game } from "../src/game"
import { defaultProjectEconomics, type Project } from "../src/projects"
import { useDeterministicEngine, tickDays } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 13,
})

describe("getCabinetEffects(FR)", () => {
  it("aggregates each minister's passive bonus", () => {
    const fx = getCabinetEffects("FR")
    expect(fx.bondApprovalMultiplier).toBeLessThan(1) // finance minister
    expect(fx.bondDebtMultiplier).toBeLessThan(1) // finance minister
    expect(fx.approvalPerDay).toBeGreaterThan(0) // PM + interior
    expect(fx.diplomacyDriftMultiplier).toBeGreaterThan(1) // foreign minister
    expect(
      fx.projectCompletionApprovalBonusByKind["construction:military"]
    ).toBeGreaterThan(0)
    expect(
      fx.projectCompletionApprovalBonusByKind["construction:civilian"]
    ).toBeGreaterThan(0)
    expect(
      fx.projectCompletionApprovalBonusByKind["construction:infrastructure"]
    ).toBeGreaterThan(0)
  })
})

describe("cabinet integration", () => {
  it("the finance minister lowers bond approval cost", () => {
    const fx = getCabinetEffects("FR")
    const game = Game.createNew()
    const next = game.issueBond(10_000)
    const naiveDrop = (10_000 / 1000) * 0.4 // BOND_APPROVAL_COST_PER_BILLION
    const actualDrop = game.approval - next.approval
    // With the finance minister the actual drop should be strictly below the
    // naive calculation (which omits the 0.75 multiplier).
    expect(actualDrop).toBeLessThan(naiveDrop)
    expect(actualDrop).toBeGreaterThan(0)
  })

  it("the defence minister bumps completion approval for military projects", () => {
    const startedAt = "2026-05-21T08:00:00.000Z"
    const kind = "construction:military"
    const days = 2
    const project: Project = {
      id: "mil-1",
      kind,
      name: "Test base",
      description: "",
      location: { label: "Brest", latitude: 48.39, longitude: -4.49 },
      startedAt,
      expectedDurationDays: days,
      ...defaultProjectEconomics(kind, days),
    }
    const game = Game.createNew().with({ paused: false }).addProject(project)
    const before = game.approval
    const ticked = tickDays(game, days + 1)
    const completedEntry = ticked.briefing.find((b) =>
      b.title.startsWith("Completed: Test base")
    )
    expect(completedEntry).toBeDefined()
    expect(completedEntry?.detail).toContain("cabinet +1")
    expect(ticked.approval).toBeGreaterThan(before)
  })
})
