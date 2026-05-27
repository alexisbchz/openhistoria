"use client"

import type { BriefingEntry, BriefingKind } from "@workspace/engine"
import { cn } from "@workspace/ui/lib/utils"
import {
  AlertTriangleIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  FilterIcon,
  HammerIcon,
  LandmarkIcon,
  ListIcon,
  NewspaperIcon,
  SearchIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import { useGame } from "@/components/game-provider"
import { useHudState } from "@/components/hud-state"

const ICONS: Record<BriefingKind, LucideIcon> = {
  event: NewspaperIcon,
  project_completed: CheckCircle2Icon,
  project_started: HammerIcon,
  project_cancelled: XCircleIcon,
  milestone: LandmarkIcon,
  warning: AlertTriangleIcon,
  treasury: BanknoteIcon,
}

const KIND_LABELS: Record<BriefingKind, string> = {
  event: "Events",
  project_completed: "Completed",
  project_started: "Started",
  project_cancelled: "Cancelled",
  milestone: "Milestones",
  warning: "Warnings",
  treasury: "Treasury",
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})

export function BriefingPanel() {
  const game = useGame()
  const { briefingCollapsed, toggleBriefing } = useHudState()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<"briefing" | "press">("briefing")
  const [query, setQuery] = useState("")
  // null = "all kinds"; otherwise the Set holds the kinds the player has
  // deselected (UI defaults to everything visible).
  const [hiddenKinds, setHiddenKinds] = useState<Set<BriefingKind>>(
    () => new Set()
  )

  const entries = useMemo(() => {
    if (!game) return []
    const needle = query.trim().toLowerCase()
    const filtered = game.briefing.filter((b) => {
      if (hiddenKinds.has(b.kind)) return false
      if (!needle) return true
      const hay = `${b.title} ${b.detail ?? ""}`.toLowerCase()
      return hay.includes(needle)
    })
    return filtered.slice(0, briefingCollapsed ? 1 : 12)
  }, [game, hiddenKinds, briefingCollapsed, query])

  if (!game) return null
  const visibleKinds = (Object.keys(KIND_LABELS) as BriefingKind[]).filter(
    (k) => !hiddenKinds.has(k)
  )
  const filterActive = hiddenKinds.size > 0 || query.trim().length > 0

  function toggleKind(kind: BriefingKind) {
    setHiddenKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function clearFilters() {
    setHiddenKinds(new Set())
    setQuery("")
  }

  return (
    <div className="w-80 rounded-tl-md border-t border-l bg-background/90 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between border-b">
        <button
          type="button"
          onClick={toggleBriefing}
          className="flex flex-1 items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Toggle briefing (B)"
        >
          <span>
            Briefing{" "}
            {filterActive && !briefingCollapsed ? (
              <span className="text-muted-foreground">
                · {visibleKinds.length}/{Object.keys(KIND_LABELS).length}
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground">
            {briefingCollapsed ? "▴" : "▾"}
          </span>
        </button>
        {!briefingCollapsed && (
          <>
            <button
              type="button"
              onClick={() =>
                setView((v) => (v === "briefing" ? "press" : "briefing"))
              }
              className="border-l px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-pressed={view === "press"}
              title={
                view === "press" ? "Show briefing list" : "Show press headlines"
              }
            >
              {view === "press" ? (
                <ListIcon className="size-3.5" />
              ) : (
                <NewspaperIcon className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "border-l px-2 py-1.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filterActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-pressed={filtersOpen}
              title="Filter briefing"
            >
              <FilterIcon className="size-3.5" />
            </button>
          </>
        )}
      </div>
      {filtersOpen && !briefingCollapsed ? (
        <div className="grid gap-1.5 border-b bg-muted/40 px-2 py-1.5">
          <div className="flex items-center gap-1.5 rounded-sm bg-background/80 px-1.5">
            <SearchIcon className="size-3 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search briefings…"
              className="h-6 w-full bg-transparent text-[11px] placeholder:text-muted-foreground focus:outline-none"
              aria-label="Search briefings"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                clear
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(KIND_LABELS) as BriefingKind[]).map((k) => {
            const visible = !hiddenKinds.has(k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKind(k)}
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wide transition-colors",
                  visible
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground line-through opacity-60"
                )}
              >
                {KIND_LABELS[k]}
              </button>
            )
          })}
          {filterActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
          </div>
        </div>
      ) : null}
      {entries.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {filterActive
            ? "No briefings match the current filter."
            : "No briefings yet."}
        </p>
      ) : view === "press" ? (
        <ul className="max-h-80 divide-y overflow-y-auto">
          {entries.map((entry) => (
            <PressHeadline key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto">
          {entries.map((entry) => (
            <BriefingRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  )
}

function BriefingRow({ entry }: { entry: BriefingEntry }) {
  const Icon = ICONS[entry.kind] ?? NewspaperIcon
  return (
    <li className="grid grid-cols-[auto_1fr] gap-2 px-3 py-1.5 text-xs">
      <Icon className="mt-0.5 size-3.5 text-muted-foreground" />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium leading-tight">
            {entry.title}
          </span>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {dateFormatter.format(new Date(entry.date))}
          </span>
        </div>
        {entry.detail && (
          <div className="text-muted-foreground">{entry.detail}</div>
        )}
      </div>
    </li>
  )
}

const PRESS_RUBRIC: Record<BriefingKind, string> = {
  event: "BREAKING",
  project_completed: "INFRASTRUCTURE",
  project_started: "ANNOUNCEMENT",
  project_cancelled: "RETRACTION",
  milestone: "POLITICS",
  warning: "ALERT",
  treasury: "MARKETS",
}

const PRESS_RUBRIC_COLOR: Record<BriefingKind, string> = {
  event: "text-primary",
  project_completed: "text-emerald-500",
  project_started: "text-muted-foreground",
  project_cancelled: "text-muted-foreground",
  milestone: "text-muted-foreground",
  warning: "text-destructive",
  treasury: "text-amber-500",
}

function PressHeadline({ entry }: { entry: BriefingEntry }) {
  return (
    <li className="px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span
          className={`shrink-0 text-[9px] font-bold uppercase tracking-widest ${PRESS_RUBRIC_COLOR[entry.kind]}`}
        >
          {PRESS_RUBRIC[entry.kind] ?? "NEWS"}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {dateFormatter.format(new Date(entry.date))}
        </span>
      </div>
      <div className="mt-0.5 font-serif text-[13px] font-semibold leading-snug">
        {entry.title}
      </div>
      {entry.detail ? (
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {entry.detail}
        </p>
      ) : null}
    </li>
  )
}
