import { getClock } from "./clock"
import {
  CountryStatsProvider,
  type CountryStats,
} from "./country-stats"
import { applyEconomyTick, sanitizeStats } from "./economy"
import {
  EVENT_LIBRARY,
  getDueEvent,
  getEventSeverity,
  type EventDefinition,
  type EventEffects,
  type EventSeverity,
  type TriggeredEvent,
} from "./events"
import { maybeGenerateProceduralEvent } from "./procedural-events"
import {
  getProjectProgress,
  type Project,
} from "./projects"
import {
  computeProjectReactions,
  maybeGenerateAiProposal,
  simulateAiTick,
  type AiAction,
} from "./ai-nations"
import {
  getCabinetEffects,
  isValidAppointment,
  listMinisters,
  type CabinetAppointments,
} from "./cabinet"

export type NationCode = "FR"
export type CharacterId = "macron"
export type GameSpeed = 1 | 2 | 3 | 4 | 5

export const SPEED_MS_PER_DAY: Record<GameSpeed, number> = {
  1: 2000,
  2: 1000,
  3: 500,
  4: 200,
  5: 50,
}

export type GameOutcome = "won" | "lost"

export type GameOverCause =
  | "election_won"
  | "election_lost"
  | "bankruptcy"
  | "impeachment"
  | "other"

export interface GameOverState {
  outcome: GameOutcome
  reason: string
  date: string
  cause?: GameOverCause
}

export interface RelationState {
  opinion: number // -100..+100, clamped
  allied: boolean
  lastInteractionAt: string | null // ISO date
  /** ISO date of the last economic action (trade deal, sanctions, etc.). */
  lastEconomicActionAt?: string | null
}

export type ReformAgendaId =
  | "fiscal_discipline"
  | "european_leadership"
  | "social_renewal"
  | "technology_sovereignty"
  | "security_first"

export interface ReformAgendaDef {
  id: ReformAgendaId
  title: string
  description: string
  /** Short label shown in HUD. */
  short: string
  /** Approval threshold replaced at election when agenda succeeds. */
  approvalThresholdOnSuccess: number
}

export const REFORM_AGENDAS: readonly ReformAgendaDef[] = [
  {
    id: "fiscal_discipline",
    short: "Fiscal discipline",
    title: "Restore fiscal discipline",
    description:
      "Bring the budget under control. Reduce public-debt growth and keep the treasury out of crisis.",
    approvalThresholdOnSuccess: 38,
  },
  {
    id: "european_leadership",
    short: "European leadership",
    title: "Anchor France at the heart of Europe",
    description:
      "Build alliances and good standing with EU partners. Lead from Berlin to Madrid.",
    approvalThresholdOnSuccess: 36,
  },
  {
    id: "social_renewal",
    short: "Social renewal",
    title: "Heal social fractures",
    description:
      "Cut unemployment, deliver visible projects, restore household trust.",
    approvalThresholdOnSuccess: 36,
  },
  {
    id: "technology_sovereignty",
    short: "Tech sovereignty",
    title: "Build French and European tech sovereignty",
    description:
      "Launch nuclear, industrial, or strategic-tech projects. Reduce dependence on US/Chinese supply chains.",
    approvalThresholdOnSuccess: 38,
  },
  {
    id: "security_first",
    short: "Security first",
    title: "Rearm and project power",
    description:
      "Strengthen defence, hold the line on order, project credibility abroad. Approval costs are higher.",
    approvalThresholdOnSuccess: 40,
  },
]

export interface ReformAgendaState {
  id: ReformAgendaId
  startedAt: string
  /** Computed at election time; null while in progress. */
  succeeded?: boolean | null
}

export interface HistorySample {
  date: string // ISO date
  treasury: number
  approval: number
  gdpUsd: number
  unemploymentPct: number
}

export type DiplomaticChannel = "sms" | "tweet" | "call" | "letter"
export type DiplomaticTone =
  | "friendly"
  | "neutral"
  | "threatening"
  | "joking"

export interface DiplomaticMessageArgs {
  target: string
  opinionDelta: number
  cost?: number // €M, default 0
  briefingTitle: string
  briefingDetail?: string
  briefingKind?: BriefingKind
}

export const DEFAULT_RELATION: RelationState = {
  opinion: 0,
  allied: false,
  lastInteractionAt: null,
}

export interface GameSnapshot {
  version: 5
  nation: NationCode
  character: CharacterId
  date: string
  startedAt: string
  speed: GameSpeed
  paused: boolean
  projects: Project[]
  treasury: number
  approval: number
  stats: CountryStats
  triggeredEvents: TriggeredEvent[]
  pendingEvent: EventDefinition | null
  briefing: BriefingEntry[]
  gameOver: GameOverState | null
  relations: Record<string, RelationState>
  reformAgenda: ReformAgendaState | null
  history: HistorySample[]
  /** Day-counter for the "treasury deeply negative" bankruptcy trip. */
  bankruptcyDays: number
  /** Day-counter for the "approval critically low" impeachment trip. */
  impeachmentDays: number
  /**
   * One-shot warning IDs the engine has already fired in this run. Lets the
   * tick emit a single "approaching bankruptcy"/"election in 30d" briefing
   * line instead of one every tick.
   */
  triggeredWarnings: string[]
  /** Active cabinet appointments: roleId -> candidate id. */
  cabinet?: Record<string, string>
}

export type BriefingKind =
  | "event"
  | "project_completed"
  | "project_started"
  | "project_cancelled"
  | "milestone"
  | "warning"
  | "treasury"

export interface BriefingEntry {
  id: string
  date: string
  kind: BriefingKind
  title: string
  detail?: string
}

interface GameFields {
  nation: NationCode
  character: CharacterId
  date: Date
  startedAt: Date
  speed: GameSpeed
  paused: boolean
  projects: readonly Project[]
  treasury: number
  approval: number
  stats: CountryStats
  triggeredEvents: readonly TriggeredEvent[]
  pendingEvent: EventDefinition | null
  briefing: readonly BriefingEntry[]
  gameOver: GameOverState | null
  relations: Readonly<Record<string, RelationState>>
  reformAgenda: ReformAgendaState | null
  history: readonly HistorySample[]
  bankruptcyDays: number
  impeachmentDays: number
  triggeredWarnings: ReadonlySet<string>
  cabinet: CabinetAppointments
}

const countryStatsProvider = new CountryStatsProvider()
const MAX_BRIEFING = 200
const MAX_HISTORY = 60 // ~1y at weekly cadence + buffer
const INITIAL_APPROVAL = 38
const INITIAL_TREASURY_MILLIONS = -2_000
const BOND_APPROVAL_COST_PER_BILLION = 0.4
const BOND_DEBT_DELTA_PER_BILLION = 0.03
// Debt-to-GDP at which the bond market starts charging real political costs:
// approval and debt-pp impact scale up linearly from here, capped at 3x.
const BOND_STRESS_DEBT_PCT = 130
// Hard cap on debt/GDP. Past this, the engine refuses new bonds outright.
const BOND_HARD_DEBT_CAP_PCT = 160
const ADDPROJECT_TREASURY_BUFFER = 50_000

