"use client"

import { REFORM_AGENDAS, type ReformAgendaId } from "@workspace/engine"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useState } from "react"

import { useGame, useGameActions } from "@/components/game-provider"

const STORAGE_KEY = "openhistoria:welcome-shown"

export function WelcomeDialog() {
  const game = useGame()
  const { setReformAgenda } = useGameActions()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ReformAgendaId | null>(null)

  useEffect(() => {
    if (!game) return
    if (typeof window === "undefined") return
    // Always show if no agenda has been picked yet, regardless of the legacy
    // "welcome-shown" flag — agendas are new and load-bearing for win logic.
    if (!game.reformAgenda) {
      setOpen(true)
      return
    }
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return
    setOpen(true)
  }, [game])

  function close() {
    setOpen(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // ignore
    }
  }

  function commit() {
    if (selected) setReformAgenda(selected)
    close()
  }

  const needsAgenda = !!game && !game.reformAgenda

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setOpen(true)
        else if (!needsAgenda) close()
      }}
    >
      <DialogContent
        className="sm:max-w-xl"
        showCloseButton={!needsAgenda}
      >
        <DialogHeader>
          <DialogTitle>Welcome to Open Historia</DialogTitle>
          <DialogDescription>
            You are Emmanuel Macron, 11 months from the 2027 presidential
            election. Pick the legacy your second term will be judged on.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2.5 text-sm">
          {REFORM_AGENDAS.map((a) => {
            const isSelected = selected === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a.id)}
                className={cn(
                  "rounded-md border bg-card px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "border-primary ring-2 ring-primary/40"
                    : "hover:border-primary/60"
                )}
                aria-pressed={isSelected}
              >
                <div className="font-medium leading-tight">{a.title}</div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                  {a.description}
                </p>
              </button>
            )
          })}
          <div className="mt-2 grid gap-2.5">
            <Section
              title="How it works"
              body="Each decision becomes a project on the map: it costs upfront, drains the treasury, and pays back approval and GDP on completion. Crises and opportunities arrive at scheduled and random times — only the big ones pause the game."
            />
            <Section
              title="Treasury & approval"
              body="Issue bonds to refill the treasury (at the cost of debt and approval), or take a media tour for a quick approval bump. If treasury crashes or approval collapses for too long, your mandate ends."
            />
            <Section
              title="Shortcuts"
              body="Space pauses, 1–5 sets speed, D toggles decisions, S toggles country stats, B toggles the briefing log, Esc opens the pause menu. Backtick (`) opens the debug overlay."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={commit} disabled={needsAgenda && !selected}>
            {needsAgenda ? "Set agenda & start governing" : "Start governing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="font-medium leading-tight">{title}</div>
      <p className="text-xs text-muted-foreground leading-snug">{body}</p>
    </div>
  )
}
