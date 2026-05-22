"use client"

import type { GameSpeed } from "@workspace/engine"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { PauseIcon, PlayIcon } from "lucide-react"

import { useGame, useGameActions } from "@/components/game-provider"

const SPEED_LEVELS: readonly GameSpeed[] = [1, 2, 3, 4, 5] as const

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
})

export function TimeControls() {
  const game = useGame()
  const { setSpeed, togglePause } = useGameActions()

  if (!game) return null

  return (
    <div className="rounded-tl-md border-t border-l bg-background/85 px-3 py-2 shadow-lg backdrop-blur-sm">
      <div className="text-center text-sm font-semibold leading-tight tabular-nums">
        {dateFormatter.format(game.date)}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          size="icon-sm"
          variant={game.paused ? "default" : "secondary"}
          onClick={togglePause}
          aria-label={game.paused ? "Play" : "Pause"}
          title={game.paused ? "Play (Space)" : "Pause (Space)"}
        >
          {game.paused ? <PlayIcon /> : <PauseIcon />}
        </Button>
        <SpeedGauge
          value={game.speed}
          paused={game.paused}
          onChange={setSpeed}
        />
      </div>
    </div>
  )
}

function SpeedGauge({
  value,
  paused,
  onChange,
}: {
  value: GameSpeed
  paused: boolean
  onChange: (speed: GameSpeed) => void
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-sm bg-muted/40 px-1 py-1"
      role="group"
      aria-label="Game speed"
    >
      {SPEED_LEVELS.map((level) => {
        const active = !paused && level <= value
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            aria-label={`Speed ${level}`}
            aria-pressed={value === level}
            title={`Speed ${level} (${level})`}
            className={cn(
              "h-2.5 w-5 rounded-[2px] transition-colors",
              active
                ? "bg-primary"
                : value === level
                  ? "bg-primary/30"
                  : "bg-secondary/50 hover:bg-secondary"
            )}
          />
        )
      })}
    </div>
  )
}