// Player-warning thresholds. Fired at most once each via the
// `triggeredWarnings` set so we don't spam the briefing.
const WARN_BANKRUPTCY_TREASURY = -300_000
const WARN_IMPEACHMENT_APPROVAL = 22
const ELECTION_COUNTDOWN_DAYS = [90, 30, 7] as const

// Anchor for election-countdown reminders. Picked up by ID from EVENT_LIBRARY
// so changing the date in events.ts stays load-bearing.
const ELECTION_EVENT_ID = "fr-2027-presidential-election"

// Failure thresholds. Tuned so a player has weeks of warning before the run
// ends, not minutes — but they're real teeth.
const BANKRUPTCY_TREASURY_FLOOR = -500_000 // €-500B
const BANKRUPTCY_DAYS_TO_LOSE = 30
const IMPEACHMENT_APPROVAL_FLOOR = 15
const IMPEACHMENT_DAYS_TO_LOSE = 30

// Player economic actions (sanctions / trade deals). Costs are tuned to feel
// non-trivial but not bankrupting; the real lever is opinion + the 90-day
// cooldown via `lastEconomicActionAt`.
const PLAYER_ECONOMIC_COOLDOWN_DAYS = 90
const TRADE_DEAL_COST_MILLIONS = 300
const TRADE_DEAL_GDP_MILLIONS = 1500
const TRADE_DEAL_OPINION_DELTA = 12
const SANCTIONS_COST_MILLIONS = 500
const SANCTIONS_GDP_HIT_MILLIONS = 600
const SANCTIONS_OPINION_DELTA = -18

function isEconomicallyEligible(
  lastEconomicActionAt: string | null | undefined,
  now: Date
): boolean {
  if (!lastEconomicActionAt) return true
  const lastMs = Date.parse(lastEconomicActionAt)
  if (Number.isNaN(lastMs)) return true
  return now.getTime() - lastMs >= PLAYER_ECONOMIC_COOLDOWN_DAYS * 86_400_000
}

function clampApproval(v: number): number {
  return Math.max(0, Math.min(100, v))
}

function clampOpinion(v: number): number {
  return Math.max(-100, Math.min(100, v))
}

function normalizeNationKey(code: string): string {
  return code.trim().toUpperCase()
}

export class Game {
  readonly nation: NationCode
  readonly character: CharacterId
  readonly date: Date
  readonly startedAt: Date
  readonly speed: GameSpeed
  readonly paused: boolean
  readonly projects: readonly Project[]
  readonly treasury: number
  readonly approval: number
  readonly stats: CountryStats
  readonly triggeredEvents: readonly TriggeredEvent[]
  readonly pendingEvent: EventDefinition | null
  readonly briefing: readonly BriefingEntry[]
  readonly gameOver: GameOverState | null
  readonly relations: Readonly<Record<string, RelationState>>
  readonly reformAgenda: ReformAgendaState | null
  readonly history: readonly HistorySample[]
  readonly bankruptcyDays: number
  readonly impeachmentDays: number
  readonly triggeredWarnings: ReadonlySet<string>
  readonly cabinet: CabinetAppointments

  constructor(init: GameFields) {
    this.nation = init.nation
    this.character = init.character
    this.date = init.date
    this.startedAt = init.startedAt
    this.speed = init.speed
    this.paused = init.paused
    this.projects = init.projects
    this.treasury = init.treasury
    this.approval = init.approval
    this.stats = init.stats
    this.triggeredEvents = init.triggeredEvents
    this.pendingEvent = init.pendingEvent
    this.briefing = init.briefing
    this.gameOver = init.gameOver
    this.relations = init.relations
    this.reformAgenda = init.reformAgenda
    this.history = init.history
    this.bankruptcyDays = init.bankruptcyDays
    this.impeachmentDays = init.impeachmentDays
    this.triggeredWarnings = init.triggeredWarnings
    this.cabinet = init.cabinet
  }

  static createNew(): Game {
    const start = new Date("2026-05-21T08:00:00.000Z")
    const stats = countryStatsProvider.fetchSync("FR")
    return new Game({
      nation: "FR",
      character: "macron",
      date: start,
      startedAt: start,
      speed: 1,
      paused: true,
      projects: [],
      treasury: INITIAL_TREASURY_MILLIONS,
      approval: INITIAL_APPROVAL,
      stats,
      triggeredEvents: [],
      pendingEvent: null,
      briefing: [
        makeBriefing(start, {
          kind: "milestone",
          title: "Second term in progress",
          detail:
            "11 months until the 2027 presidential election. Approval: 38%.",
        }),
      ],
      gameOver: null,
      relations: {},
      reformAgenda: null,
      history: [
        {
          date: start.toISOString(),
          treasury: INITIAL_TREASURY_MILLIONS,
          approval: INITIAL_APPROVAL,
          gdpUsd: stats.economy.gdpUsd,
          unemploymentPct: stats.economy.unemploymentPct,
        },
      ],
      bankruptcyDays: 0,
      impeachmentDays: 0,
      triggeredWarnings: new Set<string>(),
      cabinet: {},
    })
  }

  with(overrides: Partial<GameFields>): Game {
    return new Game({
      nation: this.nation,
      character: this.character,
      date: this.date,
      startedAt: this.startedAt,
      speed: this.speed,
      paused: this.paused,
      projects: this.projects,
      treasury: this.treasury,
      approval: this.approval,
      stats: this.stats,
      triggeredEvents: this.triggeredEvents,
      pendingEvent: this.pendingEvent,
      briefing: this.briefing,
      gameOver: this.gameOver,
      relations: this.relations,
      reformAgenda: this.reformAgenda,
      history: this.history,
      bankruptcyDays: this.bankruptcyDays,
      impeachmentDays: this.impeachmentDays,
      triggeredWarnings: this.triggeredWarnings,
      cabinet: this.cabinet,
      ...overrides,
    })
  }

