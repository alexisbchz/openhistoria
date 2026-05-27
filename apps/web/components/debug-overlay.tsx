"use client"

import { useEffect, useState } from "react"

import { useGame, useTickStats } from "@/components/game-provider"

/**
 * Toggle with backtick (`) — surfaces tick-loop perf, RNG/clock state, and a
 * short tail of the briefing so we can see what just changed. Read-only.
 */
export function DebugOverlay() {
  const [open, setOpen] = useState(false)
  const game = useGame()
  const stats = useTickStats()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "`") return
      const target = e.target as HTMLElement | null
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (!open || !game) return null

  const triggered = game.triggeredEvents.length
  const projects = game.projects.length
  const briefingTail = game.briefing.slice(0, 5)

  return (
    <div className="pointer-events-auto fixed top-2 right-2 z-[2000] w-80 rounded-md border border-border/80 bg-background/95 p-3 font-mono text-[11px] shadow-2xl ring-1 ring-black/40 backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wide">Debug (` to close)</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close debug overlay"
        >
          ×
        </button>
      </div>
      <Row label="Date" value={game.date.toISOString().slice(0, 10)} />
      <Row label="Paused" value={String(game.paused)} />
      <Row label="Speed" value={String(game.speed)} />
      <Row label="Treasury" value={`€${Math.round(game.treasury).toLocaleString()}M`} />
      <Row label="Approval" value={`${game.approval.toFixed(1)}%`} />
      <Row label="Projects" value={String(projects)} />
      <Row label="Triggered" value={String(triggered)} />
      <Row label="Pending event" value={game.pendingEvent?.id ?? "—"} />
      <Row label="Bankruptcy d" value={String(game.bankruptcyDays)} />
      <Row label="Impeachment d" value={String(game.impeachmentDays)} />
      <Row label="Agenda" value={game.reformAgenda?.id ?? "—"} />
      <Row label="History samples" value={String(game.history.length)} />
      <hr className="my-1.5 border-border/60" />
      <Row label="Tick ms" value={stats.lastDurationMs.toFixed(2)} />
      <Row label="Ticks" value={String(stats.totalTicks)} />
      <Row label="Errors" value={String(stats.errors)} />
      {stats.lastError ? (
        <Row label="Last error" value={stats.lastError} />
      ) : null}
      <hr className="my-1.5 border-border/60" />
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Briefing (last 5)
      </div>
      <ul className="mt-1 space-y-0.5">
        {briefingTail.map((b) => (
          <li key={b.id} className="truncate">
            <span className="text-muted-foreground">
              {b.date.slice(0, 10)}
            </span>{" "}
            {b.title}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate tabular-nums">{value}</span>
    </div>
  )
}
