"use client"

import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  type LucideIcon,
} from "lucide-react"

import { useGame } from "@/components/game-provider"

const MS_PER_DAY = 86_400_000

interface TrendCellProps {
  label: string
  value: string
  delta?: { value: number; format: (n: number) => string }
}

/**
 * Compact treasury / approval / GDP weekly-trend strip. Uses the engine's
 * stored `history` samples (one per ~week) to compute the change over the
 * most recent ~7 days. Shows up alongside the briefing panel so the player
 * can see the direction of travel at a glance.
 */
export function TrendStrip() {
  const game = useGame()
  if (!game) return null
  const history = game.history
  if (history.length < 2) {
    return (
      <div className="rounded-tl-md border-t border-l bg-background/85 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground shadow-lg backdrop-blur-sm">
        Trends populate after the first week.
      </div>
    )
  }
  const last = history[history.length - 1]!
  // Find a sample roughly 1 week earlier for the comparison anchor.
  const targetTs = Date.parse(last.date) - 7 * MS_PER_DAY
  let baseIndex = history.length - 2
  for (let i = history.length - 2; i >= 0; i--) {
    if (Date.parse(history[i]!.date) <= targetTs) {
      baseIndex = i
      break
    }
  }
  const base = history[baseIndex]!

  const treasuryDelta = last.treasury - base.treasury
  const approvalDelta = last.approval - base.approval
  const gdpDelta = last.gdpUsd - base.gdpUsd

  return (
    <div className="grid grid-cols-3 divide-x rounded-tl-md border-t border-l bg-background/85 px-1 py-1 text-[11px] shadow-lg backdrop-blur-sm">
      <Cell
        label="Treasury"
        value={`€${Math.round(last.treasury).toLocaleString()}M`}
        delta={{
          value: treasuryDelta,
          format: (n) => `${signed(Math.round(n))} M / wk`,
        }}
      />
      <Cell
        label="Approval"
        value={`${last.approval.toFixed(0)}%`}
        delta={{
          value: approvalDelta,
          format: (n) => `${signed(n.toFixed(1))} / wk`,
        }}
      />
      <Cell
        label="GDP"
        value={`€${(last.gdpUsd / 1_000_000_000_000).toFixed(2)}T`}
        delta={{
          value: gdpDelta,
          format: (n) => `${signed((n / 1_000_000_000).toFixed(1))} B / wk`,
        }}
      />
    </div>
  )
}

function Cell({ label, value, delta }: TrendCellProps) {
  const { Icon, color } = arrowFor(delta?.value ?? 0)
  return (
    <div className="px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums leading-tight">{value}</div>
      {delta ? (
        <div
          className={
            "mt-0.5 flex items-center gap-1 text-[10px] tabular-nums " + color
          }
        >
          <Icon className="size-3" />
          {delta.format(delta.value)}
        </div>
      ) : null}
    </div>
  )
}

function arrowFor(delta: number): { Icon: LucideIcon; color: string } {
  if (delta > 0.01) {
    return { Icon: ArrowUpRightIcon, color: "text-emerald-500" }
  }
  if (delta < -0.01) {
    return { Icon: ArrowDownRightIcon, color: "text-destructive" }
  }
  return { Icon: ArrowRightIcon, color: "text-muted-foreground" }
}

function signed(v: string | number): string {
  const s = typeof v === "string" ? v : v.toString()
  if (s.startsWith("-")) return s
  if (s === "0" || s === "0.0") return s
  return `+${s}`
}