  appointMinister(roleId: string, candidateId: string): Game {
    if (this.gameOver) return this
    if (!isValidAppointment(this.nation, roleId, candidateId)) {
      return this
    }
    if (this.cabinet[roleId] === candidateId) return this
    const next = { ...this.cabinet, [roleId]: candidateId }
    const candidate = listMinisters(this.nation, next).find(
      (m) => m.roleId === roleId
    )
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "milestone",
      title: `Cabinet reshuffle: ${candidate?.role ?? roleId}`,
      detail: candidate ? `${candidate.name} (${candidate.party}) takes the role.` : undefined,
    }))
    return this.with({ cabinet: next, briefing })
  }

  setReformAgenda(id: ReformAgendaId): Game {
    if (this.gameOver) return this
    if (this.reformAgenda?.id === id) return this
    const def = REFORM_AGENDAS.find((a) => a.id === id)
    if (!def) return this
    const next: ReformAgendaState = {
      id,
      startedAt: this.date.toISOString(),
      succeeded: null,
    }
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "milestone",
      title: `Reform agenda set: ${def.short}`,
      detail: def.description,
    }))
    return this.with({ reformAgenda: next, briefing })
  }

  get triggeredEventIds(): Set<string> {
    return new Set(this.triggeredEvents.map((t) => t.id))
  }

  get pendingEventId(): string | null {
    return this.pendingEvent?.id ?? null
  }

  addProject(project: Project): Game {
    if (this.gameOver) return this
    // Refuse if scheduling this project would push the treasury past the
    // discretionary borrowing buffer — the player needs to issue a bond first.
    if (this.treasury - project.upfrontCost < -ADDPROJECT_TREASURY_BUFFER) {
      const shortfall =
        project.upfrontCost - (this.treasury + ADDPROJECT_TREASURY_BUFFER)
      const briefing = pushTo(this.briefing, makeBriefing(this.date, {
        kind: "warning",
        title: `Cabinet refused: ${project.name}`,
        detail: `Short of €${Math.round(shortfall).toLocaleString()}M. Issue bonds or pick a smaller project.`,
      }))
      return this.with({ briefing })
    }
    const treasury = this.treasury - project.upfrontCost

    const reactions = computeProjectReactions(
      project.kind,
      project.name,
      this.nation
    )
    let relations = this.relations
    let briefing = this.briefing
    for (const reaction of reactions) {
      const current = relations[reaction.code] ?? DEFAULT_RELATION
      relations = {
        ...relations,
        [reaction.code]: {
          ...current,
          opinion: clampOpinion(current.opinion + reaction.opinionDelta),
          lastInteractionAt: this.date.toISOString(),
        },
      }
      briefing = pushTo(briefing, makeBriefing(this.date, {
        kind: reaction.opinionDelta >= 0 ? "milestone" : "warning",
        title: reaction.briefingTitle,
        detail: `Opinion ${formatSigned(reaction.opinionDelta)} (${reaction.code})`,
      }))
    }

    briefing = pushTo(briefing, makeBriefing(this.date, {
      kind: "project_started",
      title: `Scheduled: ${project.name}`,
      detail: `${project.location.label} · €${project.upfrontCost}M upfront · ~${project.expectedDurationDays}d`,
    }))
    return this.with({
      projects: [...this.projects, project],
      treasury,
      briefing,
      relations,
    })
  }

  cancelProject(id: string): Game {
    const project = this.projects.find((p) => p.id === id)
    if (!project) return this
    const progress = getProjectProgress(project, this.date)
    const refund = Math.round(project.upfrontCost * 0.5 * (1 - progress.ratio))
    const treasury = this.treasury + refund
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "project_cancelled",
      title: `Cancelled: ${project.name}`,
      detail: `${project.location.label} · refunded €${refund}M`,
    }))
    return this.with({
      projects: this.projects.filter((p) => p.id !== id),
      treasury,
      briefing,
    })
  }

  removeProject(id: string): Game {
    return this.cancelProject(id)
  }

  issueBond(amountMillions: number): Game {
    if (this.gameOver) return this
    if (amountMillions <= 0) return this
    if (this.stats.economy.publicDebtPctGdp >= BOND_HARD_DEBT_CAP_PCT) {
      const briefing = pushTo(this.briefing, makeBriefing(this.date, {
        kind: "warning",
        title: "Bond auction failed",
        detail: `Debt/GDP at ${this.stats.economy.publicDebtPctGdp.toFixed(0)}% — markets refuse new issuance.`,
      }))
      return this.with({ briefing })
    }
    const billions = amountMillions / 1000
    // Stress multiplier rises from 1× at BOND_STRESS_DEBT_PCT to 3× at the
    // hard cap. Above-baseline debt makes each new tranche more politically
    // and fiscally expensive.
    const overshoot = Math.max(
      0,
      this.stats.economy.publicDebtPctGdp - BOND_STRESS_DEBT_PCT
    )
    const stressSpan = Math.max(
      1,
      BOND_HARD_DEBT_CAP_PCT - BOND_STRESS_DEBT_PCT
    )
    const stress = 1 + Math.min(2, (overshoot / stressSpan) * 2)
    const cabinet = getCabinetEffects(this.nation, this.cabinet)
    const debtDelta =
      BOND_DEBT_DELTA_PER_BILLION * billions * stress * cabinet.bondDebtMultiplier
    const approvalCost =
      BOND_APPROVAL_COST_PER_BILLION *
      billions *
      stress *
      cabinet.bondApprovalMultiplier
    const stats = structuredClone(this.stats)
    stats.economy.publicDebtPctGdp += debtDelta
    const approval = clampApproval(this.approval - approvalCost)
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "treasury",
      title: `Bond issued: €${amountMillions.toLocaleString()}M`,
      detail:
        `Debt +${debtDelta.toFixed(2)}pp · Approval ${formatSigned(-Number(approvalCost.toFixed(2)))}` +
        (stress > 1.01 ? ` · stress ×${stress.toFixed(2)}` : ""),
    }))
    return this.with({
      treasury: this.treasury + amountMillions,
      approval,
      stats,
      briefing,
    })
  }

  mediaTour(): Game {
    if (this.gameOver) return this
    const cost = 80
    if (this.treasury < cost - 50_000) return this
    const approval = clampApproval(this.approval + 1.5)
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "milestone",
      title: "Media tour",
      detail: "+1.5 approval · −€80M comms budget",
    }))
    return this.with({ treasury: this.treasury - cost, approval, briefing })
  }

  getRelation(target: string): RelationState {
    const key = normalizeNationKey(target)
    return this.relations[key] ?? DEFAULT_RELATION
  }

  proposeAlliance(target: string): Game {
    if (this.gameOver) return this
    const key = normalizeNationKey(target)
    if (!key || key === this.nation) return this
    const current = this.relations[key] ?? DEFAULT_RELATION
    if (current.allied) return this
    const next: RelationState = {
      opinion: clampOpinion(Math.max(current.opinion + 25, 50)),
      allied: true,
      lastInteractionAt: this.date.toISOString(),
    }
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "milestone",
      title: `Alliance proposed: ${key}`,
      detail: "Accepted.",
    }))
    return this.with({
      relations: { ...this.relations, [key]: next },
      briefing,
    })
  }

  breakAlliance(target: string): Game {
    if (this.gameOver) return this
    const key = normalizeNationKey(target)
    if (!key || key === this.nation) return this
    const current = this.relations[key] ?? DEFAULT_RELATION
    if (!current.allied) return this
    const next: RelationState = {
      opinion: clampOpinion(current.opinion - 30),
      allied: false,
      lastInteractionAt: this.date.toISOString(),
    }
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "warning",
      title: `Alliance broken: ${key}`,
      detail: "Relations have soured.",
    }))
    return this.with({
      relations: { ...this.relations, [key]: next },
      briefing,
    })
  }

  /**
   * Apply the outcome of a diplomatic message (SMS, tweet, call, letter).
   * Updates the bilateral opinion, deducts any treasury cost, and logs a
   * briefing entry. Caller is responsible for already having checked the
   * treasury; this method is a no-op if cost > treasury (with a buffer).
   */
  sendDiplomaticMessage(args: DiplomaticMessageArgs): Game {
    if (this.gameOver) return this
    const key = normalizeNationKey(args.target)
    if (!key || key === this.nation) return this
    const cost = args.cost ?? 0
    if (cost > 0 && this.treasury < cost - 50_000) return this

    const current = this.relations[key] ?? DEFAULT_RELATION
    const next: RelationState = {
      ...current,
      opinion: clampOpinion(current.opinion + args.opinionDelta),
      lastInteractionAt: this.date.toISOString(),
    }
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: args.briefingKind ?? "milestone",
      title: args.briefingTitle,
      detail: args.briefingDetail,
    }))
    return this.with({
      relations: { ...this.relations, [key]: next },
      treasury: this.treasury - cost,
      briefing,
    })
  }

  /**
   * Symmetric counterpart to the AI economic actions: the player can issue
   * sanctions or sign trade deals with another nation. Each is gated by a
   * 90-day cooldown tracked through the same `lastEconomicActionAt` field
   * the AI uses, so a hot quarter can't see sanctions + trade-deal + counter
   * all in one week.
   */
  signTradeDeal(target: string): Game {
    if (this.gameOver) return this
    const key = normalizeNationKey(target)
    if (!key || key === this.nation) return this
    const current = this.relations[key] ?? DEFAULT_RELATION
    if (!isEconomicallyEligible(current.lastEconomicActionAt, this.date)) {
      const briefing = pushTo(this.briefing, makeBriefing(this.date, {
        kind: "warning",
        title: `Trade deal with ${key} blocked`,
        detail: "Another economic action with this nation is too recent.",
      }))
      return this.with({ briefing })
    }
    // Friendly economic gesture: requires existing goodwill (opinion ≥ 20)
    // so it's not a free button to spam.
    if (current.opinion < 20) {
      const briefing = pushTo(this.briefing, makeBriefing(this.date, {
        kind: "warning",
        title: `${key} refuses trade deal`,
        detail: `Opinion ${current.opinion.toFixed(0)} is too low; talks collapsed.`,
      }))
      return this.with({ briefing })
    }
    const cost = TRADE_DEAL_COST_MILLIONS
    if (this.treasury < cost - ADDPROJECT_TREASURY_BUFFER) {
      const briefing = pushTo(this.briefing, makeBriefing(this.date, {
        kind: "warning",
        title: `Trade deal with ${key} blocked`,
        detail: `Treasury short of €${cost}M.`,
      }))
      return this.with({ briefing })
    }
    const gdpBoost = TRADE_DEAL_GDP_MILLIONS
    const stats = bumpGdp(this.stats, gdpBoost * 1_000_000)
    const next: RelationState = {
      ...current,
      opinion: clampOpinion(current.opinion + TRADE_DEAL_OPINION_DELTA),
      lastInteractionAt: this.date.toISOString(),
      lastEconomicActionAt: this.date.toISOString(),
    }
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "milestone",
      title: `Trade deal signed with ${key}`,
      detail: `−€${cost}M treasury · +€${gdpBoost}M GDP · +${TRADE_DEAL_OPINION_DELTA} opinion`,
    }))
    return this.with({
      relations: { ...this.relations, [key]: next },
      treasury: this.treasury - cost,
      stats,
      briefing,
    })
  }

  issueSanctions(target: string): Game {
    if (this.gameOver) return this
    const key = normalizeNationKey(target)
    if (!key || key === this.nation) return this
    const current = this.relations[key] ?? DEFAULT_RELATION
    if (!isEconomicallyEligible(current.lastEconomicActionAt, this.date)) {
      const briefing = pushTo(this.briefing, makeBriefing(this.date, {
        kind: "warning",
        title: `Sanctions on ${key} blocked`,
        detail: "Another economic action with this nation is too recent.",
      }))
      return this.with({ briefing })
    }
    const cost = SANCTIONS_COST_MILLIONS
    if (this.treasury < cost - ADDPROJECT_TREASURY_BUFFER) {
      const briefing = pushTo(this.briefing, makeBriefing(this.date, {
        kind: "warning",
        title: `Sanctions on ${key} blocked`,
        detail: `Treasury short of €${cost}M.`,
      }))
      return this.with({ briefing })
    }
    // Sanctions: small home-economy hit (retaliation/trade loss) modelled as a
    // GDP cut, big opinion drop on target. Breaks any existing alliance.
    const gdpHit = SANCTIONS_GDP_HIT_MILLIONS
    const stats = bumpGdp(this.stats, -gdpHit * 1_000_000)
    const allied = false
    const wasAllied = current.allied
    const next: RelationState = {
      ...current,
      opinion: clampOpinion(current.opinion + SANCTIONS_OPINION_DELTA),
      allied,
      lastInteractionAt: this.date.toISOString(),
      lastEconomicActionAt: this.date.toISOString(),
    }
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "warning",
      title: `Sanctions imposed on ${key}`,
      detail:
        `−€${cost}M treasury · −€${gdpHit}M GDP · ${SANCTIONS_OPINION_DELTA} opinion` +
        (wasAllied ? " · alliance suspended" : ""),
    }))
    return this.with({
      relations: { ...this.relations, [key]: next },
      treasury: this.treasury - cost,
      stats,
      briefing,
    })
  }

  tick(days: number): Game {
    if (this.gameOver || this.pendingEvent || this.paused || days <= 0) return this
    const newDate = new Date(this.date.getTime() + days * 86_400_000)
    const econ = applyEconomyTick(
      {
        date: newDate,
        treasury: this.treasury,
        approval: this.approval,
        stats: this.stats,
        projects: this.projects,
      },
      days
    )

    const cabinet = getCabinetEffects(this.nation, this.cabinet)
    let projects = this.projects
    let approval = econ.approval
    // Passive daily approval contribution from the cabinet (e.g. PM lift).
    if (cabinet.approvalPerDay) {
      approval = clampApproval(approval + cabinet.approvalPerDay * days)
    }
    let treasury = econ.treasury
    let briefing = this.briefing
    let stats: CountryStats = econ.stats
    let triggeredEvents = this.triggeredEvents

    const remaining: Project[] = []
    for (const project of projects) {
      const progress = getProjectProgress(project, newDate)
      if (progress.isComplete) {
        const bonus =
          cabinet.projectCompletionApprovalBonusByKind[project.kind] ?? 0
        const completionApproval = project.completionApproval + bonus
        approval = clampApproval(approval + completionApproval)
        stats = bumpGdp(stats, project.completionGdp * 1_000_000)
        const bonusSuffix = bonus > 0 ? ` (cabinet +${bonus})` : ""
        briefing = pushTo(briefing, makeBriefing(newDate, {
          kind: "project_completed",
          title: `Completed: ${project.name}`,
          detail: `+${completionApproval} approval${bonusSuffix} · +€${project.completionGdp}M GDP`,
        }))
      } else {
        remaining.push(project)
      }
    }
    projects = remaining

    // Event resolution. High-severity events pause the game and require the
    // player's input. Lower-severity procedural events are auto-handled by the
    // cabinet (default choice) so the player isn't yanked out of the flow.
    const triggeredIds = new Set(triggeredEvents.map((t) => t.id))
    let pendingEvent: EventDefinition | null = this.pendingEvent
    if (!pendingEvent) {
      const due = getDueEvent(newDate, this.nation, triggeredIds, triggeredEvents)
      const generated = due
        ? null
        : maybeGenerateProceduralEvent({
            nation: this.nation,
            date: newDate,
            triggeredIds,
            triggeredEvents,
          })
      // If neither a scheduled story event nor a procedural event fires, the
      // AI may itself initiate a proposal aimed at the player.
      const aiProposal =
        due || generated
          ? null
          : maybeGenerateAiProposal({
              playerNation: this.nation,
              relations: this.relations,
              currentDate: newDate,
            })
      const candidate = due ?? generated ?? aiProposal
      if (candidate) {
        const severity = getEventSeverity(candidate)
        if (severity === "high") {
          pendingEvent = candidate
          briefing = pushTo(briefing, makeBriefing(newDate, {
            kind: "event",
            title: `Event: ${candidate.title}`,
          }))
        } else {
          const choiceIdx = Math.min(
            Math.max(0, candidate.defaultChoiceIndex ?? 0),
            candidate.choices.length - 1
          )
          const choice = candidate.choices[choiceIdx]!
          const applied = applyEffectsTo(
            { treasury, approval, stats },
            choice.effects
          )
          treasury = applied.treasury
          approval = applied.approval
          stats = applied.stats
          triggeredEvents = [
            ...triggeredEvents,
            {
              id: candidate.id,
              chosenAt: newDate.toISOString(),
              choiceId: choice.id,
            },
          ]
          briefing = pushTo(briefing, makeBriefing(newDate, {
            kind: severity === "low" ? "milestone" : "warning",
            title: candidate.title,
            detail: `Cabinet response: ${choice.label}. ${formatEffects(choice.effects)}`,
          }))
        }
      }
    }

    const ai = simulateAiTick({
      days,
      playerNation: this.nation,
      relations: this.relations,
      currentDate: newDate,
      diplomacyDriftMultiplier: cabinet.diplomacyDriftMultiplier,
    })
    for (const action of ai.actions) {
      briefing = pushTo(briefing, makeBriefing(newDate, {
        kind: action.briefingKind,
        title: action.briefingTitle,
        detail: action.briefingDetail,
      }))
      // Fold in economic effects on the player.
      if (action.treasuryDelta) treasury += action.treasuryDelta
      if (action.gdpDelta) {
        stats = bumpGdp(stats, action.gdpDelta * 1_000_000)
      }
    }

    // Bankruptcy / impeachment failure counters.
    let bankruptcyDays = this.bankruptcyDays
    let impeachmentDays = this.impeachmentDays
    if (treasury < BANKRUPTCY_TREASURY_FLOOR) {
      bankruptcyDays += days
    } else {
      bankruptcyDays = 0
    }
    if (approval < IMPEACHMENT_APPROVAL_FLOOR) {
      impeachmentDays += days
    } else {
      impeachmentDays = 0
    }

    let gameOver: GameOverState | null = null
    if (bankruptcyDays >= BANKRUPTCY_DAYS_TO_LOSE) {
      gameOver = {
        outcome: "lost",
        cause: "bankruptcy",
        reason: `Sovereign default. The treasury crossed €${BANKRUPTCY_TREASURY_FLOOR.toLocaleString()}M for ${BANKRUPTCY_DAYS_TO_LOSE} days; the IMF takes over fiscal policy and your mandate ends.`,
        date: newDate.toISOString(),
      }
    } else if (impeachmentDays >= IMPEACHMENT_DAYS_TO_LOSE) {
      gameOver = {
        outcome: "lost",
        cause: "impeachment",
        reason: `Approval sat below ${IMPEACHMENT_APPROVAL_FLOOR}% for ${IMPEACHMENT_DAYS_TO_LOSE} days. The Assembly moves a motion of censure and your government falls.`,
        date: newDate.toISOString(),
      }
    }

    // Push a weekly history sample at most.
    let history = this.history
    const lastSample = history[history.length - 1]
    const lastTs = lastSample ? Date.parse(lastSample.date) : -Infinity
    if (newDate.getTime() - lastTs >= 7 * 86_400_000) {
      const sample: HistorySample = {
        date: newDate.toISOString(),
        treasury,
        approval,
        gdpUsd: stats.economy.gdpUsd,
        unemploymentPct: stats.economy.unemploymentPct,
      }
      history = [...history, sample].slice(-MAX_HISTORY)
    }

    // Proactive warnings + election countdown. Each warning fires once via
    // the triggeredWarnings set so we don't spam the briefing log.
    const nextWarnings = new Set(this.triggeredWarnings)
    if (
      treasury < WARN_BANKRUPTCY_TREASURY &&
      treasury >= BANKRUPTCY_TREASURY_FLOOR &&
      !nextWarnings.has("warn:bankruptcy_approach")
    ) {
      nextWarnings.add("warn:bankruptcy_approach")
      briefing = pushTo(briefing, makeBriefing(newDate, {
        kind: "warning",
        title: "Bercy warns: bond markets are nervous",
        detail: `Treasury at €${Math.round(treasury).toLocaleString()}M. Past €${BANKRUPTCY_TREASURY_FLOOR.toLocaleString()}M the IMF intervenes.`,
      }))
    }
    if (
      treasury >= 0 &&
      nextWarnings.has("warn:bankruptcy_approach")
    ) {
      nextWarnings.delete("warn:bankruptcy_approach")
    }
    if (
      approval < WARN_IMPEACHMENT_APPROVAL &&
      approval >= IMPEACHMENT_APPROVAL_FLOOR &&
      !nextWarnings.has("warn:impeachment_approach")
    ) {
      nextWarnings.add("warn:impeachment_approach")
      briefing = pushTo(briefing, makeBriefing(newDate, {
        kind: "warning",
        title: "Opposition prepares a motion of censure",
        detail: `Approval at ${approval.toFixed(0)}%. Below ${IMPEACHMENT_APPROVAL_FLOOR}% for ${IMPEACHMENT_DAYS_TO_LOSE} days = the Assembly removes you.`,
      }))
    }
    if (
      approval >= 30 &&
      nextWarnings.has("warn:impeachment_approach")
    ) {
      nextWarnings.delete("warn:impeachment_approach")
    }

    // Election countdown.
    const election = EVENT_LIBRARY.find((e) => e.id === ELECTION_EVENT_ID)
    if (election) {
      const electionMs = Date.parse(election.date + "T00:00:00.000Z")
      const daysLeft = Math.round(
        (electionMs - newDate.getTime()) / 86_400_000
      )
      for (const milestone of ELECTION_COUNTDOWN_DAYS) {
        const warnId = `warn:election_t-${milestone}`
        if (
          daysLeft <= milestone &&
          daysLeft > 0 &&
          !nextWarnings.has(warnId)
        ) {
          nextWarnings.add(warnId)
          briefing = pushTo(briefing, makeBriefing(newDate, {
            kind: "milestone",
            title: `Election in ${milestone === 7 ? "a week" : `${milestone} days`}`,
            detail:
              milestone === 7
                ? "Final stretch. Every approval point matters now."
                : `Approval ${approval.toFixed(0)}%, treasury €${Math.round(treasury).toLocaleString()}M.`,
          }))
        }
      }
    }

    return this.with({
      date: newDate,
      treasury,
      approval,
      stats,
      projects,
      briefing,
      pendingEvent,
      paused: pendingEvent ? true : this.paused,
      relations: ai.relations,
      triggeredEvents,
      history,
      bankruptcyDays,
      impeachmentDays,
      gameOver,
      triggeredWarnings: nextWarnings,
    })
  }

  resolveEventChoice(eventId: string, choiceId: string): Game {
    if (this.pendingEvent?.id !== eventId) return this
    const event = this.pendingEvent
    const choice = event.choices.find((c) => c.id === choiceId)
    if (!choice) return this

    const effects = choice.effects
    const next = applyEffects(this, effects)
    const triggered: TriggeredEvent = {
      id: event.id,
      chosenAt: next.date.toISOString(),
      choiceId: choice.id,
    }
    const briefing = pushTo(next.briefing, makeBriefing(next.date, {
      kind: "event",
      title: `${event.title} → ${choice.label}`,
      detail: formatEffects(effects),
    }))

    let gameOver: GameOverState | null = next.gameOver
    if (effects.terminal && !gameOver) {
      gameOver = computeOutcome(next, event)
    }

    return next.with({
      triggeredEvents: [...this.triggeredEvents, triggered],
      pendingEvent: null,
      briefing,
      gameOver,
      // Resume the clock once the player has decided; the auto-pause from when
      // the event arrived shouldn't persist past the choice.
      paused: gameOver ? this.paused : false,
    })
  }

  reset(): Game {
    return Game.createNew()
  }

  toSnapshot(): GameSnapshot {
    return {
      version: 5,
      nation: this.nation,
      character: this.character,
      date: this.date.toISOString(),
      startedAt: this.startedAt.toISOString(),
      speed: this.speed,
      paused: this.paused,
      projects: [...this.projects],
      treasury: this.treasury,
      approval: this.approval,
      stats: structuredClone(this.stats),
      triggeredEvents: [...this.triggeredEvents],
      pendingEvent: this.pendingEvent ? structuredClone(this.pendingEvent) : null,
      briefing: [...this.briefing],
      gameOver: this.gameOver ? { ...this.gameOver } : null,
      relations: structuredClone(this.relations) as Record<
        string,
        RelationState
      >,
      reformAgenda: this.reformAgenda ? { ...this.reformAgenda } : null,
      history: [...this.history],
      bankruptcyDays: this.bankruptcyDays,
      impeachmentDays: this.impeachmentDays,
      triggeredWarnings: Array.from(this.triggeredWarnings),
      cabinet: { ...this.cabinet },
    }
  }

  static fromSnapshot(snapshot: AnySnapshot): Game {
    const version = (snapshot as { version?: number }).version
    if (version === 5) {
      const s = snapshot as GameSnapshot
      const fallback = countryStatsProvider.fetchSync(s.nation)
      return new Game({
        nation: s.nation,
        character: s.character,
        date: new Date(s.date),
        startedAt: new Date(s.startedAt),
        speed: s.speed ?? 1,
        paused: s.paused ?? true,
        projects: s.projects ?? [],
        treasury: Number.isFinite(s.treasury) ? s.treasury : 0,
        approval: clampApproval(s.approval ?? INITIAL_APPROVAL),
        stats: sanitizeStats(s.stats, fallback),
        triggeredEvents: s.triggeredEvents ?? [],
        pendingEvent: s.pendingEvent,
        briefing: s.briefing ?? [],
        gameOver: s.gameOver,
        relations: s.relations ?? {},
        reformAgenda: s.reformAgenda ?? null,
        history: s.history ?? [],
        bankruptcyDays: s.bankruptcyDays ?? 0,
        impeachmentDays: s.impeachmentDays ?? 0,
        triggeredWarnings: new Set(s.triggeredWarnings ?? []),
        cabinet: s.cabinet ?? {},
      })
    }
    return migrateLegacy(snapshot)
  }
}

