import { describe, expect, it } from "vitest"

import {
  getCabinetEffects,
  isValidAppointment,
  listCabinetCandidates,
  listMinisters,
} from "../src/cabinet"
import { Game } from "../src/game"
import { useDeterministicEngine } from "./helpers"

useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 19,
})

describe("listCabinetCandidates", () => {
  it("returns at least two candidates per role", () => {
    const roles = listCabinetCandidates("FR")
    expect(roles.length).toBeGreaterThan(3)
    for (const r of roles) {
      expect(r.candidates.length).toBeGreaterThanOrEqual(1)
    }
    const totalCandidates = roles.reduce(
      (n, r) => n + r.candidates.length,
      0
    )
    expect(totalCandidates).toBeGreaterThan(roles.length)
  })
})

describe("Game.appointMinister", () => {
  it("swaps the active candidate and emits a reshuffle briefing", () => {
    const game = Game.createNew()
    const roles = listCabinetCandidates("FR")
    const finance = roles.find((r) => r.roleId === "finance")!
    const alt = finance.candidates[1]!
    const next = game.appointMinister("finance", alt.id)
    expect(next.cabinet.finance).toBe(alt.id)
    expect(
      next.briefing.find((b) => b.title.startsWith("Cabinet reshuffle"))
    ).toBeDefined()
    const ministers = listMinisters("FR", next.cabinet)
    expect(ministers.find((m) => m.roleId === "finance")?.id).toBe(alt.id)
  })

  it("is a no-op for an unknown candidate id", () => {
    const game = Game.createNew()
    const next = game.appointMinister("finance", "not-a-real-id")
    expect(next).toBe(game)
  })

  it("aggregated effects shift when a candidate is swapped", () => {
    const before = getCabinetEffects("FR")
    const alt = listCabinetCandidates("FR")
      .find((r) => r.roleId === "ecology")!
      .candidates[1]!
    const game = Game.createNew().appointMinister("ecology", alt.id)
    const after = getCabinetEffects("FR", game.cabinet)
    expect(after.bondDebtMultiplier).not.toBe(before.bondDebtMultiplier)
  })

  it("isValidAppointment rejects mismatched role/candidate", () => {
    const roles = listCabinetCandidates("FR")
    const finance = roles.find((r) => r.roleId === "finance")!
    const ecology = roles.find((r) => r.roleId === "ecology")!
    expect(
      isValidAppointment("FR", "finance", finance.candidates[0]!.id)
    ).toBe(true)
    expect(
      isValidAppointment("FR", "finance", ecology.candidates[0]!.id)
    ).toBe(false)
  })
})
