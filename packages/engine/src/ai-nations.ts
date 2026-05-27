import { getClock } from "./clock"
import type { ProjectKind } from "./projects"
import {
  DEFAULT_RELATION,
  type BriefingKind,
  type NationCode,
  type RelationState,
} from "./game"

export type AiStance = "ally" | "rival" | "neutral" | "hostile"

export interface AiNationProfile {
  code: string
  name: string
  stance: AiStance
  /** Opinion the nation drifts toward over time, -100..+100. */
  baseOpinion: number
  /** 0..1. Higher = more frequent autonomous actions. */
  activity: number
  /** Opinion delta applied per day toward the player project of this kind. */
  reactsTo: Partial<Record<ProjectKind, number>>
}

/**
 * Curated roster of major nations the world simulates. Values are hand-tuned
 * for a 2026 France-centric start; they are not meant to be precise.
 */
export const AI_NATIONS: readonly AiNationProfile[] = [
  {
    code: "US",
    name: "United States",
    stance: "ally",
    baseOpinion: 35,
    activity: 0.8,
    reactsTo: {
      "construction:nuclear": -3,
      "construction:military": 4,
      "construction:industrial": -1,
      diplomacy: 2,
    },
  },
  {
    code: "GB",
    name: "United Kingdom",
    stance: "ally",
    baseOpinion: 25,
    activity: 0.6,
    reactsTo: {
      "construction:military": 3,
      "construction:nuclear": -2,
      diplomacy: 2,
    },
  },
  {
    code: "DE",
    name: "Germany",
    stance: "ally",
    baseOpinion: 45,
    activity: 0.7,
    reactsTo: {
      "construction:nuclear": -5,
      "construction:industrial": 2,
      "construction:infrastructure": 3,
      diplomacy: 3,
    },
  },
  {
    code: "IT",
    name: "Italy",
    stance: "neutral",
    baseOpinion: 20,
    activity: 0.4,
    reactsTo: {
      "construction:infrastructure": 2,
      diplomacy: 2,
    },
  },
  {
    code: "ES",
    name: "Spain",
    stance: "neutral",
    baseOpinion: 15,
    activity: 0.4,
    reactsTo: {
      "construction:infrastructure": 2,
      diplomacy: 2,
    },
  },
  {
    code: "RU",
    name: "Russia",
    stance: "hostile",
    baseOpinion: -45,
    activity: 0.7,
    reactsTo: {
      "construction:military": -6,
      "construction:nuclear": -8,
      diplomacy: -2,
    },
  },
  {
    code: "CN",
    name: "China",
    stance: "rival",
    baseOpinion: -15,
    activity: 0.6,
    reactsTo: {
      "construction:military": -4,
      "construction:nuclear": -5,
      "construction:industrial": -3,
      diplomacy: 1,
    },
  },
  {
    code: "JP",
    name: "Japan",
    stance: "ally",
    baseOpinion: 20,
    activity: 0.4,
    reactsTo: {
      "construction:industrial": 2,
      diplomacy: 2,
    },
  },
]

const PROFILE_INDEX: Record<string, AiNationProfile> = Object.fromEntries(
  AI_NATIONS.map((p) => [p.code, p])
)

export function getAiProfile(code: string): AiNationProfile | null {
  return PROFILE_INDEX[code.trim().toUpperCase()] ?? null
}

export interface ProjectReaction {
  code: string
  opinionDelta: number
  briefingTitle: string
}

/**
 * Compute how each AI nation reacts to a freshly added player project.
 * Only returns entries whose magnitude clears a small noise threshold, so we
 * don't spam the briefing with ±1 noise.
 */
export function computeProjectReactions(
  projectKind: ProjectKind,
  projectName: string,
  playerNation: string
): ProjectReaction[] {
  const out: ProjectReaction[] = []
  const playerKey = playerNation.toUpperCase()
  for (const profile of AI_NATIONS) {
    if (profile.code === playerKey) continue
    const delta = profile.reactsTo[projectKind]
    if (!delta || Math.abs(delta) < 2) continue
    out.push({
      code: profile.code,
      opinionDelta: delta,
      briefingTitle:
        delta > 0
          ? `${profile.name} welcomes “${projectName}”`
          : `${profile.name} criticises “${projectName}”`,
    })
  }
  return out
}

