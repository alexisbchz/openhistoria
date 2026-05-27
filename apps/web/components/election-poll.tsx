"use client"

import { evaluateReformAgenda, REFORM_AGENDAS } from "@workspace/engine"
import { VoteIcon } from "lucide-react"

import { useGame } from "@/components/game-provider"

/**
 * Compact projected vote-share readout for the 2027 first round. Names the
 * two main opposition figures so the player has a clear villain on each
 * flank. The numerical model is a crude function of approval, unemployment,
 * agenda success, and debt drag — same shape the engine uses to score the
 * election, surfaced as a live percentage.
 */
interface Rival {
  name: string
  party: string
  /** Hex shade used for the bar segment. */
  colorClass: string
  /** Relative share of the non-incumbent remainder. */
  shareWeight: number
  /** Approval ranges in which this rival is stronger; lets them respond to player choices. */
  thrivesWhenApprovalBelow?: number
  thrivesWhenUnemploymentAbove?: number
}

const RIVALS: Rival[] = [
  {
    name: "Marine Le Pen",
    party: "Rassemblement National",
    colorClass: "bg-destructive/80",
    shareWeight: 0.55,
    thrivesWhenUnemploymentAbove: 8,
  },
  {
    name: "Jean-Luc Mélenchon",
    party: "La France Insoumise",
    colorClass: "bg-amber-500/80",
    shareWeight: 0.45,
    thrivesWhenApprovalBelow: 30,
  },
]

export function ElectionPoll() {
  const game = useGame()
  if (!game) return null

  const onTrack = evaluateReformAgenda(game)
  const agenda = game.reformAgenda
    ? REFORM_AGENDAS.find((a) => a.id === game.reformAgenda!.id)
    : null

  const approval = game.approval
  const unemployment = game.stats.economy.unemploymentPct
  const debt = game.stats.economy.publicDebtPctGdp
  const agendaBoost = onTrack ? 3 : -2
  const unemploymentDrag = Math.max(0, unemployment - 7) * 0.8
  const debtDrag = Math.max(0, debt - 130) * 0.15
  const yourShare = clamp(
    approval + agendaBoost - unemploymentDrag - debtDrag,
    5,
    95
  )

  // Split the remainder across rivals using their weights, then boost any
  // rival whose ideological niche the current state plays into.
  const remainder = 100 - yourShare
  const totalWeight = RIVALS.reduce((s, r) => {
    let w = r.shareWeight
    if (
      r.thrivesWhenApprovalBelow != null &&
      approval < r.thrivesWhenApprovalBelow
    ) {
      w *= 1.25
    }
    if (
      r.thrivesWhenUnemploymentAbove != null &&
      unemployment > r.thrivesWhenUnemploymentAbove
    ) {
      w *= 1.2
    }
    return s + w
  }, 0)
  const rivalShares = RIVALS.map((r) => {
    let w = r.shareWeight
    if (
      r.thrivesWhenApprovalBelow != null &&
      approval < r.thrivesWhenApprovalBelow
    ) {
      w *= 1.25
    }
    if (
      r.thrivesWhenUnemploymentAbove != null &&
      unemployment > r.thrivesWhenUnemploymentAbove
    ) {
      w *= 1.2
    }
    return { rival: r, share: clamp((w / totalWeight) * remainder, 0, 95) }
  })

  return (
    <div className="rounded-tl-md border-t border-l bg-background/85 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <VoteIcon className="size-3" />
        <span>Projected 2027 first round</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <span
          className="h-full bg-primary"
          style={{ width: `${yourShare}%` }}
          title="Your endorsed candidate"
        />
        {rivalShares.map(({ rival, share }) => (
          <span
            key={rival.name}
            className={`h-full ${rival.colorClass}`}
            style={{ width: `${share}%` }}
            title={`${rival.name} (${rival.party})`}
          />
        ))}
      </div>
      <div className="mt-1 grid gap-0.5 text-[10px] tabular-nums">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Your candidate</span>
          <span>{yourShare.toFixed(1)}%</span>
        </div>
        {rivalShares.map(({ rival, share }) => (
          <div
            key={rival.name}
            className="flex items-baseline justify-between text-muted-foreground"
          >
            <span className="truncate">
              {rival.name}{" "}
              <span className="text-[9px] uppercase tracking-wide">
                {rival.party}
              </span>
            </span>
            <span>{share.toFixed(1)}%</span>
          </div>
        ))}
      </div>
      {agenda ? (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Agenda: {agenda.short} ·{" "}
          <span className={onTrack ? "text-emerald-500" : "text-amber-500"}>
            {onTrack ? "on track" : "behind"}
          </span>
        </div>
      ) : null}
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
