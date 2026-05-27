import { describe, expect, it } from "vitest"

import { Game } from "../src/game"
import {
  defaultProjectEconomics,
  type Project,
  type ProjectKind,
} from "../src/projects"
import { useDeterministicEngine, freshGame, tickDays } from "./helpers"

const harness = useDeterministicEngine({
  startDate: new Date("2026-05-21T08:00:00.000Z"),
  seed: 42,
})

function makeProject(
  overrides: Partial<Project> & { kind?: ProjectKind } = {}
): Project {
  const kind = overrides.kind ?? "construction:infrastructure"
  const durationDays = overrides.expectedDurationDays ?? 30
  const economics = defaultProjectEconomics(kind, durationDays)
  return {
    id: overrides.id ?? "proj-1",
    kind,
    name: overrides.name ?? "Test project",
    description: overrides.description ?? "—",
    location: overrides.location ?? {
      label: "Paris, France",
      latitude: 48.8566,
      longitude: 2.3522,
    },
    startedAt: overrides.startedAt ?? "2026-05-21T08:00:00.000Z",
    expectedDurationDays: durationDays,
    ...economics,
    ...overrides,
  }
}

describe("Game.createNew", () => {
  it("initialises with deterministic defaults", () => {
    const game = freshGame()
    expect(game.nation).toBe("FR")
    expect(game.character).toBe("macron")
    expect(game.paused).toBe(true)
    expect(game.approval).toBeGreaterThan(0)
    expect(game.approval).toBeLessThanOrEqual(100)
    expect(game.projects).toEqual([])
    expect(game.briefing.length).toBeGreaterThanOrEqual(1)
    expect(game.briefing[0]?.kind).toBe("milestone")
  })

  it("uses the deterministic clock for briefing IDs", () => {
    const game = freshGame()
    expect(game.briefing[0]?.id).toBe("id-1")
  })
})

describe("Game.with immutability", () => {
  it("returns a new instance and leaves the original unchanged", () => {
    const game = freshGame()
    const next = game.with({ paused: false })
    expect(next).not.toBe(game)
    expect(game.paused).toBe(true)
    expect(next.paused).toBe(false)
  })
})

describe("Game.addProject", () => {
  it("subtracts upfront cost and pushes a briefing", () => {
    const game = freshGame()
    const project = makeProject({
      kind: "construction:infrastructure",
      expectedDurationDays: 90,
    })
    const next = game.addProject(project)
    expect(next.projects).toHaveLength(1)
    expect(next.treasury).toBe(game.treasury - project.upfrontCost)
    expect(next.briefing[0]?.kind).toBe("project_started")
  })

  it("refuses if treasury is far below upfront cost and logs a warning", () => {
    const game = freshGame().with({ treasury: -100_000 })
    const project = makeProject({
      kind: "construction:nuclear",
      expectedDurationDays: 3650,
    })
    const next = game.addProject(project)
    expect(next.projects).toHaveLength(0)
    expect(next.treasury).toBe(game.treasury)
    expect(next.briefing[0]?.kind).toBe("warning")
    expect(next.briefing[0]?.title).toContain("Cabinet refused")
  })

  it("keeps project_started at briefing[0] even when AI nations react", () => {
    // construction:nuclear triggers reactions from several AI nations.
    // project_started must remain the most recent entry the player sees.
    const game = freshGame()
    const project = makeProject({
      kind: "construction:nuclear",
      name: "Pluton II reactor",
      expectedDurationDays: 365,
    })
    const next = game.addProject(project)
    expect(next.briefing[0]?.kind).toBe("project_started")
    expect(next.briefing[0]?.title).toContain("Pluton II")
    // And at least one reaction briefing landed behind it.
    expect(next.briefing.slice(1).some((b) => b.kind === "warning")).toBe(true)
  })

  it("ignores additions after game over", () => {
    const game = freshGame().with({
      gameOver: { outcome: "lost", reason: "test", date: "2027-04-25T00:00:00.000Z" },
    })
    const project = makeProject()
    expect(game.addProject(project)).toBe(game)
  })
})

describe("Game.cancelProject", () => {
  it("refunds half the upfront, scaled by remaining progress", () => {
    const game = freshGame()
    const project = makeProject({
      kind: "construction:infrastructure",
      expectedDurationDays: 100,
    })
    const after = game.addProject(project)
    const cancelled = after.cancelProject(project.id)
    const expectedRefund = Math.round(project.upfrontCost * 0.5)
    expect(cancelled.projects).toHaveLength(0)
    expect(cancelled.treasury).toBe(after.treasury + expectedRefund)
    expect(cancelled.briefing[0]?.kind).toBe("project_cancelled")
  })

  it("is a no-op for unknown id", () => {
    const game = freshGame()
    expect(game.cancelProject("does-not-exist")).toBe(game)
  })
})

