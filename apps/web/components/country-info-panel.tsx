"use client"

import {
  fetchCountryData,
  type FetchedCountryData,
  type FetchedValue,
} from "@workspace/engine"
import {
  BanknoteIcon,
  CoinsIcon,
  GaugeIcon,
  GlobeIcon,
  HeartPulseIcon,
  LandmarkIcon,
  Loader2Icon,
  ScaleIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import { useEffect, useReducer, useState, type ReactNode } from "react"

import { FloatingPanel } from "@/components/floating-panel"
import { useMapSelection } from "@/components/map-country-regions"

interface CacheEntry {
  status: "loading" | "ready" | "error"
  data?: FetchedCountryData
  error?: string
}

const cache = new Map<string, CacheEntry>()
const subscribers = new Set<() => void>()

function notify() {
  for (const s of subscribers) s()
}

function loadCountry(code: string) {
  const existing = cache.get(code)
  if (existing && existing.status !== "error") return
  cache.set(code, { status: "loading" })
  notify()
  fetchCountryData(code)
    .then((data) => {
      cache.set(code, { status: "ready", data })
    })
    .catch((err: unknown) => {
      cache.set(code, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    })
    .finally(notify)
}

function useCountryEntry(code: string | null): CacheEntry | null {
  const [, force] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!code) return
    const sub = () => force()
    subscribers.add(sub)
    loadCountry(code)
    return () => {
      subscribers.delete(sub)
    }
  }, [code])

  return code ? (cache.get(code) ?? null) : null
}

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

const fullCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function CountryInfoPanel() {
  const { selected, setSelected } = useMapSelection()
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 24, y: 80 }
    return { x: Math.max(24, window.innerWidth - 360 - 24), y: 80 }
  })

  const isCountry = selected?.type === "country"
  const code = isCountry ? (selected.iso2 ?? selected.iso3 ?? null) : null
  const entry = useCountryEntry(code)

  if (!isCountry) return null

  return (
    <FloatingPanel
      open
      onClose={() => setSelected(null)}
      title={selected.name}
      icon={<GlobeIcon className="size-4" />}
      position={pos}
      onPositionChange={setPos}
      className="w-[360px]"
    >
      {!code ? (
        <NoCodeMessage name={selected.name} />
      ) : !entry || entry.status === "loading" ? (
        <LoadingBlock />
      ) : entry.status === "error" ? (
        <ErrorBlock
          message={entry.error ?? "Unknown error"}
          onRetry={() => {
            cache.delete(code)
            loadCountry(code)
          }}
        />
      ) : entry.data ? (
        <CountryBody data={entry.data} />
      ) : null}
    </FloatingPanel>
  )
}

function NoCodeMessage({ name }: { name: string }) {
  return (
    <div className="px-4 py-6 text-center text-muted-foreground text-sm">
      No ISO code available for <span className="font-medium">{name}</span> —
      can&apos;t fetch World Bank data.
    </div>
  )
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-8 text-muted-foreground text-sm">
      <Loader2Icon className="size-4 animate-spin" />
      Loading country data…
    </div>
  )
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="grid gap-2 px-4 py-4 text-sm">
      <p className="text-destructive">{message}</p>
      <button
        type="button"
        className="self-start text-xs text-muted-foreground underline hover:text-foreground"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  )
}

function CountryBody({ data }: { data: FetchedCountryData }) {
  return (
    <div className="grid gap-3 px-3 py-3 text-sm">
      <section className="grid gap-1">
        <header className="flex items-center justify-between">
          <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
            Overview
          </h3>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {data.code} · {data.alpha3}
          </span>
        </header>
        <Row
          icon={<LandmarkIcon className="size-3.5" />}
          label="Capital"
          value={data.capital ?? "—"}
        />
        <Row
          icon={<GlobeIcon className="size-3.5" />}
          label="Region"
          value={
            data.subregion
              ? `${data.region ?? "—"} · ${data.subregion}`
              : (data.region ?? "—")
          }
        />
      </section>

      <section className="grid gap-1 border-t border-border/60 pt-2">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Demographics
        </h3>
        <Row
          icon={<UsersIcon className="size-3.5" />}
          label="Population"
          value={renderValue(data.demographics.population, (v) =>
            compactNumber.format(v)
          )}
          year={data.demographics.population?.year}
        />
        <Row
          icon={<HeartPulseIcon className="size-3.5" />}
          label="Life expectancy"
          value={renderValue(
            data.demographics.lifeExpectancy,
            (v) => `${v.toFixed(1)} y`
          )}
          year={data.demographics.lifeExpectancy?.year}
        />
        <Row
          icon={<TrendingUpIcon className="size-3.5" />}
          label="Birth / 1k"
          value={renderValue(data.demographics.birthRatePer1000, (v) =>
            v.toFixed(1)
          )}
          year={data.demographics.birthRatePer1000?.year}
        />
        <Row
          icon={<TrendingDownIcon className="size-3.5" />}
          label="Death / 1k"
          value={renderValue(data.demographics.deathRatePer1000, (v) =>
            v.toFixed(1)
          )}
          year={data.demographics.deathRatePer1000?.year}
        />
        <Row
          icon={<GaugeIcon className="size-3.5" />}
          label="Urban"
          value={renderValue(
            data.demographics.urbanizationPct,
            (v) => `${v.toFixed(1)}%`
          )}
          year={data.demographics.urbanizationPct?.year}
        />
      </section>

      <section className="grid gap-1 border-t border-border/60 pt-2">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Economy
        </h3>
        <Row
          icon={<CoinsIcon className="size-3.5" />}
          label="GDP"
          value={renderValue(data.economy.gdpUsd, (v) =>
            compactCurrency.format(v)
          )}
          year={data.economy.gdpUsd?.year}
        />
        <Row
          icon={<BanknoteIcon className="size-3.5" />}
          label="GDP / capita"
          value={renderValue(data.economy.gdpPerCapitaUsd, (v) =>
            fullCurrency.format(v)
          )}
          year={data.economy.gdpPerCapitaUsd?.year}
        />
        <Row
          icon={<TrendingDownIcon className="size-3.5" />}
          label="Unemployment"
          value={renderValue(
            data.economy.unemploymentPct,
            (v) => `${v.toFixed(1)}%`
          )}
          year={data.economy.unemploymentPct?.year}
        />
        <Row
          icon={<TrendingUpIcon className="size-3.5" />}
          label="Inflation"
          value={renderValue(
            data.economy.inflationPct,
            (v) => `${v.toFixed(1)}%`
          )}
          year={data.economy.inflationPct?.year}
        />
        <Row
          icon={<ScaleIcon className="size-3.5" />}
          label="Debt / GDP"
          value={renderValue(
            data.economy.publicDebtPctGdp,
            (v) => `${v.toFixed(1)}%`
          )}
          year={data.economy.publicDebtPctGdp?.year}
        />
      </section>

      <p className="border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        Sources: World Bank, REST Countries. Year shown next to each value.
      </p>
    </div>
  )
}

function renderValue(
  fv: FetchedValue | null,
  format: (v: number) => string
): ReactNode {
  if (!fv) return <span className="text-muted-foreground">—</span>
  return <span className="font-medium tabular-nums">{format(fv.value)}</span>
}

function Row({
  icon,
  label,
  value,
  year,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  year?: number
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1.5">
        {value}
        {year ? (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            ’{String(year).slice(-2)}
          </span>
        ) : null}
      </span>
    </div>
  )
}
