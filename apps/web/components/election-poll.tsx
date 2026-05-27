"use client"

import { evaluateReformAgenda, REFORM_AGENDAS } from "@workspace/engine"
import { cn } from "@workspace/ui/lib/utils"
import { VoteIcon } from "lucide-react"

import { useGame } from "@/components/game-provider"

/**
 * Compact projected vote-share readout for the election. The model is the
 * same one used by the engine's outcome computation — a crude function of
 * approval, unemployment, and whether the reform agenda is on track — but
 * surfaced as a continuous percentage so the player can read trends.
 */
export function ElectionPoll() {
  const game = useGame()
  if (!game) return null

  const onTrack = evaluateReformAgenda(game)
  const agenda = game.reformAgenda
    ? REFORM_AGENDAS.find((a) => a.id === game.reformAgenda!.id)
    : null

  // Base score (0..100): mostly approval, modulated by unemployment, agenda
  // success, and debt drag. Clamps live at the edges.
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
  // Symbolic split of the remainder between two challengers — purely
  // illustrative; the real outcome resolves on election day.
  const remainder = 100 - yourShare
  const challenger1 = clamp(remainder * 0.55, 0, 95)
  const challenger2 = clamp(remainder - challenger1, 0, 95)

  return (
    <div className="rounded-tl-md border-t border-l bg-background/85 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <VoteIcon className="size-3" />
        <span>Projected 2027 first round</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <span
          className={cn("h-full bg-primary")}
          style={{ width: `${yourShare}%` }}
          title="Your endorsed candidate"
        />
        <span
          className="h-full bg-destructive/80"
          style={{ width: `${challenger1}%` }}
          title="Main challenger"
        />
        <span
          className="h-full bg-amber-500/80"
          style={{ width: `${challenger2}%` }}
          title="Other challenger"
        />
      </div>
      <div className="mt-1 flex items-baseline justify-between text-[10px] tabular-nums">
        <span className="font-medium">{yourShare.toFixed(1)}% yours</span>
        <span className="text-muted-foreground">
          {challenger1.toFixed(0)}% · {challenger2.toFixed(0)}%
        </span>
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
