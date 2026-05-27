"use client"

import type { Game } from "@workspace/engine"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { useGame } from "@/components/game-provider"

export const ACHIEVEMENTS_STORAGE_KEY = "openhistoria:achievements"
const STORAGE_KEY = ACHIEVEMENTS_STORAGE_KEY

export interface Achievement {
  id: string
  title: string
  description: (game: Game) => string
  test: (game: Game) => boolean
  /** Static descriptive text for the trophy-room listing. */
  blurb: string
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-project-started",
    title: "First decision",
    blurb: "Schedule your first project on the map.",
    description: () => "You scheduled your first project on the map.",
    test: (g) => g.briefing.some((b) => b.kind === "project_started"),
  },
  {
    id: "first-project-completed",
    title: "Ribbon cut",
    blurb: "Complete a project you launched.",
    description: () => "A project you launched has been completed.",
    test: (g) => g.briefing.some((b) => b.kind === "project_completed"),
  },
  {
    id: "first-alliance",
    title: "Bloc-builder",
    blurb: "Secure your first alliance with another nation.",
    description: () => "You secured your first alliance.",
    test: (g) => Object.values(g.relations).some((r) => r.allied),
  },
  {
    id: "first-sanction",
    title: "Coercive diplomacy",
    blurb: "Impose sanctions on another nation.",
    description: () => "You imposed sanctions on another nation.",
    test: (g) =>
      g.briefing.some((b) => b.title.startsWith("Sanctions imposed on ")),
  },
  {
    id: "first-trade-deal",
    title: "Open for business",
    blurb: "Sign your first trade deal.",
    description: () => "You signed your first trade deal.",
    test: (g) =>
      g.briefing.some((b) => b.title.startsWith("Trade deal signed with ")),
  },
  {
    id: "high-approval",
    title: "Honeymoon redux",
    blurb: "Reach 55% approval.",
    description: (g) => `Approval reached ${g.approval.toFixed(0)}%.`,
    test: (g) => g.approval >= 55,
  },
  {
    id: "cabinet-reshuffle",
    title: "Reshuffle",
    blurb: "Appoint a different minister to a cabinet role.",
    description: () => "You appointed a different minister to a cabinet role.",
    test: (g) => Object.keys(g.cabinet).length > 0,
  },
  {
    id: "weathered-the-deficit",
    title: "Weathered the deficit",
    blurb: "Pull the treasury back from the bankruptcy zone after a warning fired.",
    description: () => "You pulled the treasury back from the bankruptcy zone.",
    test: (g) =>
      g.treasury > 0 && g.briefing.some((b) => b.title.includes("bond markets are nervous")),
  },
  {
    id: "event-chain",
    title: "Narrative arc",
    blurb: "Trigger a follow-up event chain by resolving the original beat.",
    description: () => "A scheduled follow-up event chain triggered.",
    test: (g) =>
      g.triggeredEvents.some((t) =>
        t.id === "fr-2026-rail-strike-escalation" ||
        t.id === "fr-2026-franco-german-industrial"
      ),
  },
]

export function loadUnlockedAchievements(): Set<string> {
  return loadUnlocked()
}

function loadUnlocked(): Set<string> {
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

function persistUnlocked(set: Set<string>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // best-effort
  }
}

/**
 * Side-effect-only component: watches `game` for newly-met achievements and
 * fires a toast for each. Unlocks persist in localStorage so the same toast
 * doesn't replay every reload.
 */
export function AchievementWatcher() {
  const game = useGame()
  const unlockedRef = useRef<Set<string>>(new Set())
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (!hydratedRef.current) {
      unlockedRef.current = loadUnlocked()
      hydratedRef.current = true
    }
    if (!game) return
    let changed = false
    for (const ach of ACHIEVEMENTS) {
      if (unlockedRef.current.has(ach.id)) continue
      if (!ach.test(game)) continue
      unlockedRef.current.add(ach.id)
      changed = true
      toast.success(`Achievement · ${ach.title}`, {
        description: ach.description(game),
        duration: 4500,
      })
    }
    if (changed) persistUnlocked(unlockedRef.current)
  }, [game])

  return null
}