describe("Game.issueBond", () => {
  it("increases treasury, bumps debt, and reduces approval", () => {
    const game = freshGame()
    const next = game.issueBond(10_000)
    expect(next.treasury).toBe(game.treasury + 10_000)
    expect(next.stats.economy.publicDebtPctGdp).toBeGreaterThan(
      game.stats.economy.publicDebtPctGdp
    )
    expect(next.approval).toBeLessThan(game.approval)
    expect(next.briefing[0]?.kind).toBe("treasury")
  })

  it("ignores non-positive amounts", () => {
    const game = freshGame()
    expect(game.issueBond(0)).toBe(game)
    expect(game.issueBond(-100)).toBe(game)
  })
})

describe("Game.tick", () => {
  it("advances the date by the requested days", () => {
    const game = freshGame().with({ paused: false })
    const next = tickDays(game, 7)
    const diff = next.date.getTime() - game.date.getTime()
    expect(diff).toBe(7 * 86_400_000)
  })

  it("completes projects whose duration has elapsed and applies effects", () => {
    const game = freshGame().with({ paused: false })
    const project = makeProject({
      kind: "construction:civilian",
      expectedDurationDays: 2,
      startedAt: game.date.toISOString(),
    })
    const queued = game.addProject(project)
    const ticked = tickDays(queued, 3)
    expect(ticked.projects).toHaveLength(0)
    expect(ticked.approval).toBeGreaterThan(queued.approval - 1)
    expect(ticked.briefing.some((b) => b.kind === "project_completed")).toBe(true)
  })

  it("triggers scheduled events and pauses", () => {
    const game = freshGame().with({ paused: false })
    const ticked = tickDays(game, 365)
    expect(ticked.pendingEvent).not.toBeNull()
    expect(ticked.paused).toBe(true)
  })

  it("is a no-op while paused or with a pending event", () => {
    const game = freshGame()
    expect(tickDays(game, 1)).toBe(game)
    const withEvent = game.with({
      paused: false,
      pendingEvent: {
        id: "evt-x",
        nation: "FR",
        category: "social",
        date: "2026-06-01",
        title: "Test",
        description: "",
        choices: [{ id: "a", label: "ok", effects: {} }],
      },
    })
    expect(tickDays(withEvent, 1)).toBe(withEvent)
  })
})

describe("Game.resolveEventChoice", () => {
  it("applies effects, archives the event, and clears pending", () => {
    const game = freshGame().with({
      paused: false,
      pendingEvent: {
        id: "evt-test",
        nation: "FR",
        category: "social",
        date: "2026-06-01",
        title: "Strike",
        description: "",
        choices: [
          {
            id: "negotiate",
            label: "Negotiate",
            effects: { treasury: -500, approval: 3 },
          },
        ],
      },
    })
    const next = game.resolveEventChoice("evt-test", "negotiate")
    expect(next.pendingEvent).toBeNull()
    expect(next.treasury).toBe(game.treasury - 500)
    expect(next.approval).toBe(Math.min(100, game.approval + 3))
    expect(next.triggeredEvents).toHaveLength(1)
    expect(next.triggeredEvents[0]?.id).toBe("evt-test")
  })

  it("sets gameOver when the chosen effect is terminal", () => {
    const game = freshGame().with({
      pendingEvent: {
        id: "evt-final",
        nation: "FR",
        category: "election",
        date: "2027-04-25",
        title: "Final vote",
        description: "",
        choices: [{ id: "endorse", label: "Endorse", effects: { terminal: true } }],
      },
    })
    const next = game.resolveEventChoice("evt-final", "endorse")
    expect(next.gameOver).not.toBeNull()
    expect(["won", "lost"]).toContain(next.gameOver?.outcome)
  })

  it("is a no-op when ids do not match", () => {
    const game = freshGame()
    expect(game.resolveEventChoice("foo", "bar")).toBe(game)
  })
})

describe("Game.mediaTour", () => {
  it("spends comms budget and bumps approval", () => {
    const game = freshGame()
    const next = game.mediaTour()
    expect(next.treasury).toBe(game.treasury - 80)
    expect(next.approval).toBeGreaterThan(game.approval)
  })
})

