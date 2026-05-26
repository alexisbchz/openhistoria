"use client"

import {
  Game,
  SPEED_MS_PER_DAY,
  clearGame,
  loadGame,
  saveGame,
  type DiplomaticMessageArgs,
  type GameSpeed,
  type Project,
} from "@workspace/engine"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

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
  resetGame: () => void
}

interface GameContextValue {
  game: Game | null
  actions: GameActions
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
  resetGame: () => {},
}

const GameContext = createContext<GameContextValue>({
  game: null,
  actions: noopActions,
})

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<Game | null>(null)

  useEffect(() => {
    const existing = loadGame()
    if (existing) {
      setGame(existing)
      return
    }
    const next = Game.createNew()
    saveGame(next)
    setGame(next)
  }, [])

  const setSpeed = useCallback((speed: GameSpeed) => {
    setGame((current) => {
      if (!current) return current
      const next = current.with({ speed })
      saveGame(next)
      return next
    })
  }, [])

  const togglePause = useCallback(() => {
    setGame((current) => {
      if (!current) return current
      if (current.gameOver) return current
      if (current.pendingEventId && current.paused) return current
      const next = current.with({ paused: !current.paused })
      saveGame(next)
      return next
    })
  }, [])

  const setPaused = useCallback((paused: boolean) => {
    setGame((current) => {
      if (!current) return current
      if (current.paused === paused) return current
      if (current.gameOver) return current
      const next = current.with({ paused })
      saveGame(next)
      return next
    })
  }, [])

  const addProject = useCallback((project: Project) => {
    setGame((current) => {
      if (!current) return current
      const next = current.addProject(project)
      saveGame(next)
      return next
    })
  }, [])

  const removeProject = useCallback((id: string) => {
    setGame((current) => {
      if (!current) return current
      const next = current.removeProject(id)
      saveGame(next)
      return next
    })
  }, [])

  const cancelProject = useCallback((id: string) => {
    setGame((current) => {
      if (!current) return current
      const next = current.cancelProject(id)
      saveGame(next)
      return next
    })
  }, [])

  const issueBond = useCallback((amountMillions: number) => {
    setGame((current) => {
      if (!current) return current
      const next = current.issueBond(amountMillions)
      saveGame(next)
      return next
    })
  }, [])

  const mediaTour = useCallback(() => {
    setGame((current) => {
      if (!current) return current
      const next = current.mediaTour()
      saveGame(next)
      return next
    })
  }, [])

  const proposeAlliance = useCallback((target: string) => {
    setGame((current) => {
      if (!current) return current
      const next = current.proposeAlliance(target)
      saveGame(next)
      return next
    })
  }, [])

  const breakAlliance = useCallback((target: string) => {
    setGame((current) => {
      if (!current) return current
      const next = current.breakAlliance(target)
      saveGame(next)
      return next
    })
  }, [])

  const sendDiplomaticMessage = useCallback(
    (args: DiplomaticMessageArgs) => {
      setGame((current) => {
        if (!current) return current
        const next = current.sendDiplomaticMessage(args)
        saveGame(next)
        return next
      })
    },
    []
  )

  const resolveEventChoice = useCallback(
    (eventId: string, choiceId: string) => {
      setGame((current) => {
        if (!current) return current
        const next = current.resolveEventChoice(eventId, choiceId)
        saveGame(next)
        return next
      })
    },
    []
  )

  const resetGame = useCallback(() => {
    clearGame()
    const next = Game.createNew()
    saveGame(next)
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
        const next = current.tick(1)
        saveGame(next)
        return next
      })
    }, intervalMs)
    return () => clearInterval(id)
  }, [game?.speed, game?.paused, game?.gameOver, game?.pendingEventId, game])

  const value = useMemo<GameContextValue>(
    () => ({
      game,
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
        resetGame,
      },
    }),
    [
      game,
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