export type AiActionKind =
  | "propose_alliance"
  | "break_alliance"
  | "friendly"
  | "hostile"
  | "trade_deal"
  | "foreign_investment"
  | "sanctions"
  | "tariffs"

export interface AiAction {
  code: string
  kind: AiActionKind
  opinionDelta: number
  briefingKind: BriefingKind
  briefingTitle: string
  briefingDetail?: string
  setAllied?: boolean
  /** Economic effect on the player (€M into treasury, signed). */
  treasuryDelta?: number
  /** Economic effect on the player's GDP (€M / USD-equiv, signed). */
  gdpDelta?: number
  /** Sets `lastEconomicActionAt` on the nation's relation record. */
  isEconomic?: boolean
}

export interface AiTickInput {
  days: number
  playerNation: NationCode | string
  relations: Readonly<Record<string, RelationState>>
  currentDate: Date
}

export interface AiTickResult {
  relations: Record<string, RelationState>
  actions: AiAction[]
}

const DRIFT_PER_DAY = 0.002
const ACTION_BASE_CHANCE_PER_DAY = 0.01
const ECONOMIC_COOLDOWN_DAYS = 90
const MS_PER_DAY = 86_400_000

/**
 * One step of autonomous-AI simulation. Pure given the clock RNG: it does not
 * touch the player, treasury, or any state outside `relations`. The caller is
 * responsible for folding `actions` into briefings + relations onto a Game.
 */
export function simulateAiTick(input: AiTickInput): AiTickResult {
  const playerKey = input.playerNation.toUpperCase()
  const nextRelations: Record<string, RelationState> = { ...input.relations }
  const actions: AiAction[] = []
  const rand = () => getClock().random()
  const days = Math.max(1, input.days)
  const isoDate = input.currentDate.toISOString()

  const nowMs = input.currentDate.getTime()
  for (const profile of AI_NATIONS) {
    if (profile.code === playerKey) continue
    const current = nextRelations[profile.code] ?? DEFAULT_RELATION

    // Drift opinion toward baseOpinion. Geometric so big `days` still
    // converge asymptotically rather than overshooting in one tick.
    const gap = profile.baseOpinion - current.opinion
    const driftFraction = 1 - Math.pow(1 - DRIFT_PER_DAY, days)
    let opinion = clamp(current.opinion + gap * driftFraction, -100, 100)
    let allied = current.allied
    let lastInteractionAt = current.lastInteractionAt
    let lastEconomicActionAt = current.lastEconomicActionAt ?? null

    // Maybe take an autonomous action.
    const actionChance = Math.min(
      0.6,
      profile.activity * ACTION_BASE_CHANCE_PER_DAY * days
    )
    if (rand() < actionChance) {
      const action = decideAction(profile, opinion, allied)
      if (action) {
        opinion = clamp(opinion + action.opinionDelta, -100, 100)
        if (action.setAllied !== undefined) allied = action.setAllied
        lastInteractionAt = isoDate
        actions.push(action)
      }
    }

    // Economic action: at most once every ECONOMIC_COOLDOWN_DAYS per nation.
    const lastEcoMs = lastEconomicActionAt
      ? Date.parse(lastEconomicActionAt)
      : NaN
    const eligible =
      Number.isNaN(lastEcoMs) ||
      nowMs - lastEcoMs >= ECONOMIC_COOLDOWN_DAYS * MS_PER_DAY
    if (eligible) {
      // Roughly one chance per quarter; activity scales frequency.
      const chance = Math.min(
        0.5,
        (profile.activity * days) / ECONOMIC_COOLDOWN_DAYS
      )
      if (rand() < chance) {
        const action = decideEconomicAction(profile, opinion, allied, rand)
        if (action) {
          opinion = clamp(opinion + action.opinionDelta, -100, 100)
          lastInteractionAt = isoDate
          lastEconomicActionAt = isoDate
          actions.push(action)
        }
      }
    }

    // Only persist a record when something is non-default.
    if (
      opinion !== DEFAULT_RELATION.opinion ||
      allied !== DEFAULT_RELATION.allied ||
      lastInteractionAt !== DEFAULT_RELATION.lastInteractionAt ||
      lastEconomicActionAt !== null
    ) {
      nextRelations[profile.code] = {
        opinion: round1(opinion),
        allied,
        lastInteractionAt,
        lastEconomicActionAt,
      }
    }
  }

  return { relations: nextRelations, actions }
}

