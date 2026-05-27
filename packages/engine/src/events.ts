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

export interface EventPrecondition {
  /** Event id that must have already been resolved. */
  eventId: string
  /** If set, that event's chosen choice id must match for the trigger to fire. */
  choiceId?: string
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
  /**
   * Optional precondition: only fire when a previous event resolved a certain
   * way. Lets us hand-author short narrative chains without a full scripting
   * language.
   */
  requires?: EventPrecondition
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
    id: "fr-2026-nato-pressure",
    nation: "FR",
    category: "diplomacy",
    severity: "high",
    date: "2026-08-12",
    title: "NATO presses for 3% GDP defence spending",
    description:
      "Washington circulates a draft communiqué pushing every European member to 3% of GDP on defence by 2030. Berlin is wavering; the Élysée's position will set the tone.",
    choices: [
      {
        id: "endorse",
        label: "Endorse the 3% target publicly",
        effects: { treasury: -3000, approval: -2, debtDelta: 0.2 },
      },
      {
        id: "counterpropose",
        label: "Counter with a phased EU-led plan",
        effects: { approval: 2, gdpDelta: 600 },
      },
      {
        id: "reject",
        label: "Reject the target, defend strategic autonomy",
        effects: { approval: 3 },
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
    id: "fr-2026-iran-crisis",
    nation: "FR",
    category: "diplomacy",
    severity: "high",
    date: "2026-11-04",
    title: "Tankers struck in the Strait of Hormuz",
    description:
      "Two oil tankers — one chartered by TotalEnergies — are hit in the Strait of Hormuz. Iran denies involvement. Energy prices spike across Europe.",
    choices: [
      {
        id: "joint-naval",
        label: "Deploy the Charles de Gaulle group with EU partners",
        effects: { treasury: -1800, approval: 2 },
      },
      {
        id: "diplomatic",
        label: "Lead a backchannel mediation with Tehran",
        effects: { approval: 1, gdpDelta: -300 },
      },
      {
        id: "energy-package",
        label: "Cap fuel prices via emergency subsidy",
        effects: { treasury: -2500, approval: 4, inflationDelta: -0.3 },
      },
    ],
  },
  {
    // Follow-up to the rail strike: if the player chose "hold-firm", the
    // SNCF unions escalate to a general strike six weeks later.
    id: "fr-2026-rail-strike-escalation",
    nation: "FR",
    category: "social",
    severity: "high",
    date: "2026-11-05",
    title: "SNCF dispute spirals into a general strike",
    description:
      "After being requisitioned in September, rail workers have rallied other public-sector unions. A 24-hour general strike paralyses transport and schools.",
    requires: {
      eventId: "fr-2026-rail-strike",
      choiceId: "hold-firm",
    },
    choices: [
      {
        id: "concede",
        label: "Concede on bonuses and back-pay (€2B)",
        effects: { treasury: -2000, approval: 4, unemploymentDelta: -0.05 },
      },
      {
        id: "force",
        label: "Use article 49.3, force adoption",
        effects: { approval: -6, gdpDelta: -800 },
      },
    ],
  },
  {
    // Follow-up to EU summit: if the player championed the defence fund,
    // Berlin reciprocates with a joint industrial project.
    id: "fr-2026-franco-german-industrial",
    nation: "FR",
    category: "opportunity",
    severity: "high",
    date: "2026-12-05",
    title: "Berlin proposes a Franco-German hydrogen plant",
    description:
      "Following your EU defence-fund leadership, Chancellor Merz offers a joint €6B green-hydrogen plant on the Rhine, evenly co-financed.",
    requires: {
      eventId: "fr-2026-eu-summit",
      choiceId: "champion",
    },
    choices: [
      {
        id: "accept",
        label: "Co-finance the project (50/50)",
        effects: { treasury: -3000, gdpDelta: 4500, approval: 3 },
      },
      {
        id: "negotiate-down",
        label: "Negotiate down to a smaller pilot",
        effects: { treasury: -1200, gdpDelta: 1500, approval: 1 },
      },
      {
        id: "decline",
        label: "Decline; preserve fiscal room",
        effects: { approval: -2 },
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
    id: "fr-2026-decembre-yellow-vests",
    nation: "FR",
    category: "social",
    severity: "high",
    date: "2026-12-15",
    title: "A new yellow-vests movement spreads",
    description:
      "Fuel costs and the carbon tax detonate. Roundabout occupations spread from Brittany to the Rhône valley. Saturday protests reach 200,000.",
    choices: [
      {
        id: "freeze-carbon-tax",
        label: "Freeze the carbon tax escalator for 2027",
        effects: { treasury: -1800, approval: 5, gdpDelta: -400 },
      },
      {
        id: "minimum-wage",
        label: "Announce a €100/month working-class top-up",
        effects: { treasury: -4500, approval: 6, debtDelta: 0.15 },
      },
      {
        id: "hold-line",
        label: "Hold the line, dispatch the Interior Minister",
        effects: { approval: -6 },
      },
    ],
  },
  {
    id: "fr-2027-eu-presidency",
    nation: "FR",
    category: "diplomacy",
    severity: "high",
    date: "2027-02-18",
    title: "Italy proposes a Mediterranean migration pact",
    description:
      "Rome wants France to co-sign a hard returns framework. Civil-society pressure inside Renaissance is intense.",
    choices: [
      {
        id: "cosign",
        label: "Co-sign and gain Italian goodwill",
        effects: { approval: -2 },
      },
      {
        id: "amend",
        label: "Amend with humanitarian carve-outs",
        effects: { approval: 1, treasury: -400 },
      },
      {
        id: "refuse",
        label: "Refuse; defend asylum rights publicly",
        effects: { approval: 2, gdpDelta: -200 },
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
    id: "fr-2027-final-debate",
    nation: "FR",
    category: "social",
    severity: "high",
    date: "2027-04-08",
    title: "Final televised debate of the campaign",
    description:
      "Your endorsed candidate must hold the line on TF1 with 18 million viewers. Choose the messaging strategy.",
    choices: [
      {
        id: "record",
        label: "Defend the record — “we delivered”",
        effects: { approval: 3 },
      },
      {
        id: "fear",
        label: "Warn against the opposition's risks",
        effects: { approval: -1 },
      },
      {
        id: "vision",
        label: "Pivot to a vision for the next decade",
        effects: { approval: 2, gdpDelta: 200 },
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

/**
 * Convert "YYYY-MM-DD" to the UTC-midnight timestamp of that day. We compare
 * in numeric UTC space so an in-game `Date` that lands on, say, 04:00 UTC
 * still counts as "the same day" as an event scheduled for that calendar
 * date, regardless of the host's local timezone.
 */
function eventDateToUtcMs(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return Number.NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function utcDayStart(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  )
}

function preconditionSatisfied(
  e: EventDefinition,
  triggeredEvents?: readonly TriggeredEvent[]
): boolean {
  if (!e.requires) return true
  if (!triggeredEvents) return false
  const match = triggeredEvents.find((t) => t.id === e.requires!.eventId)
  if (!match) return false
  if (e.requires.choiceId && match.choiceId !== e.requires.choiceId) {
    return false
  }
  return true
}

export function getNextEvent(
  fromDate: Date,
  nation: NationCode,
  triggeredIds: ReadonlySet<string>,
  triggeredEvents?: readonly TriggeredEvent[]
): EventDefinition | null {
  const fromMs = utcDayStart(fromDate)
  return (
    getEventsForNation(nation)
      .filter((e) => {
        if (triggeredIds.has(e.id)) return false
        const ts = eventDateToUtcMs(e.date)
        if (!Number.isFinite(ts) || ts < fromMs) return false
        return preconditionSatisfied(e, triggeredEvents)
      })
      .sort(
        (a, b) => eventDateToUtcMs(a.date) - eventDateToUtcMs(b.date)
      )[0] ?? null
  )
}

export function getDueEvent(
  date: Date,
  nation: NationCode,
  triggeredIds: ReadonlySet<string>,
  triggeredEvents?: readonly TriggeredEvent[]
): EventDefinition | null {
  const ms = utcDayStart(date)
  return (
    getEventsForNation(nation)
      .filter((e) => {
        if (triggeredIds.has(e.id)) return false
        const ts = eventDateToUtcMs(e.date)
        if (!Number.isFinite(ts) || ts > ms) return false
        return preconditionSatisfied(e, triggeredEvents)
      })
      .sort(
        (a, b) => eventDateToUtcMs(a.date) - eventDateToUtcMs(b.date)
      )[0] ?? null
  )
}