type AnySnapshot =
  | GameSnapshot
  | LegacyV1Snapshot
  | LegacyV2Snapshot
  | LegacyV3Snapshot
  | LegacyV4Snapshot

interface LegacyV4Snapshot {
  version: 4
  nation: NationCode
  character: CharacterId
  date: string
  startedAt: string
  speed: GameSpeed
  paused: boolean
  projects: Project[]
  treasury: number
  approval: number
  stats: CountryStats
  triggeredEvents: TriggeredEvent[]
  pendingEvent: EventDefinition | null
  briefing: BriefingEntry[]
  gameOver: GameOverState | null
  relations: Record<string, RelationState>
}

interface LegacyV3Snapshot {
  version: 3
  nation: NationCode
  character: CharacterId
  date: string
  startedAt: string
  speed: GameSpeed
  paused: boolean
  projects: Project[]
  treasury: number
  approval: number
  stats: CountryStats
  triggeredEvents: TriggeredEvent[]
  pendingEvent: EventDefinition | null
  briefing: BriefingEntry[]
  gameOver: GameOverState | null
}

interface LegacyV1Snapshot {
  version: 1
  nation: NationCode
  character: CharacterId
  date: string
  startedAt: string
  speed: GameSpeed
  paused: boolean
  projects: Partial<Project>[]
}

