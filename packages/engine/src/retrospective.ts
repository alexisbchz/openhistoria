import { EVENT_LIBRARY } from "./events"
import type { Game } from "./game"
import { REFORM_AGENDAS } from "./game"

/**
 * Synthesised end-of-mandate narrative. Deterministic (no LLM): given the
 * final Game it always produces the same multi-paragraph recap. Lives in the
 * engine so the same retrospective can be reused by a CLI / server later.
 */
export interface Retrospective {
  /** Newspaper-style headline. */
  headline: string
  /** Ordered paragraphs of body copy. */
  paragraphs: string[]
  /** Major moments referenced in the body, for UI bullet lists. */
  moments: { date: string; title: string; choice?: string }[]
}

export function buildRetrospective(game: Game): Retrospective {
  const cause = game.gameOver?.cause ?? "other"
  const headline = headlineFor(cause, game)

  // Collect the highlights worth name-checking.
  const completedProjects = game.briefing.filter(
    (b) => b.kind === "project_completed"
  )
  const cabinetReshuffles = game.briefing.filter((b) =>
    b.title.startsWith("Cabinet reshuffle")
  )
  const sanctionsIssued = game.briefing.filter((b) =>
    b.title.startsWith("Sanctions imposed on ")
  ).length
  const tradeDeals = game.briefing.filter((b) =>
    b.title.startsWith("Trade deal signed with ")
  ).length
  const allies = Object.entries(game.relations).filter(([, r]) => r.allied)

  // Story events with their resolution.
  const moments: Retrospective["moments"] = []
  const scheduledIds = new Set(EVENT_LIBRARY.map((e) => e.id))
  for (const t of game.triggeredEvents) {
    if (!scheduledIds.has(t.id)) continue
    const def = EVENT_LIBRARY.find((e) => e.id === t.id)
    if (!def) continue
    const choice = def.choices.find((c) => c.id === t.choiceId)
    moments.push({
      date: t.chosenAt.slice(0, 10),
      title: def.title,
      choice: choice?.label,
    })
  }

  const agendaDef = game.reformAgenda
    ? REFORM_AGENDAS.find((a) => a.id === game.reformAgenda!.id)
    : null

  // Body paragraphs.
  const paragraphs: string[] = []
  paragraphs.push(openingParagraph(game, cause))
  paragraphs.push(
    economyParagraph(game, completedProjects.length, tradeDeals, sanctionsIssued)
  )
  paragraphs.push(
    diplomacyParagraph(game, allies.length, tradeDeals, sanctionsIssued)
  )
  if (agendaDef) {
    paragraphs.push(
      agendaParagraph(game, agendaDef.short, game.gameOver?.outcome === "won")
    )
  }
  if (cabinetReshuffles.length > 0) {
    paragraphs.push(
      `The cabinet was reshuffled ${cabinetReshuffles.length} time${
        cabinetReshuffles.length === 1 ? "" : "s"
      } during the term — each appointment recalibrated the policy stack the Élysée could rely on.`
    )
  }

  return { headline, paragraphs, moments }
}

function headlineFor(cause: string, game: Game): string {
  switch (cause) {
    case "election_won":
      return `${game.stats.government.headOfState}'s legacy carried at the polls`
    case "election_lost":
      return `Voters close the door on the ${game.stats.government.headOfState} era`
    case "bankruptcy":
      return `Sovereign default ends the ${game.stats.government.headOfState} mandate`
    case "impeachment":
      return `Assembly removes ${game.stats.government.headOfState}: a censure for the record books`
    default:
      return `The ${game.stats.government.headOfState} mandate concludes`
  }
}

function openingParagraph(game: Game, cause: string): string {
  const approval = game.approval.toFixed(0)
  const debt = game.stats.economy.publicDebtPctGdp.toFixed(0)
  const elapsed = Math.round(
    (game.date.getTime() - game.startedAt.getTime()) / 86_400_000
  )
  const months = (elapsed / 30).toFixed(1)
  switch (cause) {
    case "election_won":
      return `After ${months} months, the second term closes with ${approval}% approval — enough to carry the endorsed candidate through the first round. Debt-to-GDP settled at ${debt}%, well within the band markets had priced in.`
    case "election_lost":
      return `${months} months into the second term, voters delivered their verdict. Approval finished at ${approval}%, unemployment at ${game.stats.economy.unemploymentPct.toFixed(1)}%, and the campaign never found its footing.`
    case "bankruptcy":
      return `The mandate ended in a sovereign-debt crisis. The treasury crossed the IMF intervention floor and could not climb back; approval was ${approval}% at the time, debt-to-GDP ${debt}%.`
    case "impeachment":
      return `A motion of censure ended the mandate. Approval had sat below the impeachment floor for a full month before the Assembly acted; the chamber's verdict was decisive.`
    default:
      return `The mandate concluded after ${months} months. Final approval was ${approval}%, debt-to-GDP ${debt}%.`
  }
}

function economyParagraph(
  game: Game,
  completedCount: number,
  trades: number,
  sanctions: number
): string {
  const gdp = (game.stats.economy.gdpUsd / 1_000_000_000_000).toFixed(2)
  const treasury = Math.round(game.treasury).toLocaleString()
  const unemployment = game.stats.economy.unemploymentPct.toFixed(1)
  const projectClause =
    completedCount === 0
      ? "No flagship project crossed the ribbon-cutting line."
      : completedCount === 1
        ? "One flagship project crossed the ribbon-cutting line."
        : `${completedCount} flagship projects crossed the ribbon-cutting line.`
  const tradeClause =
    trades > 0 || sanctions > 0
      ? ` ${trades} trade deal${trades === 1 ? "" : "s"} were signed${
          sanctions > 0
            ? `, balanced against ${sanctions} sanction${sanctions === 1 ? "" : "s"} package${sanctions === 1 ? "" : "s"}`
            : ""
        }.`
      : ""
  return `The economy closed at €${gdp}T GDP, €${treasury}M in the treasury, and ${unemployment}% unemployment. ${projectClause}${tradeClause}`
}

function diplomacyParagraph(
  game: Game,
  allyCount: number,
  trades: number,
  sanctions: number
): string {
  if (allyCount === 0 && trades === 0 && sanctions === 0) {
    return `Diplomatically the mandate was quiet. No formal alliance was forged, and bilateral relations drifted close to their natural baselines.`
  }
  const alliedNames = Object.entries(game.relations)
    .filter(([, r]) => r.allied)
    .map(([code]) => code)
    .join(", ")
  if (allyCount > 0) {
    return `France stood by ${allyCount} formal allies (${alliedNames}) when the term ended — the architecture of the post-2026 alliance system bears your signature.`
  }
  return `Foreign policy ended with no standing alliances on the books, though ${trades} bilateral trade deal${trades === 1 ? "" : "s"} and ${sanctions} sanction${sanctions === 1 ? "" : "s"} package${sanctions === 1 ? "" : "s"} marked an active term abroad.`
}

function agendaParagraph(game: Game, name: string, won: boolean): string {
  return won
    ? `The "${name}" agenda became the story of the mandate. The metrics it asked you to move did move; voters credit the office for the result.`
    : `The "${name}" agenda fell short of its declared targets. Whether the bar was set too high or the political weather too rough, the verdict on this run is "tried, but did not finish."`
}
