"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import { useGame, useGameActions } from "@/components/game-provider"
import { useHudState } from "@/components/hud-state"

export function KeyboardShortcuts() {
  const game = useGame()
  const { togglePause, setSpeed } = useGameActions()
  const {
    statsOpen,
    toggleStats,
    closeStats,
    decisionsOpen,
    toggleDecisions,
    closeDecisions,
    diplomacyOpen,
    toggleDiplomacy,
    closeDiplomacy,
    openPauseMenu,
    toggleBriefing,
  } = useHudState()

  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
      if (target.isContentEditable) return true
      return false
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!game) return
        if (game.pendingEvent || game.gameOver) return
        // Let Radix-managed dialogs (pause menu, event dialog, welcome) close themselves first.
        if (document.querySelector('[role="dialog"][data-state="open"]')) {
          return
        }
        if (decisionsOpen) {
          e.preventDefault()
          closeDecisions()
          return
        }
        if (diplomacyOpen) {
          e.preventDefault()
          closeDiplomacy()
          return
        }
        if (statsOpen) {
          e.preventDefault()
          closeStats()
          return
        }
        e.preventDefault()
        openPauseMenu()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(e.target)) return
      if (!game) return
      if (game.pendingEvent || game.gameOver) return

      switch (e.key) {
        case " ": {
          e.preventDefault()
          togglePause()
          break
        }
        case "1":
        case "2":
        case "3":
        case "4":
        case "5": {
          const speed = Number.parseInt(e.key, 10) as 1 | 2 | 3 | 4 | 5
          setSpeed(speed)
          toast.message(`Speed ${speed}×`, { duration: 1200 })
          break
        }
        case "d":
        case "D": {
          toggleDecisions()
          break
        }
        case "s":
        case "S": {
          toggleStats()
          break
        }
        case "b":
        case "B": {
          toggleBriefing()
          break
        }
        case "g":
        case "G": {
          toggleDiplomacy()
          break
        }
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    game,
    togglePause,
    setSpeed,
    statsOpen,
    toggleStats,
    closeStats,
    decisionsOpen,
    toggleDecisions,
    closeDecisions,
    diplomacyOpen,
    toggleDiplomacy,
    closeDiplomacy,
    openPauseMenu,
    toggleBriefing,
  ])

  return null
}
