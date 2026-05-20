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
      <div className="mt-2 flex items-center gap-1.5">
        <Button
          type="button"
          size="icon-sm"
          variant={game.paused ? "default" : "secondary"}
          onClick={togglePause}
          aria-label={game.paused ? "Play" : "Pause"}
          title={game.paused ? "Play" : "Pause"}
        >
          {game.paused ? <PlayIcon /> : <PauseIcon />}
        </Button>
        <div className="flex gap-0.5">
          {SPEED_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSpeed(level)}
              aria-label={`Speed ${level}`}
              title={`Speed ${level}`}
              className={cn(
                "h-7 w-6 rounded-sm border text-xs font-medium tabular-nums transition-colors",
                game.speed === level
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
