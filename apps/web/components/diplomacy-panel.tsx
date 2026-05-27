"use client"

import { AI_NATIONS } from "@workspace/engine"
import { cn } from "@workspace/ui/lib/utils"
import { HandshakeIcon, MinusIcon } from "lucide-react"
import { useMemo } from "react"

import { CountryFlag } from "@/components/country-flag"
import { FloatingPanel } from "@/components/floating-panel"
import { useGame } from "@/components/game-provider"
import { useHudState } from "@/components/hud-state"

const relDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})

interface DiplomacyRow {
  code: string
  name: string
  opinion: number
  allied: boolean
  lastInteractionAt: string | null
}

export function DiplomacyPanel() {
  const game = useGame()
  const { diplomacyOpen, closeDiplomacy, diplomacyPos, setDiplomacyPos } =
    useHudState()

  const rows = useMemo<DiplomacyRow[]>(() => {
    if (!game) return []
    return AI_NATIONS.map((p) => {
      const rel = game.relations[p.code]
      return {
        code: p.code,
        name: p.name,
        opinion: rel?.opinion ?? 0,
        allied: rel?.allied ?? false,
        lastInteractionAt: rel?.lastInteractionAt ?? null,
      }
    }).sort((a, b) => b.opinion - a.opinion)
  }, [game?.relations])

  if (!game) return null
  return (
    <FloatingPanel
      open={diplomacyOpen}
      onClose={closeDiplomacy}
      title="Diplomatic relations"
      icon={<HandshakeIcon className="size-4" />}
      position={diplomacyPos}
      onPositionChange={setDiplomacyPos}
      className="w-[360px]"
    >
      <ul className="divide-y">
        {rows.map((r) => (
          <DiplomacyRowItem key={r.code} row={r} />
        ))}
      </ul>
    </FloatingPanel>
  )
}

function DiplomacyRowItem({ row }: { row: DiplomacyRow }) {
  const ratio = (row.opinion + 100) / 200 // 0..1
  const color =
    row.opinion >= 30
      ? "bg-emerald-500"
      : row.opinion <= -30
        ? "bg-destructive"
        : "bg-amber-500"
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 text-xs">
      <CountryFlag code={row.code} className="h-4 w-auto rounded-[2px] ring-1 ring-black/20" />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate font-medium">{row.name}</span>
          {row.allied ? (
            <span className="rounded-sm bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase text-emerald-500">
              Allied
            </span>
          ) : null}
        </div>
        <div className="relative mt-1 h-1.5 w-full rounded-full bg-muted">
          <div
            className={cn(
              "absolute top-0 left-1/2 h-1.5 -translate-x-1/2 rounded-full opacity-30",
              "w-px bg-foreground"
            )}
            aria-hidden
          />
          <div
            className={cn("absolute top-0 h-1.5 rounded-full", color)}
            style={{
              left: `${Math.min(50, ratio * 100)}%`,
              width: `${Math.abs(ratio * 100 - 50)}%`,
            }}
          />
        </div>
        <div className="mt-0.5 flex items-baseline justify-between text-[10px] text-muted-foreground">
          <span className="tabular-nums">
            {row.opinion > 0 ? "+" : ""}
            {row.opinion.toFixed(0)}
          </span>
          <span>
            {row.lastInteractionAt ? (
              <>last {relDateFmt.format(new Date(row.lastInteractionAt))}</>
            ) : (
              <span className="inline-flex items-center gap-0.5">
                <MinusIcon className="size-2.5" /> no contact
              </span>
            )}
          </span>
        </div>
      </div>
    </li>
  )
}
