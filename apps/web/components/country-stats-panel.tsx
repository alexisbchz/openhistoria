"use client"

import { CountryStatsProvider, type CountryStats } from "@workspace/engine"
import {
  CoinsIcon,
  ScaleIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import { useMemo, type ReactNode } from "react"

import { useGame } from "@/components/game-provider"

const countryStatsProvider = new CountryStatsProvider()

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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function CountryStatsPanel() {
  const game = useGame()
  const stats = useMemo<CountryStats | null>(
    () => (game ? countryStatsProvider.fetchSync(game.nation) : null),
    [game]
  )

  if (!stats) return null

  return (
    <div className="w-64 rounded-tl-md border-t border-l bg-background/85 shadow-lg backdrop-blur-sm">
      <header className="border-b px-3 py-2">
        <div className="font-semibold text-sm leading-tight">{stats.name}</div>
        <div className="text-xs text-muted-foreground">
          {stats.government.type}
        </div>
      </header>
      <ul className="space-y-1.5 px-3 py-2 text-sm">
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
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  )
}
