import { getClock } from "./clock"
import type { EventDefinition } from "./events"
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
  {
    code: "BR",
    name: "Brazil",
    stance: "neutral",
    baseOpinion: 10,
    activity: 0.35,
    reactsTo: {
      "construction:industrial": 2,
      diplomacy: 3,
    },
  },
  {
    code: "IN",
    name: "India",
    stance: "neutral",
    baseOpinion: 5,
    activity: 0.5,
    reactsTo: {
      "construction:industrial": 2,
      "construction:nuclear": -2,
      diplomacy: 2,
    },
  },
  {
    code: "AU",
    name: "Australia",
    stance: "ally",
    baseOpinion: 25,
    activity: 0.35,
    reactsTo: {
      "construction:military": 2,
      diplomacy: 2,
    },
  },
  {
    code: "CA",
    name: "Canada",
    stance: "ally",
    baseOpinion: 30,
    activity: 0.35,
    reactsTo: {
      "construction:infrastructure": 2,
      "construction:nuclear": -2,
      diplomacy: 3,
    },
  },
]

const PROFILE_INDEX: Record<string, AiNationProfile> = Object.fromEntries(
  AI_NATIONS.map((p) => [p.code, p])
)

export function getAiProfile(code: string): AiNationProfile | null {
  return PROFILE_INDEX[code.trim().toUpperCase()] ?? null
}

/**
 * Stable AI-to-AI alignment groups, surfaced in the diplomacy panel. These
 * don't currently drive simulation — the AI tick still treats each nation
 * independently — they're context for the player.
 */
export interface AiBloc {
  id: string
  name: string
  members: string[]
}

export const AI_BLOCS: readonly AiBloc[] = [
  { id: "anglosphere", name: "Anglosphere", members: ["US", "GB", "AU", "CA"] },
  { id: "eurogroup", name: "EU core", members: ["DE", "IT", "ES"] },
  { id: "brics-leaning", name: "BRICS-leaning", members: ["RU", "CN", "BR", "IN"] },
  { id: "indo-pacific", name: "Indo-Pacific partners", members: ["JP", "AU", "IN"] },
]

