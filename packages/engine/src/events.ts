import type { NationCode } from "./game"

export type EventKind =
  | "presidential_term_end"
  | "presidential_election_first_round"
  | "presidential_election_second_round"
  | "presidential_inauguration"
  | "legislative_election_first_round"
  | "legislative_election_second_round"

export interface ScheduledEvent {
  id: string
  nation: NationCode
  kind: EventKind
  date: string
  title: string
  description?: string
}

export const INITIAL_EVENTS: readonly ScheduledEvent[] = [
  {
    id: "fr-2027-presidential-first-round",
    nation: "FR",
    kind: "presidential_election_first_round",
    date: "2027-04-11",
    title: "French presidential election — first round",
    description:
      "First round of the 2027 French presidential election. Expected date; official decree typically published by the government a few months prior.",
  },
  {
    id: "fr-2027-presidential-second-round",
    nation: "FR",
    kind: "presidential_election_second_round",
    date: "2027-04-25",
    title: "French presidential election — second round",
    description:
      "Runoff between the top two candidates from the first round.",
  },
  {
    id: "fr-2027-macron-term-end",
    nation: "FR",
    kind: "presidential_term_end",
    date: "2027-05-13",
    title: "End of Emmanuel Macron's second term",
    description:
      "Constitutional end of Macron's second (and final) five-year mandate. Sworn in on 2022-05-14; cannot run for a consecutive third term (Constitution, art. 6).",
  },
  {
    id: "fr-2027-presidential-inauguration",
    nation: "FR",
    kind: "presidential_inauguration",
    date: "2027-05-14",
    title: "Inauguration of the next President of France",
    description:
      "Investiture ceremony at the Élysée Palace; new president takes office.",
  },
  {
    id: "fr-2027-legislative-first-round",
    nation: "FR",
    kind: "legislative_election_first_round",
    date: "2027-06-13",
    title: "French legislative election — first round",
    description:
      "Expected first round of legislative elections following the presidential, restoring the standard post-presidential calendar.",
  },
  {
    id: "fr-2027-legislative-second-round",
    nation: "FR",
    kind: "legislative_election_second_round",
    date: "2027-06-20",
    title: "French legislative election — second round",
    description: "Runoff for National Assembly seats not decided in round one.",
  },
]

export function getInitialEvents(nation?: NationCode): ScheduledEvent[] {
  if (!nation) return [...INITIAL_EVENTS]
  return INITIAL_EVENTS.filter((event) => event.nation === nation)
}

export function getNextEvent(
  fromDate: Date,
  nation?: NationCode,
): ScheduledEvent | null {
  const fromIso = fromDate.toISOString().slice(0, 10)
  const upcoming = getInitialEvents(nation)
    .filter((event) => event.date >= fromIso)
    .sort((a, b) => a.date.localeCompare(b.date))
  return upcoming[0] ?? null
}