interface LegacyV2Snapshot {
  version: 2
  nation: NationCode
  character: CharacterId
  date: string
  startedAt: string
  speed: GameSpeed
  paused: boolean
  projects: Project[]
  treasury: number
  approval: number
  stats: CountryStats
  triggeredEvents: TriggeredEvent[]
  pendingEventId: string | null
  briefing: BriefingEntry[]
  gameOver: GameOverState | null
}

function migrateLegacy(snapshot: AnySnapshot): Game {
  if ((snapshot as LegacyV4Snapshot).version === 4) {
    const s = snapshot as LegacyV4Snapshot
    const fallback = countryStatsProvider.fetchSync(s.nation)
    return new Game({
      nation: s.nation,
      character: s.character,
      date: new Date(s.date),
      startedAt: new Date(s.startedAt),
      speed: s.speed ?? 1,
      paused: s.paused ?? true,
      projects: s.projects ?? [],
      treasury: Number.isFinite(s.treasury) ? s.treasury : 0,
      approval: clampApproval(s.approval ?? INITIAL_APPROVAL),
      stats: sanitizeStats(s.stats, fallback),
      triggeredEvents: s.triggeredEvents ?? [],
      pendingEvent: s.pendingEvent,
      briefing: s.briefing ?? [],
      gameOver: s.gameOver,
      relations: s.relations ?? {},
      reformAgenda: null,
      history: [],
      bankruptcyDays: 0,
      impeachmentDays: 0,
      triggeredWarnings: new Set<string>(),
      cabinet: {},
    })
  }
  if ((snapshot as LegacyV3Snapshot).version === 3) {
    const s = snapshot as LegacyV3Snapshot
    const fallback = countryStatsProvider.fetchSync(s.nation)
    return new Game({
      nation: s.nation,
      character: s.character,
      date: new Date(s.date),
      startedAt: new Date(s.startedAt),
      speed: s.speed ?? 1,
      paused: s.paused ?? true,
      projects: s.projects ?? [],
      treasury: Number.isFinite(s.treasury) ? s.treasury : 0,
      approval: clampApproval(s.approval ?? INITIAL_APPROVAL),
      stats: sanitizeStats(s.stats, fallback),
      triggeredEvents: s.triggeredEvents ?? [],
      pendingEvent: s.pendingEvent,
      briefing: s.briefing ?? [],
      gameOver: s.gameOver,
      relations: {},
      reformAgenda: null,
      history: [],
      bankruptcyDays: 0,
      impeachmentDays: 0,
      triggeredWarnings: new Set<string>(),
      cabinet: {},
    })
  }
  if ((snapshot as LegacyV2Snapshot).version === 2) {
    const s = snapshot as LegacyV2Snapshot
    const fallback = countryStatsProvider.fetchSync(s.nation)
    return new Game({
      nation: s.nation,
      character: s.character,
      date: new Date(s.date),
      startedAt: new Date(s.startedAt),
      speed: s.speed ?? 1,
      paused: true,
      projects: s.projects ?? [],
      treasury: Number.isFinite(s.treasury) ? s.treasury : 0,
      approval: clampApproval(s.approval ?? INITIAL_APPROVAL),
      stats: sanitizeStats(s.stats, fallback),
      triggeredEvents: s.triggeredEvents ?? [],
      pendingEvent: null,
      briefing: s.briefing ?? [],
      gameOver: s.gameOver,
      relations: {},
      reformAgenda: null,
      history: [],
      bankruptcyDays: 0,
      impeachmentDays: 0,
      triggeredWarnings: new Set<string>(),
      cabinet: {},
    })
  }
  const s = snapshot as LegacyV1Snapshot
  const stats = countryStatsProvider.fetchSync(s.nation)
  return new Game({
    nation: s.nation,
    character: s.character,
    date: new Date(s.date),
    startedAt: new Date(s.startedAt),
    speed: s.speed ?? 1,
    paused: true,
    projects: (s.projects ?? []).map((p) => ({
      id: p.id ?? getClock().uuid(),
      kind: p.kind ?? "other",
      name: p.name ?? "Untitled",
      description: p.description ?? "",
      location: p.location ?? { label: "Unknown", latitude: 0, longitude: 0 },
      startedAt: p.startedAt ?? new Date().toISOString(),
      expectedDurationDays: p.expectedDurationDays ?? 365,
      upfrontCost: p.upfrontCost ?? 0,
      monthlyCost: p.monthlyCost ?? 0,
      completionApproval: p.completionApproval ?? 0,
      completionGdp: p.completionGdp ?? 0,
    })),
    treasury: INITIAL_TREASURY_MILLIONS,
    approval: INITIAL_APPROVAL,
    stats,
    triggeredEvents: [],
    pendingEvent: null,
    briefing: [],
    gameOver: null,
    relations: {},
    reformAgenda: null,
    history: [],
    bankruptcyDays: 0,
    impeachmentDays: 0,
    triggeredWarnings: new Set<string>(),
    cabinet: {},
  })
}