describe("Game diplomacy", () => {
  it("getRelation returns a default state when no record exists", () => {
    const game = freshGame()
    const rel = game.getRelation("GB")
    expect(rel.opinion).toBe(0)
    expect(rel.allied).toBe(false)
    expect(rel.lastInteractionAt).toBeNull()
  })

  it("proposeAlliance sets allied + opinion floor and logs a briefing", () => {
    const game = freshGame()
    const next = game.proposeAlliance("GB")
    const rel = next.getRelation("GB")
    expect(rel.allied).toBe(true)
    expect(rel.opinion).toBeGreaterThanOrEqual(50)
    expect(rel.lastInteractionAt).not.toBeNull()
    expect(next.briefing[0]?.kind).toBe("milestone")
    expect(next.briefing[0]?.title).toContain("GB")
  })

  it("proposeAlliance normalizes the key to uppercase", () => {
    const game = freshGame().proposeAlliance("gb")
    expect(game.getRelation("GB").allied).toBe(true)
    expect(game.getRelation("gb").allied).toBe(true)
  })

  it("proposeAlliance is a no-op against the player's own nation", () => {
    const game = freshGame()
    expect(game.proposeAlliance("FR")).toBe(game)
  })

  it("proposeAlliance is a no-op when already allied", () => {
    const first = freshGame().proposeAlliance("GB")
    expect(first.proposeAlliance("GB")).toBe(first)
  })

  it("breakAlliance flips allied, drops opinion, and logs a warning", () => {
    const allied = freshGame().proposeAlliance("GB")
    const broken = allied.breakAlliance("GB")
    const rel = broken.getRelation("GB")
    expect(rel.allied).toBe(false)
    expect(rel.opinion).toBeLessThan(allied.getRelation("GB").opinion)
    expect(broken.briefing[0]?.kind).toBe("warning")
  })

  it("breakAlliance is a no-op when not allied", () => {
    const game = freshGame()
    expect(game.breakAlliance("GB")).toBe(game)
  })

  it("breakAlliance is a no-op against the player's own nation", () => {
    const game = freshGame()
    expect(game.breakAlliance("FR")).toBe(game)
    expect(game.breakAlliance("fr")).toBe(game)
  })

  it("sendDiplomaticMessage is a no-op against the player's own nation", () => {
    const game = freshGame()
    const same = game.sendDiplomaticMessage({
      target: "FR",
      opinionDelta: 10,
      briefingTitle: "self note",
    })
    expect(same).toBe(game)
  })

  it("ignores alliance actions after game over", () => {
    const game = freshGame().with({
      gameOver: { outcome: "lost", reason: "test", date: "2027-04-25T00:00:00.000Z" },
    })
    expect(game.proposeAlliance("GB")).toBe(game)
    expect(game.breakAlliance("GB")).toBe(game)
  })
})

describe("Snapshot round-trip", () => {
  it("toSnapshot + fromSnapshot preserves identity", () => {
    const game = freshGame().with({ paused: false, treasury: 1234 })
    const round = Game.fromSnapshot(game.toSnapshot())
    expect(round.nation).toBe(game.nation)
    expect(round.treasury).toBe(game.treasury)
    expect(round.approval).toBe(game.approval)
    expect(round.date.toISOString()).toBe(game.date.toISOString())
  })

  it("round-trips relations through a snapshot", () => {
    const game = freshGame().proposeAlliance("GB")
    const snapshot = game.toSnapshot()
    expect(snapshot.version).toBe(5)
    expect(snapshot.relations["GB"]?.allied).toBe(true)
    const round = Game.fromSnapshot(snapshot)
    expect(round.getRelation("GB").allied).toBe(true)
  })

  it("migrates v3 snapshots by seeding empty relations", () => {
    const v3 = {
      version: 3 as const,
      nation: "FR" as const,
      character: "macron" as const,
      date: "2026-06-01T00:00:00.000Z",
      startedAt: "2026-05-21T00:00:00.000Z",
      speed: 1 as const,
      paused: true,
      projects: [],
      treasury: 100,
      approval: 40,
      stats: freshGame().stats,
      triggeredEvents: [],
      pendingEvent: null,
      briefing: [],
      gameOver: null,
    }
    const migrated = Game.fromSnapshot(v3)
    expect(migrated.relations).toEqual({})
    expect(migrated.getRelation("GB").allied).toBe(false)
    // After mutation the snapshot bumps to the current schema version.
    expect(migrated.proposeAlliance("GB").toSnapshot().version).toBe(5)
  })

  it("migrates v1 snapshots by seeding fresh treasury and stats", () => {
    const v1 = {
      version: 1 as const,
      nation: "FR" as const,
      character: "macron" as const,
      date: "2026-06-01T00:00:00.000Z",
      startedAt: "2026-05-21T00:00:00.000Z",
      speed: 1 as const,
      paused: false,
      projects: [
        {
          id: "legacy-1",
          kind: "construction:civilian" as const,
          name: "Legacy",
          description: "",
          location: { label: "Lyon", latitude: 45.75, longitude: 4.85 },
          startedAt: "2026-05-21T00:00:00.000Z",
          expectedDurationDays: 120,
        },
      ],
    }
    const migrated = Game.fromSnapshot(v1)
    expect(migrated.projects).toHaveLength(1)
    expect(migrated.projects[0]?.upfrontCost).toBeDefined()
    expect(migrated.treasury).toBeDefined()
    expect(migrated.approval).toBeGreaterThan(0)
  })
})
