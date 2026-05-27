"use client"

import {
  evaluateReformAgenda,
  getCashflow,
  getNextEvent,
  REFORM_AGENDAS,
} from "@workspace/engine"
import { Button } from "@workspace/ui/components/button"
import {
  BanknoteIcon,
  CalendarClockIcon,
  CoinsIcon,
  GaugeIcon,
  LandmarkIcon,
  MegaphoneIcon,
  ScaleIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import { ApprovalBreakdown } from "@/components/approval-breakdown"
import { CabinetSheet } from "@/components/cabinet-sheet"
import { CountryFlag } from "@/components/country-flag"
import { FloatingPanel } from "@/components/floating-panel"
import { useGame, useGameActions } from "@/components/game-provider"
import { useHudState } from "@/components/hud-state"

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
})

const compactCurrency = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
  style: "currency",
  currency: "USD",
})

const eurFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
  style: "currency",
  currency: "EUR",
})

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function daysUntil(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

export function CountryStatsPanel() {
  const game = useGame()
  const { issueBond, mediaTour } = useGameActions()
  const { statsOpen, closeStats, statsPos, setStatsPos } = useHudState()
  const [cabinetOpen, setCabinetOpen] = useState(false)
  const cashflow = useMemo(
    () => (game ? getCashflow(game.stats, game.projects) : null),
    [game]
  )
  const nextEvent = useMemo(
    () =>
      game
        ? getNextEvent(
            game.date,
            game.nation,
            new Set(game.triggeredEvents.map((t) => t.id)),
            game.triggeredEvents
          )
        : null,
    [game]
  )

  if (!game || !cashflow) return null
  const { stats } = game
  const treasuryMillions = Math.round(game.treasury)
  const treasuryColor =
    treasuryMillions < 0
      ? "text-destructive"
      : treasuryMillions < 5000
        ? "text-amber-500"
        : "text-emerald-500"
  const approvalColor =
    game.approval < 30
      ? "bg-destructive"
      : game.approval < 50
        ? "bg-amber-500"
        : "bg-emerald-500"

  return (
    <FloatingPanel
      open={statsOpen}
      onClose={closeStats}
      title={stats.name}
      icon={
        <CountryFlag
          code={stats.code}
          title={stats.name}
          className="h-4 w-auto rounded-[1px] ring-1 ring-black/15"
        />
      }
      position={statsPos}
      onPositionChange={setStatsPos}
      className="w-80"
    >
      <header className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">
              {stats.government.headOfState}
            </div>
            <div className="text-xs text-muted-foreground">
              {stats.government.type}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Approval</div>
            <div className="font-semibold tabular-nums">
              {game.approval.toFixed(0)}%
            </div>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full ${approvalColor}`}
            style={{ width: `${game.approval}%` }}
          />
        </div>
      </header>
      <ul className="grid gap-1 px-3 py-2 text-sm">
        <StatRow
          icon={<WalletIcon className="size-4" />}
          label="Treasury"
          value={
            <span className={`font-semibold tabular-nums ${treasuryColor}`}>
              €{treasuryMillions.toLocaleString()}M
            </span>
          }
        />
        <StatRow
          icon={<GaugeIcon className="size-4" />}
          label="Annual balance"
          value={
            <span
              className={
                cashflow.annualBalance < 0
                  ? "tabular-nums text-destructive"
                  : "tabular-nums text-emerald-500"
              }
            >
              {cashflow.annualBalance < 0 ? "−" : "+"}
              {eurFormatter.format(Math.abs(cashflow.annualBalance) * 1_000_000)}
            </span>
          }
        />
        <StatRow
          icon={<UsersIcon className="size-4" />}
          label="Population"
          value={compactNumber.format(stats.demographics.population)}
        />
        <StatRow
          icon={<CoinsIcon className="size-4" />}
          label="GDP"
          value={compactCurrency.format(stats.economy.gdpUsd)}
        />
        <StatRow
          icon={<TrendingDownIcon className="size-4" />}
          label="Unemployment"
          value={formatPercent(stats.economy.unemploymentPct)}
        />
        <StatRow
          icon={<TrendingUpIcon className="size-4" />}
          label="Inflation"
          value={formatPercent(stats.economy.inflationPct)}
        />
        <StatRow
          icon={<ScaleIcon className="size-4" />}
          label="Debt / GDP"
          value={formatPercent(stats.economy.publicDebtPctGdp)}
        />
      </ul>
      <ReformAgendaStrip />
      <ApprovalBreakdownInline />
      {nextEvent && (
        <div className="flex items-start gap-2 border-t px-3 py-2 text-xs">
          <CalendarClockIcon className="mt-0.5 size-3.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground">
              Next event ·{" "}
              <span className="text-foreground">
                {dateFormatter.format(new Date(nextEvent.date))}
              </span>{" "}
              ({daysUntil(game.date, new Date(nextEvent.date))}d)
            </div>
            <div className="truncate font-medium leading-tight">
              {nextEvent.title}
            </div>
          </div>
        </div>
      )}
      {!game.gameOver && (
        <div className="flex flex-wrap gap-1 border-t bg-muted/30 px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => issueBond(5_000)}
            title="Raise €5B via bonds. Adds ~0.15pp debt/GDP, −2 approval."
          >
            <BanknoteIcon /> Bond €5B
          </Button>
          <BigBondButton onIssue={() => issueBond(30_000)} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => mediaTour()}
            title="Spend €80M on a media tour for +1.5 approval."
          >
            <MegaphoneIcon /> Media tour
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCabinetOpen(true)}
          >
            <UsersRoundIcon /> Cabinet
          </Button>
        </div>
      )}
      <CabinetSheet open={cabinetOpen} onOpenChange={setCabinetOpen} />
      {game.gameOver && (
        <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2 text-xs">
          <LandmarkIcon className="size-3.5" />
          <span className="font-medium">
            Game over · {game.gameOver.outcome === "won" ? "Victory" : "Defeat"}
          </span>
        </div>
      )}
    </FloatingPanel>
  )
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  )
}

function BigBondButton({ onIssue }: { onIssue: () => void }) {
  const [armed, setArmed] = useState(false)
  // Auto-disarm after 4s so a stray click doesn't sit primed forever.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button
      variant={armed ? "destructive" : "outline"}
      size="sm"
      onClick={() => {
        if (armed) {
          onIssue()
          setArmed(false)
        } else {
          setArmed(true)
        }
      }}
      title="Raise €30B in one tranche. Significant debt + approval cost."
    >
      <BanknoteIcon />
      {armed ? "Confirm €30B?" : "Bond €30B"}
    </Button>
  )
}

function ApprovalBreakdownInline() {
  return (
    <div className="border-t bg-muted/30 px-3 py-2">
      <ApprovalBreakdown />
    </div>
  )
}

function ReformAgendaStrip() {
  const game = useGame()
  if (!game?.reformAgenda) return null
  const def = REFORM_AGENDAS.find((a) => a.id === game.reformAgenda!.id)
  if (!def) return null
  const ok = evaluateReformAgenda(game)
  return (
    <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2 text-xs">
      <span
        className={
          ok
            ? "h-2 w-2 shrink-0 rounded-full bg-emerald-500"
            : "h-2 w-2 shrink-0 rounded-full bg-amber-500"
        }
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground">Agenda</div>
        <div className="truncate font-medium leading-tight">{def.short}</div>
      </div>
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
        {ok ? "on track" : "behind"}
      </span>
    </div>
  )
}
