"use client"

import {
  Game,
  SPEED_MS_PER_DAY,
  clearGame,
  clearQuarantine,
  loadGameWithStatus,
  saveGame,
  type DiplomaticMessageArgs,
  type GameSpeed,
  type Project,
  type ReformAgendaId,
} from "@workspace/engine"
import { Result } from "neverthrow"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"

const MS_PER_DAY = 86_400_000
const AUTOSAVE_INTERVAL_DAYS = 7

interface GameActions {
  setSpeed: (speed: GameSpeed) => void
  togglePause: () => void
  setPaused: (paused: boolean) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  cancelProject: (id: string) => void
  issueBond: (amountMillions: number) => void
  mediaTour: () => void
  proposeAlliance: (target: string) => void
  breakAlliance: (target: string) => void
  sendDiplomaticMessage: (args: DiplomaticMessageArgs) => void
  resolveEventChoice: (eventId: string, choiceId: string) => void
  setReformAgenda: (id: ReformAgendaId) => void
  resetGame: () => void
}

interface TickStats {
  lastDurationMs: number
  lastTickAt: string | null
  totalTicks: number
  errors: number
  lastError: string | null
}

interface GameContextValue {
  game: Game | null
  actions: GameActions
  tickStats: TickStats
}

const noopActions: GameActions = {
  setSpeed: () => {},
  togglePause: () => {},
  setPaused: () => {},
  addProject: () => {},
  removeProject: () => {},
  cancelProject: () => {},
  issueBond: () => {},
  mediaTour: () => {},
  proposeAlliance: () => {},
  breakAlliance: () => {},
  sendDiplomaticMessage: () => {},
  resolveEventChoice: () => {},
  setReformAgenda: () => {},
  resetGame: () => {},
}

const DEFAULT_TICK_STATS: TickStats = {
  lastDurationMs: 0,
  lastTickAt: null,
  totalTicks: 0,
  errors: 0,
  lastError: null,
}