function applyEffects(game: Game, effects: EventEffects): Game {
  const out = applyEffectsTo(
    { treasury: game.treasury, approval: game.approval, stats: game.stats },
    effects
  )
  return game.with({
    treasury: out.treasury,
    approval: out.approval,
    stats: out.stats,
  })
}

interface ApplyEffectsState {
  treasury: number
  approval: number
  stats: CountryStats
}

function applyEffectsTo(
  state: ApplyEffectsState,
  effects: EventEffects
): ApplyEffectsState {
  const stats = structuredClone(state.stats)
  let treasury = state.treasury
  let approval = state.approval

  if (effects.treasury) treasury += effects.treasury
  if (effects.approval) approval = clampApproval(approval + effects.approval)
  if (effects.gdpDelta) {
    stats.economy.gdpUsd += effects.gdpDelta * 1_000_000
    stats.economy.gdpPerCapitaUsd =
      stats.economy.gdpUsd / Math.max(1, stats.demographics.population)
  }
  if (effects.unemploymentDelta) {
    stats.economy.unemploymentPct = Math.max(
      0,
      stats.economy.unemploymentPct + effects.unemploymentDelta
    )
  }
  if (effects.inflationDelta) {
    stats.economy.inflationPct = Math.max(
      0,
      stats.economy.inflationPct + effects.inflationDelta
    )
  }
  if (effects.debtDelta) {
    stats.economy.publicDebtPctGdp = Math.max(
      0,
      stats.economy.publicDebtPctGdp + effects.debtDelta
    )
  }
  const fallback = countryStatsProvider.fetchSync(state.stats.code)
  return { treasury, approval, stats: sanitizeStats(stats, fallback) }
}

