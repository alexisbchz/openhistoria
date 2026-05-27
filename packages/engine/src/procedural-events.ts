import { getClock } from "./clock"
import type {
  EventDefinition,
  EventCategory,
  EventChoice,
  EventSeverity,
  TriggeredEvent,
} from "./events"
import type { NationCode } from "./game"

interface ProceduralTemplate {
  id: string
  category: EventCategory
  severity: EventSeverity
  title: string
  description: string
  choices: EventChoice[]
  weight: number
  /** Minimum days between two firings of the same template. */
  cooldownDays?: number
  /** Default choice the cabinet picks when severity < high. */
  defaultChoiceIndex?: number
}

const FR_TEMPLATES: ProceduralTemplate[] = [
  {
    id: "minor-farmer-protest",
    category: "social",
    severity: "medium",
    weight: 3,
    cooldownDays: 90,
    title: "Farmers block the A1 motorway",
    description:
      "FNSEA blocks traffic on the A1 demanding emergency price support. Disruption is regional but televised.",
    choices: [
      {
        id: "subsidise",
        label: "Release €400M in emergency aid",
        effects: { treasury: -400, approval: 2 },
      },
      {
        id: "negotiate",
        label: "Send the agriculture minister to negotiate",
        effects: { approval: -1 },
      },
      {
        id: "police",
        label: "Order gendarmerie to clear the road",
        effects: { approval: -4 },
      },
    ],
    defaultChoiceIndex: 1,
  },
  {
    id: "minor-tech-deal",
    category: "opportunity",
    severity: "medium",
    weight: 2,
    cooldownDays: 120,
    title: "Major tech firm considers a French HQ",
    description:
      "A US semiconductor company explores a European HQ in Grenoble. The decision hinges on tax incentives.",
    choices: [
      {
        id: "incentives",
        label: "Offer €800M in tax credits",
        effects: { treasury: -800, gdpDelta: 1800, unemploymentDelta: -0.05 },
      },
      {
        id: "modest",
        label: "Offer matching EU grants only",
        effects: { gdpDelta: 400, unemploymentDelta: -0.02 },
      },
      {
        id: "pass",
        label: "Decline; defend French tax base",
        effects: { approval: -1 },
      },
    ],
    defaultChoiceIndex: 1,
  },
  {
    id: "minor-eu-fine",
    category: "diplomacy",
    severity: "low",
    weight: 2,
    cooldownDays: 180,
    title: "EU Commission fines France over deficit",
    description:
      "Brussels formally censures France for breaching the Stability Pact. Markets react cautiously.",
    choices: [
      {
        id: "pay",
        label: "Pay the €600M fine and comply",
        effects: { treasury: -600, approval: -1 },
      },
      {
        id: "contest",
        label: "Contest in the ECJ",
        effects: { approval: 1, debtDelta: 0.1 },
      },
    ],
    defaultChoiceIndex: 0,
  },
  {
    id: "minor-cyber-attack",
    category: "crisis",
    severity: "high",
    weight: 2,
    cooldownDays: 150,
    title: "Cyberattack on hospital network",
    description:
      "Ransomware paralyses two CHU hospitals. Patients diverted; opposition demands cybersecurity overhaul.",
    choices: [
      {
        id: "invest",
        label: "Launch €1.2B national cyber plan",
        effects: { treasury: -1200, approval: 3 },
      },
      {
        id: "pay-ransom",
        label: "Authorise the ransom payment quietly",
        effects: { treasury: -50, approval: -4 },
      },
      {
        id: "minimise",
        label: "Wait it out, downplay publicly",
        effects: { approval: -3 },
      },
    ],
  },
  {
    id: "minor-media-tour",
    category: "opportunity",
    severity: "low",
    weight: 1,
    cooldownDays: 60,
    title: "Prime-time interview opportunity",
    description:
      "TF1 offers a one-hour solo prime-time slot. The risk: a hostile journalist; the reward: direct audience.",
    choices: [
      {
        id: "accept",
        label: "Accept and prepare thoroughly",
        effects: { approval: 3 },
      },
      {
        id: "decline",
        label: "Decline; delegate to the PM",
        effects: { approval: -1 },
      },
    ],
    defaultChoiceIndex: 0,
  },
  {
    id: "minor-suburb-riot",
    category: "crisis",
    severity: "high",
    weight: 2,
    cooldownDays: 200,
    title: "Unrest in a Paris suburb",
    description:
      "A police operation in Seine-Saint-Denis sparks two nights of unrest. Vehicles burned, shops looted.",
    choices: [
      {
        id: "deploy",
        label: "Deploy CRS and impose curfew",
        effects: { approval: 1, treasury: -200 },
      },
      {
        id: "social",
        label: "Announce €500M neighbourhood plan",
        effects: { treasury: -500, approval: 2 },
      },
      {
        id: "passive",
        label: "Let local prefects handle it",
        effects: { approval: -3 },
      },
    ],
  },
  {
    id: "minor-tax-windfall",
    category: "opportunity",
    severity: "low",
    weight: 1,
    cooldownDays: 120,
    title: "Corporate tax receipts beat forecast",
    description:
      "Bercy reports better-than-expected Q-end corporate-tax inflows. A small windfall lands in the treasury.",
    choices: [
      {
        id: "absorb",
        label: "Absorb into general budget",
        effects: { treasury: 800 },
      },
      {
        id: "rebate",
        label: "Announce a small household rebate",
        effects: { treasury: 200, approval: 2 },
      },
    ],
    defaultChoiceIndex: 0,
  },
]