const GameContext = createContext<GameContextValue>({
  game: null,
  actions: noopActions,
  tickStats: DEFAULT_TICK_STATS,
})

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<Game | null>(null)
  const [tickStats, setTickStats] = useState<TickStats>(DEFAULT_TICK_STATS)
  const lastSavedDateRef = useRef<number>(0)

  function autosave(next: Game) {
    const ts = next.date.getTime()
    const since = ts - lastSavedDateRef.current
    if (
      since >= AUTOSAVE_INTERVAL_DAYS * MS_PER_DAY ||
      lastSavedDateRef.current === 0
    ) {
      saveGame(next)
      lastSavedDateRef.current = ts
    }
  }

  useEffect(() => {
    const result = loadGameWithStatus()
    if (result.corrupted) {
      toast.error("Saved game was corrupted and reset", {
        description: "A backup was preserved under openhistoria:save.bak.",
        duration: 6000,
      })
    }
    if (result.game) {
      lastSavedDateRef.current = result.game.date.getTime()
      setGame(result.game)
      return
    }
    const next = Game.createNew()
    saveGame(next)
    lastSavedDateRef.current = next.date.getTime()
    setGame(next)
  }, [])

  const persist = useCallback((next: Game) => {
    saveGame(next)
    lastSavedDateRef.current = next.date.getTime()
  }, [])

  const setSpeed = useCallback(
    (speed: GameSpeed) => {
      setGame((current) => {
        if (!current) return current
        const next = current.with({ speed })
        persist(next)
        return next
      })
    },
    [persist]
  )

  const togglePause = useCallback(() => {
    setGame((current) => {
      if (!current) return current
      if (current.gameOver) return current
      if (current.pendingEventId && current.paused) return current
      const next = current.with({ paused: !current.paused })
      persist(next)
      return next
    })
  }, [persist])

  const setPaused = useCallback(
    (paused: boolean) => {
      setGame((current) => {
        if (!current) return current
        if (current.paused === paused) return current
        if (current.gameOver) return current
        const next = current.with({ paused })
        persist(next)
        return next
      })
    },
    [persist]
  )

  const addProject = useCallback(
    (project: Project) => {
      setGame((current) => {
        if (!current) return current
        const next = current.addProject(project)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const removeProject = useCallback(
    (id: string) => {
      setGame((current) => {
        if (!current) return current
        const next = current.removeProject(id)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const cancelProject = useCallback(
    (id: string) => {
      setGame((current) => {
        if (!current) return current
        const next = current.cancelProject(id)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const issueBond = useCallback(
    (amountMillions: number) => {
      setGame((current) => {
        if (!current) return current
        const next = current.issueBond(amountMillions)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const mediaTour = useCallback(() => {
    setGame((current) => {
      if (!current) return current
      const next = current.mediaTour()
      persist(next)
      return next
    })
  }, [persist])

  const proposeAlliance = useCallback(
    (target: string) => {
      setGame((current) => {
        if (!current) return current
        const next = current.proposeAlliance(target)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const breakAlliance = useCallback(
    (target: string) => {
      setGame((current) => {
        if (!current) return current
        const next = current.breakAlliance(target)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const sendDiplomaticMessage = useCallback(
    (args: DiplomaticMessageArgs) => {
      setGame((current) => {
        if (!current) return current
        const next = current.sendDiplomaticMessage(args)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const resolveEventChoice = useCallback(
    (eventId: string, choiceId: string) => {
      setGame((current) => {
        if (!current) return current
        const next = current.resolveEventChoice(eventId, choiceId)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const setReformAgenda = useCallback(
    (id: ReformAgendaId) => {
      setGame((current) => {
        if (!current) return current
        const next = current.setReformAgenda(id)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const resetGame = useCallback(() => {
    clearGame()
    clearQuarantine()
    const next = Game.createNew()
    saveGame(next)
    lastSavedDateRef.current = next.date.getTime()
    setGame(next)
  }, [])

  useEffect(() => {
    if (!game) return
    if (game.paused || game.gameOver || game.pendingEventId) return
    const intervalMs = SPEED_MS_PER_DAY[game.speed]
    const id = setInterval(() => {
      setGame((current) => {
        if (!current) return current
        if (current.paused || current.gameOver || current.pendingEventId)
          return current
        const t0 =
          typeof performance !== "undefined" ? performance.now() : Date.now()
        const ticked = Result.fromThrowable(
          () => current.tick(1),
          (cause) => (cause instanceof Error ? cause : new Error(String(cause)))
        )()
        return ticked.match(
          (next) => {
            const t1 =
              typeof performance !== "undefined"
                ? performance.now()
                : Date.now()
            autosave(next)
            setTickStats((prev) => ({
              lastDurationMs: t1 - t0,
              lastTickAt: next.date.toISOString(),
              totalTicks: prev.totalTicks + 1,
              errors: prev.errors,
              lastError: prev.lastError,
            }))
            return next
          },
          (err) => {
            const message = err.message
            if (typeof console !== "undefined") {
              console.error("[openhistoria] tick failed", err)
            }
            toast.error("Game loop crashed", {
              description: `${message}. Auto-paused; your last good save is intact.`,
              duration: 6000,
            })
            setTickStats((prev) => ({
              ...prev,
              errors: prev.errors + 1,
              lastError: message,
            }))
            return current.with({ paused: true })
          }
        )
      })
    }, intervalMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.speed, game?.paused, game?.gameOver, game?.pendingEventId, game])

  const value = useMemo<GameContextValue>(
    () => ({
      game,
      tickStats,
      actions: {
        setSpeed,
        togglePause,
        setPaused,
        addProject,
        removeProject,
        cancelProject,
        issueBond,
        mediaTour,
        proposeAlliance,
        breakAlliance,
        sendDiplomaticMessage,
        resolveEventChoice,
        setReformAgenda,
        resetGame,
      },
    }),
    [
      game,
      tickStats,
      setSpeed,
      togglePause,
      setPaused,
      addProject,
      removeProject,
      cancelProject,
      issueBond,
      mediaTour,
      proposeAlliance,
      breakAlliance,
      sendDiplomaticMessage,
      resolveEventChoice,
      setReformAgenda,
      resetGame,
    ]
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): Game | null {
  return useContext(GameContext).game
}

export function useGameActions(): GameActions {
  return useContext(GameContext).actions
}

export function useTickStats(): TickStats {
  return useContext(GameContext).tickStats
}