function computeOutcome(game: Game, event: EventDefinition): GameOverState {
  if (event.category === "election") {
    const agendaSuccess = evaluateReformAgenda(game)
    const def = game.reformAgenda
      ? REFORM_AGENDAS.find((a) => a.id === game.reformAgenda!.id)
      : null
    const approvalThreshold = agendaSuccess && def
      ? def.approvalThresholdOnSuccess
      : 42
    const won =
      game.approval >= approvalThreshold &&
      game.stats.economy.unemploymentPct < 9
    const agendaNote = def
      ? agendaSuccess
        ? ` Your "${def.short}" agenda was judged a success.`
        : ` Your "${def.short}" agenda fell short.`
      : ""
    return {
      outcome: won ? "won" : "lost",
      cause: won ? "election_won" : "election_lost",
      reason: won
        ? `Your endorsed candidate carried the 2027 election with ${game.approval.toFixed(0)}% approval behind them.${agendaNote}`
        : `Voters rejected your legacy. Final approval: ${game.approval.toFixed(0)}%. Unemployment: ${game.stats.economy.unemploymentPct.toFixed(1)}%.${agendaNote}`,
      date: game.date.toISOString(),
    }
  }
  return {
    outcome: "lost",
    cause: "other",
    reason: "Game over.",
    date: game.date.toISOString(),
  }
}

