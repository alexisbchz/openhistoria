import type { NationCode } from "./game"

export type EventCategory =
  | "election"
  | "crisis"
  | "diplomacy"
  | "social"
  | "economy"
  | "scandal"
  | "opportunity"

export type EventSeverity = "low" | "medium" | "high"

export interface EventEffects {
  treasury?: number
  approval?: number
  gdpDelta?: number
  unemploymentDelta?: number
  inflationDelta?: number
  debtDelta?: number
  terminal?: boolean
}

export interface EventChoice {
  id: string
  label: string
  description?: string
  effects: EventEffects
}

export interface EventDefinition {
  id: string
  nation: NationCode
  category: EventCategory
  date: string
  title: string
  description: string
  /**
   * Story-shaping events (hand-authored, terminal, or with major effects) are
   * "high" and pause the game so the player must decide. Lower-severity
   * procedural events apply a default cabinet response automatically and are
   * surfaced via the briefing log only.
   */
  severity?: EventSeverity
  choices: EventChoice[]
  /** Optional index of the choice the cabinet picks when severity < high. */
  defaultChoiceIndex?: number
}

export interface TriggeredEvent {
  id: string
  chosenAt: string
  choiceId: string
}

export const EVENT_LIBRARY: readonly EventDefinition[] = [
  {
    id: "fr-2026-heatwave",
    nation: "FR",
    category: "crisis",
    severity: "high",
    date: "2026-07-08",
    title: "Severe heatwave hits the south",
    description:
      "Temperatures top 44°C in Marseille and the Rhône valley. Hospitals are saturated; agricultural unions demand emergency aid.",
    choices: [
      {
        id: "emergency-package",
        label: "Release €2B emergency aid package",
        description: "Subsidise hospitals and farmers; reassuring move but costly.",
        effects: { treasury: -2000, approval: 4 },
      },
      {
        id: "minimal-response",
        label: "Coordinate prefectures, no new spending",
        description: "Use existing resources. Cheap, but opposition will jump on this.",
        effects: { treasury: -200, approval: -3 },
      },
      {
        id: "blame-climate",
        label: "Frame it as climate emergency, accelerate ecological transition",
        description: "Use the crisis to push a long-term policy narrative.",
        effects: { treasury: -800, approval: 1, gdpDelta: -500 },
      },
    ],
  },
  {
    id: "fr-2026-rail-strike",
    nation: "FR",
    category: "social",
    severity: "high",
    date: "2026-09-22",
    title: "SNCF rolling strike begins",
    description:
      "Rail workers walk out over pension reform leftovers. Trains across the country are disrupted just as the school year resumes.",
    choices: [
      {
        id: "negotiate",
        label: "Open immediate negotiations and concede on bonuses",
        effects: { treasury: -1500, approval: 3, unemploymentDelta: -0.1 },
      },
      {
        id: "hold-firm",
        label: "Refuse all concessions, requisition workers",
        effects: { approval: -6, gdpDelta: -1200 },
      },
      {
        id: "blame-unions",
        label: "Publicly blame union leadership on prime time",
        effects: { approval: -2, gdpDelta: -400 },
      },
    ],
  },
  {
    id: "fr-2026-eu-summit",
    nation: "FR",
    category: "diplomacy",
    severity: "high",
    date: "2026-10-15",
    title: "EU summit on defence autonomy",
    description:
      "Brussels convenes to decide on a joint European defence procurement fund. France is expected to lead.",
    choices: [
      {
        id: "champion",
        label: "Champion a €40B French-led defence fund",
        effects: { treasury: -4000, approval: 5, gdpDelta: 3000 },
      },
      {
        id: "block",
        label: "Block German alternatives, push national priorities",
        effects: { approval: -1 },
      },
      {
        id: "withdraw",
        label: "Skip the summit, send the foreign minister",
        effects: { approval: -3 },
      },
    ],
  },
  {
    id: "fr-2026-tech-scandal",
    nation: "FR",
    category: "scandal",
    severity: "high",
    date: "2026-11-28",
    title: "Élysée data leak alleged",
    description:
      "Le Monde publishes documents suggesting a contractor leaked presidential correspondence. The opposition demands a commission of inquiry.",
    choices: [
      {
        id: "transparency",
        label: "Submit to a parliamentary inquiry",
        effects: { approval: -2 },
      },
      {
        id: "deny",
        label: "Categorical denial, sue Le Monde",
        effects: { approval: -7 },
      },
      {
        id: "scapegoat",
        label: "Fire the chief of staff and move on",
        effects: { approval: -4, treasury: -200 },
      },
    ],
  },
  {
    id: "fr-2027-budget-vote",
    nation: "FR",
    category: "economy",
    severity: "high",
    date: "2027-01-20",
    title: "2027 budget vote in the Assembly",
    description:
      "The finance bill is short of a clear majority. You must arbitrate between austerity, stimulus, and political bargaining.",
    choices: [
      {
        id: "austerity",
        label: "Push austerity: cut €15B in social spending",
        effects: { treasury: 15000, approval: -8, unemploymentDelta: 0.4 },
      },
      {
        id: "stimulus",
        label: "Issue €20B in new debt for investment",
        effects: { treasury: 20000, approval: 3, debtDelta: 0.6, gdpDelta: 2500 },
      },
      {
        id: "49-3",
        label: "Force adoption via article 49.3",
        effects: { approval: -6 },
      },
    ],
  },
  {
    id: "fr-2027-presidential-election",
    nation: "FR",
    category: "election",
    severity: "high",
    date: "2027-04-25",
    title: "2027 presidential election — final verdict",
    description:
      "Your second term ends. You cannot run again, but voters will judge your legacy through the candidate you back. The result is determined by your approval rating and France's economic state.",
    choices: [
      {
        id: "endorse-successor",
        label: "Endorse your prime minister as successor",
        effects: { terminal: true },
      },
      {
        id: "stay-neutral",
        label: "Stay above the fray",
        effects: { terminal: true, approval: -2 },
      },
    ],
  },
]

export function getEventsForNation(nation: NationCode): EventDefinition[] {
  return EVENT_LIBRARY.filter((e) => e.nation === nation).map((e) => ({
    ...e,
    choices: e.choices.map((c) => ({ ...c, effects: { ...c.effects } })),
  }))
}

export function getEventSeverity(event: EventDefinition): EventSeverity {
  return event.severity ?? "medium"
}

export function getNextEvent(
  fromDate: Date,
  nation: NationCode,
  triggeredIds: ReadonlySet<string>
): EventDefinition | null {
  const fromIso = fromDate.toISOString().slice(0, 10)
  return (
    getEventsForNation(nation)
      .filter((e) => !triggeredIds.has(e.id) && e.date >= fromIso)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  )
}

export function getDueEvent(
  date: Date,
  nation: NationCode,
  triggeredIds: ReadonlySet<string>
): EventDefinition | null {
  const iso = date.toISOString().slice(0, 10)
  return (
    getEventsForNation(nation)
      .filter((e) => !triggeredIds.has(e.id) && e.date <= iso)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  )
}
