"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { useGame } from "@/components/game-provider"

const STORAGE_KEY = "openhistoria:tutorial-hints-shown"

/**
 * One-shot contextual hints. Each hint has a trigger that the watcher checks
 * on game state changes; once fired, the hint id is persisted in localStorage
 * so it never replays. Hints are deliberately non-blocking toasts: the player
 * is never forced to acknowledge them.
 */
interface Hint {
  id: string
  /** Returns true when the hint becomes relevant. */
  ready: (ctx: HintContext) => boolean
  title: string
  description: string
}

interface HintContext {
  daysSinceStart: number
  hasOpenedDiplomacy: boolean
  hasOpenedDecisions: boolean
  triggeredEventCount: number
  projectCount: number
}

const HINTS: Hint[] = [
  {
    id: "open-decisions",
    ready: (c) =>
      c.daysSinceStart >= 5 &&
      c.projectCount === 0 &&
      !c.hasOpenedDecisions,
    title: "Schedule your first decision",
    description: "Press D (or the gold button) to open the decisions panel.",
  },
  {
    id: "open-diplomacy",
    ready: (c) =>
      c.daysSinceStart >= 30 && !c.hasOpenedDiplomacy,
    title: "Check on diplomatic relations",
    description: "Press G to see all AI nations and their current opinions.",
  },
  {
    id: "first-event-resolved",
    ready: (c) => c.triggeredEventCount === 1,
    title: "Tip: events shape the campaign",
    description:
      "Each resolved event can unlock follow-ups. Watch the briefing for chained beats.",
  },
]

function loadShown(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((s): s is string => typeof s === "string"))
  } catch {
    return new Set()
  }
}

function persistShown(set: Set<string>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // best-effort
  }
}

export function TutorialHints() {
  const game = useGame()
  const shownRef = useRef<Set<string>>(new Set())
  const hydratedRef = useRef(false)
  const decisionsOpenedRef = useRef(false)
  const diplomacyOpenedRef = useRef(false)

  // Track when the player visits the diplomacy / decisions panels so we can
  // suppress the "open it" hint after the fact.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "g" || e.key === "G") diplomacyOpenedRef.current = true
      if (e.key === "d" || e.key === "D") decisionsOpenedRef.current = true
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) {
      shownRef.current = loadShown()
      hydratedRef.current = true
    }
    if (!game) return
    const ctx: HintContext = {
      daysSinceStart:
        (game.date.getTime() - game.startedAt.getTime()) / 86_400_000,
      hasOpenedDecisions: decisionsOpenedRef.current,
      hasOpenedDiplomacy: diplomacyOpenedRef.current,
      triggeredEventCount: game.triggeredEvents.length,
      projectCount: game.projects.length,
    }
    let changed = false
    for (const h of HINTS) {
      if (shownRef.current.has(h.id)) continue
      if (!h.ready(ctx)) continue
      shownRef.current.add(h.id)
      changed = true
      toast.info(h.title, {
        description: h.description,
        duration: 7000,
      })
    }
    if (changed) persistShown(shownRef.current)
  }, [game])

  return null
}
