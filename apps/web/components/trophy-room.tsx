"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { CheckIcon, LockIcon, TrophyIcon } from "lucide-react"

import {
  ACHIEVEMENTS,
  loadUnlockedAchievements,
} from "@/components/achievements"

interface TrophyRoomProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TrophyRoom({ open, onOpenChange }: TrophyRoomProps) {
  const unlocked = loadUnlockedAchievements()
  const total = ACHIEVEMENTS.length
  const earned = ACHIEVEMENTS.reduce(
    (n, a) => n + (unlocked.has(a.id) ? 1 : 0),
    0
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrophyIcon className="size-4 text-amber-500" />
            Achievements
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              {earned} / {total}
            </span>
          </DialogTitle>
          <DialogDescription>
            Persistent across sessions. New unlocks fire as toasts in-game.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-[60vh] gap-1.5 overflow-y-auto">
          {ACHIEVEMENTS.map((a) => {
            const have = unlocked.has(a.id)
            return (
              <li
                key={a.id}
                className={
                  "grid grid-cols-[auto_1fr] gap-2.5 rounded-md border p-2.5 " +
                  (have ? "bg-amber-500/5" : "bg-muted/20")
                }
              >
                <div
                  className={
                    "flex size-7 items-center justify-center rounded-full " +
                    (have ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground")
                  }
                >
                  {have ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    <LockIcon className="size-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">
                    {a.title}
                  </div>
                  <p className="text-xs leading-snug text-muted-foreground">
                    {a.blurb}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
