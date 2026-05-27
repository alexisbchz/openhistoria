"use client"

import {
  evaluateReformAgenda,
  getCabinetEffects,
  getCashflow,
} from "@workspace/engine"
import { ScaleIcon } from "lucide-react"
import { useMemo } from "react"

import { useGame } from "@/components/game-provider"

interface Contribution {
  label: string
  /** Annualised approval impact estimate, signed. */
  annual: number
  detail: string
}

/**
 * Compact panel showing what's pushing the player's approval up or down right
 * now. The numbers are annualised so the player can read the direction of
 * travel at a glance — exact tick-by-tick math is fuzzier and changes daily,
 * but this captures the big drivers.
 */
export function ApprovalBreakdown() {
  const game = useGame()

  const contributions = useMemo<Contribution[]>(() => {
    if (!game) return []
    const out: Contribution[] = []
    const cabinet = getCabinetEffects(game.nation, game.cabinet)

    // Drift toward baseline 35%.
    const driftPerDay = -(game.approval - 35) * 0.0008
    out.push({
      label: "Baseline drift",
      annual: driftPerDay * 365,
      detail: `Approval drifts toward 35% (current ${game.approval.toFixed(0)}%)`,
    })

    // Cabinet daily lift.
    if (cabinet.approvalPerDay) {
      out.push({
        label: "Cabinet lift",
        annual: cabinet.approvalPerDay * 365,
        detail: "Sum of minister daily contributions",
      })
    }

    // Deficit penalty.
    if (game.treasury < -20_000) {
      const depth = (-20_000 - game.treasury) / 100_000
      const penaltyPerDay = -0.05 * (1 + Math.min(3, depth)) *
        cabinet.treasuryPenaltyMultiplier
      out.push({
        label: "Deficit penalty",
        annual: penaltyPerDay * 365,
        detail: `Treasury ${Math.round(game.treasury).toLocaleString()}M`,
      })
    }

    // Unemployment headwind via cashflow-shaped indirect signal.
    const cashflow = getCashflow(game.stats, game.projects)
    if (cashflow.annualBalance < 0) {
      out.push({
        label: "Project burn",
        annual: 0, // not direct approval, surfaced for context
        detail: `Monthly balance: €${Math.round(cashflow.monthlyBalance).toLocaleString()}M`,
      })
    }

    // Reform agenda boost shows up at the polls, not in approval — but worth
    // calling out so the player sees it.
    const onTrack = evaluateReformAgenda(game)
    out.push({
      label: "Reform agenda",
      annual: 0,
      detail: game.reformAgenda
        ? onTrack
          ? "On track — voters will reward you on election day."
          : "Behind — election threshold stays high."
        : "No agenda chosen.",
    })

    return out
  }, [game])

  if (!game) return null

  return (
    <div className="text-xs">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <ScaleIcon className="size-3" />
        <span>Approval drivers (annualised)</span>
      </div>
      <ul className="grid gap-1">
        {contributions.map((c) => (
          <li key={c.label} className="grid grid-cols-[1fr_auto] items-baseline gap-2">
            <div className="min-w-0">
              <div className="font-medium leading-tight">{c.label}</div>
              <div className="truncate text-[10px] leading-tight text-muted-foreground">
                {c.detail}
              </div>
            </div>
            <span
              className={
                "tabular-nums text-[11px] " +
                (c.annual > 0.01
                  ? "text-emerald-500"
                  : c.annual < -0.01
                    ? "text-destructive"
                    : "text-muted-foreground")
              }
            >
              {c.annual === 0
                ? "—"
                : `${c.annual > 0 ? "+" : ""}${c.annual.toFixed(1)} / yr`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
