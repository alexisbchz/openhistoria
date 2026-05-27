"use client"

import {
  buildRetrospective,
  type GameOverCause,
  type HistorySample,
} from "@workspace/engine"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  BanknoteIcon,
  CrownIcon,
  FlagIcon,
  GavelIcon,
  type LucideIcon,
} from "lucide-react"

import { useGame, useGameActions } from "@/components/game-provider"

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
})

interface CauseTheme {
  Icon: LucideIcon
  title: string
  accent: string
}

const CAUSE_THEMES: Record<Exclude<GameOverCause, undefined>, CauseTheme> = {
  election_won: {
    Icon: CrownIcon,
    title: "Legacy secured",
    accent: "text-emerald-500",
  },
  election_lost: {
    Icon: FlagIcon,
    title: "Mandate rejected",
    accent: "text-destructive",
  },
  bankruptcy: {
    Icon: BanknoteIcon,
    title: "Sovereign default",
    accent: "text-destructive",
  },
  impeachment: {
    Icon: GavelIcon,
    title: "Mandate ended by the Assembly",
    accent: "text-destructive",
  },
  other: {
    Icon: FlagIcon,
    title: "Mandate ended",
    accent: "text-destructive",
  },
}

export function GameOverDialog() {
  const game = useGame()
  const { resetGame } = useGameActions()

  if (!game?.gameOver) {
    return (
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent />
      </Dialog>
    )
  }

  const cause =
    game.gameOver.cause ??
    (game.gameOver.outcome === "won" ? "election_won" : "election_lost")
  const theme = CAUSE_THEMES[cause]
  const Icon = theme.Icon
  const retro = buildRetrospective(game)

  return (
    <Dialog open={true} onOpenChange={() => {}} disablePointerDismissal>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Icon className="size-3.5" />
            <span>{dateFormatter.format(new Date(game.gameOver.date))}</span>
          </div>
          <DialogTitle className={theme.accent}>{theme.title}</DialogTitle>
          <DialogDescription className="font-serif text-base font-medium leading-snug text-foreground">
            {retro.headline}
          </DialogDescription>
          <p className="text-xs text-muted-foreground">{game.gameOver.reason}</p>
        </DialogHeader>
        <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm leading-relaxed">
          {retro.paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {retro.moments.length > 0 ? (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Key moments
            </div>
            <ul className="grid gap-0.5 text-xs">
              {retro.moments.map((m) => (
                <li key={`${m.date}-${m.title}`} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-2">
                  <span className="tabular-nums text-muted-foreground">{m.date}</span>
                  <span className="truncate">{m.title}</span>
                  {m.choice ? (
                    <span className="text-muted-foreground">→ {m.choice}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Final approval" value={`${game.approval.toFixed(0)}%`} />
          <Stat
            label="Treasury"
            value={`€${Math.round(game.treasury).toLocaleString()}M`}
          />
          <Stat
            label="Unemployment"
            value={`${game.stats.economy.unemploymentPct.toFixed(1)}%`}
          />
          <Stat
            label="Debt / GDP"
            value={`${game.stats.economy.publicDebtPctGdp.toFixed(0)}%`}
          />
          <Stat
            label="Decisions launched"
            value={`${game.briefing.filter((b) => b.kind === "project_started").length}`}
          />
          <Stat
            label="Events resolved"
            value={`${game.triggeredEvents.length}`}
          />
        </div>
        {game.history.length >= 2 ? (
          <div className="grid gap-2 rounded-md border bg-card p-2.5">
            <Sparkline
              label="Approval"
              samples={game.history}
              accessor={(s) => s.approval}
              format={(v) => `${v.toFixed(0)}%`}
              color="stroke-emerald-500"
            />
            <Sparkline
              label="Treasury"
              samples={game.history}
              accessor={(s) => s.treasury}
              format={(v) => `€${Math.round(v).toLocaleString()}M`}
              color="stroke-amber-500"
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={() => resetGame()}>Start a new mandate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-2.5 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  )
}

interface SparklineProps {
  label: string
  samples: readonly HistorySample[]
  accessor: (s: HistorySample) => number
  format: (v: number) => string
  color: string
}

function Sparkline({ label, samples, accessor, format, color }: SparklineProps) {
  const values = samples.map(accessor)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const last = values[values.length - 1]!
  const first = values[0]!
  const delta = last - first
  const width = 220
  const height = 36
  const stepX = values.length > 1 ? width / (values.length - 1) : width
  const points = values
    .map((v, i) => {
      const x = i * stepX
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {format(first)} → {format(last)}{" "}
          <span
            className={
              delta >= 0 ? "text-emerald-500" : "text-destructive"
            }
          >
            ({delta >= 0 ? "+" : ""}
            {format(delta).replace(/^€?/, "")})
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-0.5 h-9 w-full"
        preserveAspectRatio="none"
        aria-label={`${label} over time`}
      >
        <polyline
          fill="none"
          points={points}
          strokeWidth={1.5}
          className={color}
        />
      </svg>
    </div>
  )
}
