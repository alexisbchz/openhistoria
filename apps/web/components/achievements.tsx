"use client"

import type { Game } from "@workspace/engine"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { useGame } from "@/components/game-provider"

const STORAGE_KEY = "openhistoria:achievements"

interface Achievement {
  id: string
  title: string
  description: (game: Game) => string
  test: (game: Game) => boolean
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-project-started",
    title: "First decision",
    description: () => "You scheduled your first project on the map.",
    test: (g) => g.briefing.some((b) => b.kind === "project_started"),
  },
  {
    id: "first-project-completed",
    title: "Ribbon cut",
    description: () => "A project you launched has been completed.",
    test: (g) => g.briefing.some((b) => b.kind === "project_completed"),
  },
  {
    id: "first-alliance",
    title: "Bloc-builder",
    description: () => "You secured your first alliance.",
    test: (g) => Object.values(g.relations).some((r) => r.allied),
  },
  {
    id: "first-sanction",
    title: "Coercive diplomacy",
    description: () => "You imposed sanctions on another nation.",
    test: (g) =>
      g.briefing.some((b) => b.title.startsWith("Sanctions imposed on ")),
  },
  {
    id: "first-trade-deal",
    title: "Open for business",
    description: () => "You signed your first trade deal.",
    test: (g) =>
      g.briefing.some((b) => b.title.startsWith("Trade deal signed with ")),
  },
  {
    id: "high-approval",
    title: "Honeymoon redux",
    description: (g) => `Approval reached ${g.approval.toFixed(0)}%.`,
    test: (g) => g.approval >= 55,
  },
  {
    id: "cabinet-reshuffle",
    title: "Reshuffle",
    description: () => "You appointed a different minister to a cabinet role.",
    test: (g) => Object.keys(g.cabinet).length > 0,
  },
  {
    id: "weathered-the-deficit",
    title: "Weathered the deficit",
    description: () => "You pulled the treasury back from the bankruptcy zone.",
    test: (g) =>
      g.treasury > 0 && g.briefing.some((b) => b.title.includes("bond markets are nervous")),
  },
]

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