const TEMPLATES_BY_NATION: Record<NationCode, ProceduralTemplate[]> = {
  FR: FR_TEMPLATES,
}

export interface ProceduralEventInput {
  nation: NationCode
  date: Date
  triggeredIds: ReadonlySet<string>
  /** Past firings used to compute per-template cooldowns. */
  triggeredEvents?: readonly TriggeredEvent[]
  cooldownDays?: number
  baseChancePerDay?: number
}

const DEFAULT_BASE_CHANCE_PER_DAY = 0.008
const DEFAULT_COOLDOWN_DAYS = 60
const MS_PER_DAY = 86_400_000

export function maybeGenerateProceduralEvent(
  input: ProceduralEventInput
): EventDefinition | null {
  const templates = TEMPLATES_BY_NATION[input.nation] ?? []
  if (templates.length === 0) return null
  const baseChance = input.baseChancePerDay ?? DEFAULT_BASE_CHANCE_PER_DAY
  if (getClock().random() > baseChance) return null

  const now = input.date.getTime()
  const available = templates.filter((t) => {
    const cooldown = (t.cooldownDays ?? DEFAULT_COOLDOWN_DAYS) * MS_PER_DAY
    const lastFiredAt = lastFiringTime(
      t.id,
      input.triggeredIds,
      input.triggeredEvents
    )
    if (lastFiredAt == null) return true
    return now - lastFiredAt >= cooldown
  })
  if (available.length === 0) return null

  const totalWeight = available.reduce((s, t) => s + t.weight, 0)
  let roll = getClock().random() * totalWeight
  let picked = available[0]!
  for (const t of available) {
    roll -= t.weight
    if (roll <= 0) {
      picked = t
      break
    }
  }

  const iso = input.date.toISOString().slice(0, 10)
  const uniqueId = `${picked.id}-${iso}-${shortId()}`
  return {
    id: uniqueId,
    nation: input.nation,
    category: picked.category,
    severity: picked.severity,
    date: iso,
    title: picked.title,
    description: picked.description,
    choices: picked.choices.map((c) => ({ ...c, effects: { ...c.effects } })),
    defaultChoiceIndex: picked.defaultChoiceIndex,
  }
}

function lastFiringTime(
  templateId: string,
  triggered: ReadonlySet<string>,
  triggeredEvents?: readonly TriggeredEvent[]
): number | null {
  if (triggeredEvents) {
    let latest: number | null = null
    for (const t of triggeredEvents) {
      if (!t.id.startsWith(`${templateId}-`)) continue
      const ts = Date.parse(t.chosenAt)
      if (Number.isNaN(ts)) continue
      if (latest == null || ts > latest) latest = ts
    }
    if (latest != null) return latest
  }
  // Fallback: check just by id presence. We don't know exactly when, so we
  // treat it as "fired today" — caller code that already filtered by template
  // ID via the legacy alreadyTriggered behaviour keeps working.
  for (const id of triggered) {
    if (id.startsWith(`${templateId}-`)) return Date.now()
  }
  return null
}

function shortId(): string {
  // 8 chars from a base36 RNG; clock-driven so tests stay deterministic.
  const a = getClock().random().toString(36).slice(2, 6)
  const b = getClock().random().toString(36).slice(2, 6)
  return `${a}${b}`
}