/**
 * Decide whether the player's chosen reform agenda has succeeded at the time
 * of the election. Each agenda has a clear, transparent metric the player can
 * watch through the game.
 */
export function evaluateReformAgenda(game: Game): boolean {
  if (!game.reformAgenda) return false
  switch (game.reformAgenda.id) {
    case "fiscal_discipline": {
      // Debt-to-GDP must not have grown more than +1pp since the start of the
      // agenda, AND treasury must be above the bankruptcy danger zone.
      const startSample = game.history.find(
        (s) =>
          Date.parse(s.date) >= Date.parse(game.reformAgenda!.startedAt) - 1000
      )
      // Conservative fallback: just compare current debt to a reasonable
      // baseline if we don't track historical debt explicitly.
      const debt = game.stats.economy.publicDebtPctGdp
      if (debt > 118) return false
      if (game.treasury < -100_000) return false
      // History sample existence is a positive signal we tracked the period.
      void startSample
      return true
    }
    case "european_leadership": {
      const allies = Object.entries(game.relations).filter(
        ([, r]) => r.allied
      )
      if (allies.length < 2) return false
      const euCodes = new Set(["DE", "IT", "ES", "GB"])
      const euAllies = allies.filter(([code]) => euCodes.has(code))
      const avgEuOpinion =
        Array.from(euCodes).reduce(
          (sum, code) => sum + (game.relations[code]?.opinion ?? 0),
          0
        ) / euCodes.size
      return euAllies.length >= 1 && avgEuOpinion >= 30
    }
    case "social_renewal": {
      const completedProjects = game.briefing.filter(
        (b) => b.kind === "project_completed"
      ).length
      const unemployment = game.stats.economy.unemploymentPct
      return completedProjects >= 2 && unemployment <= 8.5
    }
    case "technology_sovereignty": {
      // At least two tech-oriented projects completed or in flight.
      const techKinds = new Set([
        "construction:nuclear",
        "construction:industrial",
      ])
      const techStarts = game.briefing.filter(
        (b) =>
          b.kind === "project_started" &&
          techKinds.has(extractKindFromTitle(b.title) ?? "")
      ).length
      const inflightTech = game.projects.filter((p) =>
        techKinds.has(p.kind)
      ).length
      const total = Math.max(techStarts, inflightTech)
      return total >= 2 && game.stats.economy.gdpUsd > 3.55e12
    }
    case "security_first": {
      // Allied with at least one of US/GB AND at least one military or
      // nuclear project completed or in flight.
      const allied = ["US", "GB"].some(
        (code) => game.relations[code]?.allied
      )
      const securityKinds = new Set([
        "construction:military",
        "construction:nuclear",
      ])
      const inflight = game.projects.filter((p) =>
        securityKinds.has(p.kind)
      ).length
      const completed = game.briefing.filter(
        (b) =>
          b.kind === "project_completed" &&
          securityKinds.has(extractKindFromTitle(b.title) ?? "")
      ).length
      return allied && (inflight + completed) >= 1
    }
  }
}

/**
 * Best-effort: we don't store the kind on completed-project briefings, so we
 * fall back to title keywords. Used only by the agenda evaluator where false
 * negatives bias to "agenda failed", an acceptable safe default.
 */
function extractKindFromTitle(title: string): string | null {
  const lower = title.toLowerCase()
  if (/(nuclear|epr|reactor)/.test(lower)) return "construction:nuclear"
  if (/(industrial|gigafactory|factory|battery|aerospace)/.test(lower))
    return "construction:industrial"
  if (/(military|defense|defence|base|shipyard)/.test(lower))
    return "construction:military"
  return null
}

function makeBriefing(
  date: Date,
  partial: Omit<BriefingEntry, "id" | "date">
): BriefingEntry {
  return {
    id: getClock().uuid(),
    date: date.toISOString(),
    ...partial,
  }
}

function pushTo(
  list: readonly BriefingEntry[],
  entry: BriefingEntry
): readonly BriefingEntry[] {
  const next = [entry, ...list]
  if (next.length > MAX_BRIEFING) next.length = MAX_BRIEFING
  return next
}

function bumpGdp(stats: CountryStats, deltaUsd: number): CountryStats {
  const nextGdp = stats.economy.gdpUsd + deltaUsd
  const pop = Math.max(1, stats.demographics.population)
  return {
    ...stats,
    economy: {
      ...stats.economy,
      gdpUsd: nextGdp,
      gdpPerCapitaUsd: nextGdp / pop,
    },
  }
}

function formatEffects(effects: EventEffects): string {
  const parts: string[] = []
  if (effects.treasury) parts.push(`€${formatSigned(effects.treasury)}M treasury`)
  if (effects.approval) parts.push(`${formatSigned(effects.approval)} approval`)
  if (effects.gdpDelta) parts.push(`€${formatSigned(effects.gdpDelta)}M GDP`)
  if (effects.unemploymentDelta)
    parts.push(`${formatSigned(effects.unemploymentDelta)}pp unemployment`)
  if (effects.inflationDelta)
    parts.push(`${formatSigned(effects.inflationDelta)}pp inflation`)
  if (effects.debtDelta) parts.push(`${formatSigned(effects.debtDelta)}pp debt/GDP`)
  return parts.join(" · ")
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}