function decideEconomicAction(
  profile: AiNationProfile,
  opinion: number,
  allied: boolean,
  rand: () => number
): AiAction | null {
  // Magnitude scales with how strongly the nation feels.
  const intensity = Math.min(1, Math.abs(opinion) / 80)
  const noise = 0.7 + rand() * 0.6 // 0.7..1.3

  if (opinion >= 50 || allied) {
    // Friendly economic gesture: trade deal or foreign investment.
    if (rand() < 0.5) {
      const gdp = Math.round(800 * intensity * noise)
      return {
        code: profile.code,
        kind: "trade_deal",
        opinionDelta: 1,
        gdpDelta: gdp,
        treasuryDelta: Math.round(gdp * 0.05),
        isEconomic: true,
        briefingKind: "milestone",
        briefingTitle: `${profile.name} signs a trade deal`,
        briefingDetail: `+€${gdp}M GDP · +€${Math.round(gdp * 0.05)}M treasury`,
      }
    }
    const invest = Math.round(600 * intensity * noise)
    return {
      code: profile.code,
      kind: "foreign_investment",
      opinionDelta: 1,
      gdpDelta: invest,
      isEconomic: true,
      briefingKind: "milestone",
      briefingTitle: `${profile.name} announces inbound investment`,
      briefingDetail: `+€${invest}M GDP from new ${profile.name} capital`,
    }
  }

  if (opinion <= -40) {
    // Hostile economic measure: sanctions or tariffs.
    if (rand() < 0.5) {
      const hit = Math.round(700 * intensity * noise)
      return {
        code: profile.code,
        kind: "sanctions",
        opinionDelta: -2,
        gdpDelta: -hit,
        treasuryDelta: -Math.round(hit * 0.1),
        isEconomic: true,
        briefingKind: "warning",
        briefingTitle: `${profile.name} announces sanctions`,
        briefingDetail: `−€${hit}M GDP · −€${Math.round(hit * 0.1)}M treasury`,
      }
    }
    const tariff = Math.round(450 * intensity * noise)
    return {
      code: profile.code,
      kind: "tariffs",
      opinionDelta: -1,
      gdpDelta: -tariff,
      isEconomic: true,
      briefingKind: "warning",
      briefingTitle: `${profile.name} raises tariffs on French exports`,
      briefingDetail: `−€${tariff}M GDP impact this quarter`,
    }
  }

  return null
}

function decideAction(
  profile: AiNationProfile,
  opinion: number,
  allied: boolean
): AiAction | null {
  if (opinion >= 60 && !allied) {
    return {
      code: profile.code,
      kind: "propose_alliance",
      opinionDelta: 5,
      setAllied: true,
      briefingKind: "milestone",
      briefingTitle: `${profile.name} proposes an alliance`,
      briefingDetail: "Their ambassador offers a mutual-defence pact. Accepted.",
    }
  }
  if (opinion <= -50 && allied) {
    return {
      code: profile.code,
      kind: "break_alliance",
      opinionDelta: -10,
      setAllied: false,
      briefingKind: "warning",
      briefingTitle: `${profile.name} withdraws from the alliance`,
      briefingDetail: "The mutual-defence pact is suspended.",
    }
  }
  if (opinion >= 30) {
    return {
      code: profile.code,
      kind: "friendly",
      opinionDelta: 2,
      briefingKind: "milestone",
      briefingTitle: `${profile.name} sends a friendly cable`,
    }
  }
  if (opinion <= -30 && !allied) {
    return {
      code: profile.code,
      kind: "hostile",
      opinionDelta: -2,
      briefingKind: "warning",
      briefingTitle: `${profile.name} issues a sharp statement`,
    }
  }
  return null
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}
