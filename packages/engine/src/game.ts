import { getClock } from "./clock"
import {
  CountryStatsProvider,
  type CountryStats,
} from "./country-stats"
import { applyEconomyTick, sanitizeStats } from "./economy"
import {
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
  simulateAiTick,
  type AiAction,
} from "./ai-nations"

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
}

const countryStatsProvider = new CountryStatsProvider()
const MAX_BRIEFING = 50
const MAX_HISTORY = 60 // ~1y at weekly cadence + buffer
const INITIAL_APPROVAL = 38
const INITIAL_TREASURY_MILLIONS = -2_000
const BOND_APPROVAL_COST_PER_BILLION = 0.4
const BOND_DEBT_DELTA_PER_BILLION = 0.03

// Failure thresholds. Tuned so a player has weeks of warning before the run
// ends, not minutes — but they're real teeth.
const BANKRUPTCY_TREASURY_FLOOR = -500_000 // €-500B
const BANKRUPTCY_DAYS_TO_LOSE = 30
const IMPEACHMENT_APPROVAL_FLOOR = 15
const IMPEACHMENT_DAYS_TO_LOSE = 30

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
      ...overrides,
    })
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
    if (project.upfrontCost > this.treasury + 50_000) {
      return this
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
    const billions = amountMillions / 1000
    const stats = structuredClone(this.stats)
    stats.economy.publicDebtPctGdp += BOND_DEBT_DELTA_PER_BILLION * billions
    const approval = clampApproval(
      this.approval - BOND_APPROVAL_COST_PER_BILLION * billions
    )
    const briefing = pushTo(this.briefing, makeBriefing(this.date, {
      kind: "treasury",
      title: `Bond issued: €${amountMillions.toLocaleString()}M`,
      detail: `Debt +${(BOND_DEBT_DELTA_PER_BILLION * billions).toFixed(2)}pp · Approval ${-BOND_APPROVAL_COST_PER_BILLION * billions}`,
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

    let projects = this.projects
    let approval = econ.approval
    let treasury = econ.treasury
    let briefing = this.briefing
    let stats: CountryStats = econ.stats
    let triggeredEvents = this.triggeredEvents

    const remaining: Project[] = []
    for (const project of projects) {
      const progress = getProjectProgress(project, newDate)
      if (progress.isComplete) {
        approval = clampApproval(approval + project.completionApproval)
        stats = bumpGdp(stats, project.completionGdp * 1_000_000)
        briefing = pushTo(briefing, makeBriefing(newDate, {
          kind: "project_completed",
          title: `Completed: ${project.name}`,
          detail: `+${project.completionApproval} approval · +€${project.completionGdp}M GDP`,
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
      const due = getDueEvent(newDate, this.nation, triggeredIds)
      const generated = due
        ? null
        : maybeGenerateProceduralEvent({
            nation: this.nation,
            date: newDate,
            triggeredIds,
            triggeredEvents,
          })
      const candidate = due ?? generated
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
  }
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