export function getBlocsForNation(code: string): AiBloc[] {
  const key = code.trim().toUpperCase()
  return AI_BLOCS.filter((b) => b.members.includes(key))
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
  /** Multiplier on the daily opinion drift, from the player's foreign minister. */
  diplomacyDriftMultiplier?: number
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
    // converge asymptotically rather than overshooting in one tick. The
    // foreign minister, if present, accelerates drift toward the baseOpinion
    // (positive *or* negative — i.e. it brings the relationship to the
    // "natural" place faster).
    const driftRate = DRIFT_PER_DAY * (input.diplomacyDriftMultiplier ?? 1)
    const gap = profile.baseOpinion - current.opinion
    const driftFraction = 1 - Math.pow(1 - driftRate, days)
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

const PROPOSAL_BASE_CHANCE_PER_DAY = 0.0015
const PROPOSAL_COOLDOWN_DAYS = 120

export interface ProposalInput {
  playerNation: string
  relations: Readonly<Record<string, RelationState>>
  currentDate: Date
  baseChancePerDay?: number
}

/**
 * Occasionally an AI nation initiates a high-severity proposal targeted at
 * the player. We synthesise an `EventDefinition` so the existing event
 * dialog handles the player's accept/decline; effects on relations and the
 * treasury are encoded as the event's choice effects, which the engine
 * already knows how to apply.
 *
 * Returns null on most days. Throttled by `lastInteractionAt` so a chatty
 * nation can't spam proposals.
 */
export function maybeGenerateAiProposal(
  input: ProposalInput
): EventDefinition | null {
  const baseChance = input.baseChancePerDay ?? PROPOSAL_BASE_CHANCE_PER_DAY
  if (getClock().random() > baseChance) return null

  const playerKey = input.playerNation.toUpperCase()
  const now = input.currentDate.getTime()
  const eligible = AI_NATIONS.filter((p) => {
    if (p.code === playerKey) return false
    const rel = input.relations[p.code]
    if (!rel) return true
    if (!rel.lastInteractionAt) return true
    const last = Date.parse(rel.lastInteractionAt)
    if (Number.isNaN(last)) return true
    return now - last >= PROPOSAL_COOLDOWN_DAYS * MS_PER_DAY
  })
  if (eligible.length === 0) return null

  // Weight selection by activity so US/RU send more proposals than ES/IT.
  const totalWeight = eligible.reduce((s, p) => s + p.activity, 0)
  let roll = getClock().random() * totalWeight
  let picked = eligible[0]!
  for (const p of eligible) {
    roll -= p.activity
    if (roll <= 0) {
      picked = p
      break
    }
  }

  const rel = input.relations[picked.code]
  const opinion = rel?.opinion ?? 0
  const allied = rel?.allied ?? false
  const iso = input.currentDate.toISOString().slice(0, 10)
  const id = `ai-proposal-${picked.code}-${iso}-${shortId()}`

  if (allied) {
    return {
      id,
      nation: input.playerNation as NationCode,
      category: "diplomacy",
      severity: "high",
      date: iso,
      title: `${picked.name} proposes a joint defence project`,
      description: `Your ally ${picked.name} wants to co-finance a €${1500}M joint defence capability. Co-financing strengthens the pact; declining cools relations.`,
      choices: [
        {
          id: "accept",
          label: "Co-finance the joint project",
          effects: { treasury: -1500, gdpDelta: 800, approval: 1 },
        },
        {
          id: "decline",
          label: "Decline (mild relationship cost)",
          effects: { approval: -1 },
        },
      ],
    }
  }

  if (opinion >= 50) {
    return {
      id,
      nation: input.playerNation as NationCode,
      category: "diplomacy",
      severity: "high",
      date: iso,
      title: `${picked.name} proposes a formal alliance`,
      description: `${picked.name}'s government floats a mutual-defence pact. Accepting raises opinion and locks in the alliance; declining is a snub.`,
      choices: [
        {
          id: "accept",
          label: "Accept the alliance",
          effects: { approval: 2 },
        },
        {
          id: "decline",
          label: "Decline politely",
          effects: { approval: -1 },
        },
      ],
    }
  }

  if (opinion >= 15) {
    return {
      id,
      nation: input.playerNation as NationCode,
      category: "diplomacy",
      severity: "high",
      date: iso,
      title: `${picked.name} proposes a bilateral trade pact`,
      description: `${picked.name} offers a modest trade pact: small upfront cost, real economic upside, opinion warmer.`,
      choices: [
        {
          id: "accept",
          label: "Sign the pact",
          effects: { treasury: -200, gdpDelta: 600, approval: 1 },
        },
        {
          id: "decline",
          label: "Pass; we have other priorities",
          effects: {},
        },
      ],
    }
  }

  if (opinion <= -40) {
    return {
      id,
      nation: input.playerNation as NationCode,
      category: "diplomacy",
      severity: "high",
      date: iso,
      title: `${picked.name} delivers a démarche`,
      description: `${picked.name} formally demands you halt military cooperation with its rivals. Accepting calms tensions but constrains foreign policy; refusing widens the rift.`,
      choices: [
        {
          id: "accept",
          label: "Accept the demand (relations improve)",
          effects: { approval: -1, gdpDelta: -200 },
        },
        {
          id: "refuse",
          label: "Refuse publicly (relations worsen)",
          effects: { approval: 1 },
        },
      ],
    }
  }

  // Mild/neutral relationship: a routine state visit proposal.
  return {
    id,
    nation: input.playerNation as NationCode,
    category: "diplomacy",
    severity: "high",
    date: iso,
    title: `${picked.name} requests a state visit`,
    description: `${picked.name}'s embassy floats a working visit. Hosting costs a little, builds goodwill; declining costs nothing but signals neglect.`,
    choices: [
      {
        id: "host",
        label: "Host the visit",
        effects: { treasury: -120, approval: 1 },
      },
      {
        id: "delegate",
        label: "Send the foreign minister instead",
        effects: {},
      },
    ],
  }
}

function shortId(): string {
  return getClock().random().toString(36).slice(2, 8)
}
