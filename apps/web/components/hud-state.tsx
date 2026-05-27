"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useGame, useGameActions } from "@/components/game-provider"

interface PanelPos {
  x: number
  y: number
}

interface HudStateValue {
  // Stats panel (floating)
  statsOpen: boolean
  openStats: () => void
  closeStats: () => void
  toggleStats: () => void
  statsPos: PanelPos
  setStatsPos: (pos: PanelPos) => void

  // Place-search panel (floating)
  searchOpen: boolean
  openSearch: () => void
  closeSearch: () => void
  toggleSearch: () => void
  searchPos: PanelPos
  setSearchPos: (pos: PanelPos) => void

  // Decisions panel (floating)
  decisionsOpen: boolean
  openDecisions: () => void
  closeDecisions: () => void
  toggleDecisions: () => void
  decisionsPos: PanelPos
  setDecisionsPos: (pos: PanelPos) => void

  // Diplomacy panel (floating)
  diplomacyOpen: boolean
  openDiplomacy: () => void
  closeDiplomacy: () => void
  toggleDiplomacy: () => void
  diplomacyPos: PanelPos
  setDiplomacyPos: (pos: PanelPos) => void

  // Pause menu (modal)
  pauseMenuOpen: boolean
  openPauseMenu: () => void
  closePauseMenu: () => void

  // Briefing
  briefingCollapsed: boolean
  setBriefingCollapsed: (v: boolean) => void
  toggleBriefing: () => void
}

const HudStateContext = createContext<HudStateValue | null>(null)

function defaultStatsPos(): PanelPos {
  return { x: 16, y: 16 }
}

function defaultSearchPos(): PanelPos {
  // Just below where the search-location button sits.
  return { x: 16, y: 72 }
}

function defaultDecisionsPos(): PanelPos {
  if (typeof window === "undefined") return { x: 200, y: 80 }
  const w = 820
  const h = 560
  return {
    x: Math.max(16, Math.round((window.innerWidth - w) / 2)),
    y: Math.max(16, Math.round((window.innerHeight - h) / 2)),
  }
}

export function HudStateProvider({ children }: { children: ReactNode }) {
  const [statsOpen, setStatsOpen] = useState(false)
  const [statsPos, setStatsPos] = useState<PanelPos>(defaultStatsPos)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchPos, setSearchPos] = useState<PanelPos>(defaultSearchPos)

  const [decisionsOpen, setDecisionsOpen] = useState(false)
  const [decisionsPos, setDecisionsPos] = useState<PanelPos | null>(null)

  const [diplomacyOpen, setDiplomacyOpen] = useState(false)
  const [diplomacyPos, setDiplomacyPos] = useState<PanelPos>({ x: 24, y: 80 })

  const [pauseMenuOpen, setPauseMenuOpen] = useState(false)
  const [briefingCollapsed, setBriefingCollapsed] = useState(false)

  const wasPausedBeforeDecisionsRef = useRef<boolean | null>(null)
  const wasPausedBeforePauseMenuRef = useRef<boolean | null>(null)
  const game = useGame()
  const { setPaused } = useGameActions()

  const openStats = useCallback(() => setStatsOpen(true), [])
  const closeStats = useCallback(() => setStatsOpen(false), [])
  const toggleStats = useCallback(() => setStatsOpen((v) => !v), [])

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const toggleSearch = useCallback(() => setSearchOpen((v) => !v), [])

  const openDecisions = useCallback(() => {
    if (game && !game.gameOver && !game.pendingEvent) {
      wasPausedBeforeDecisionsRef.current = game.paused
      if (!game.paused) setPaused(true)
    }
    setDecisionsPos((current) => current ?? defaultDecisionsPos())
    setDecisionsOpen(true)
  }, [game, setPaused])

  const closeDecisions = useCallback(() => {
    setDecisionsOpen(false)
    if (
      game &&
      !game.gameOver &&
      !game.pendingEvent &&
      wasPausedBeforeDecisionsRef.current === false
    ) {
      setPaused(false)
    }
    wasPausedBeforeDecisionsRef.current = null
  }, [game, setPaused])

  const toggleDecisions = useCallback(() => {
    if (decisionsOpen) closeDecisions()
    else openDecisions()
  }, [decisionsOpen, openDecisions, closeDecisions])

  const openDiplomacy = useCallback(() => setDiplomacyOpen(true), [])
  const closeDiplomacy = useCallback(() => setDiplomacyOpen(false), [])
  const toggleDiplomacy = useCallback(() => setDiplomacyOpen((v) => !v), [])

  const openPauseMenu = useCallback(() => {
    if (game && !game.gameOver && !game.pendingEvent) {
      wasPausedBeforePauseMenuRef.current = game.paused
      if (!game.paused) setPaused(true)
    }
    setPauseMenuOpen(true)
  }, [game, setPaused])

  const closePauseMenu = useCallback(() => {
    setPauseMenuOpen(false)
    if (
      game &&
      !game.gameOver &&
      !game.pendingEvent &&
      wasPausedBeforePauseMenuRef.current === false
    ) {
      setPaused(false)
    }
    wasPausedBeforePauseMenuRef.current = null
  }, [game, setPaused])

  const toggleBriefing = useCallback(
    () => setBriefingCollapsed((c) => !c),
    []
  )

  const setDecisionsPosSafe = useCallback(
    (pos: PanelPos) => setDecisionsPos(pos),
    []
  )

  const value = useMemo<HudStateValue>(
    () => ({
      statsOpen,
      openStats,
      closeStats,
      toggleStats,
      statsPos,
      setStatsPos,
      searchOpen,
      openSearch,
      closeSearch,
      toggleSearch,
      searchPos,
      setSearchPos,
      decisionsOpen,
      openDecisions,
      closeDecisions,
      toggleDecisions,
      decisionsPos: decisionsPos ?? defaultDecisionsPos(),
      setDecisionsPos: setDecisionsPosSafe,
      diplomacyOpen,
      openDiplomacy,
      closeDiplomacy,
      toggleDiplomacy,
      diplomacyPos,
      setDiplomacyPos,
      pauseMenuOpen,
      openPauseMenu,
      closePauseMenu,
      briefingCollapsed,
      setBriefingCollapsed,
      toggleBriefing,
    }),
    [
      statsOpen,
      openStats,
      closeStats,
      toggleStats,
      statsPos,
      searchOpen,
      openSearch,
      closeSearch,
      toggleSearch,
      searchPos,
      decisionsOpen,
      openDecisions,
      closeDecisions,
      toggleDecisions,
      decisionsPos,
      setDecisionsPosSafe,
      diplomacyOpen,
      openDiplomacy,
      closeDiplomacy,
      toggleDiplomacy,
      diplomacyPos,
      pauseMenuOpen,
      openPauseMenu,
      closePauseMenu,
      briefingCollapsed,
      toggleBriefing,
    ]
  )

  return (
    <HudStateContext.Provider value={value}>{children}</HudStateContext.Provider>
  )
}

export function useHudState(): HudStateValue {
  const ctx = useContext(HudStateContext)
  if (!ctx) {
    throw new Error("useHudState must be used within HudStateProvider")
  }
  return ctx
}
