"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useMap, useMapEvents } from "@workspace/ui/components/map"
import {
  BugIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  TrophyIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { useGame, useGameActions } from "@/components/game-provider"
import { useHudState } from "@/components/hud-state"
import { useMapLayers } from "@/components/map-layers-state"
import { TrophyRoom } from "@/components/trophy-room"

export function PauseMenu() {
  const { pauseMenuOpen, closePauseMenu } = useHudState()
  const { resetGame, importGame, exportSnapshotJson } = useGameActions()
  const [confirmReset, setConfirmReset] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [trophyOpen, setTrophyOpen] = useState(false)

  function handleOpenChange(open: boolean) {
    if (open) return
    setConfirmReset(false)
    setDebugOpen(false)
    closePauseMenu()
  }

  function handleReset() {
    resetGame()
    setConfirmReset(false)
    setDebugOpen(false)
    closePauseMenu()
  }

  function handleExport() {
    const json = exportSnapshotJson()
    if (!json) {
      toast.error("No game to export yet")
      return
    }
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `openhistoria-save-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file later
    if (!file) return
    file
      .text()
      .then((text) => {
        const result = importGame(text)
        if (result.ok) {
          toast.success("Save imported")
          closePauseMenu()
        } else {
          toast.error("Import failed", { description: result.error })
        }
      })
      .catch((cause: unknown) => {
        const message =
          cause instanceof Error ? cause.message : "Could not read file"
        toast.error("Import failed", { description: message })
      })
  }

  return (
    <Dialog open={pauseMenuOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={debugOpen ? "sm:max-w-2xl" : "sm:max-w-sm"}
      >
        <DialogHeader>
          <DialogTitle>Paused</DialogTitle>
          <DialogDescription>
            {confirmReset
              ? "Resetting wipes your saved progress and starts a new game. This cannot be undone."
              : "Press Escape or Resume to continue governing."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {confirmReset ? (
            <>
              <Button variant="destructive" onClick={handleReset}>
                Confirm reset
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => handleOpenChange(false)}>Resume</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleExport}>
                  <DownloadIcon />
                  Export save
                </Button>
                <Button variant="outline" onClick={handleImportClick}>
                  <UploadIcon />
                  Import save
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFile}
                aria-label="Import save file"
              />
              <Button
                variant="outline"
                onClick={() => setConfirmReset(true)}
              >
                Reset game
              </Button>
              <Button
                variant="outline"
                onClick={() => setTrophyOpen(true)}
              >
                <TrophyIcon />
                Achievements
              </Button>
              <ThemePicker />
              <Button
                variant="ghost"
                onClick={() => setDebugOpen((v) => !v)}
                aria-pressed={debugOpen}
              >
                <BugIcon />
                {debugOpen ? "Hide debug" : "Show debug"}
              </Button>
            </>
          )}
        </div>
        {debugOpen && !confirmReset ? <DebugSection /> : null}
        <DialogFooter className="text-xs text-muted-foreground">
          Esc toggles this menu.
        </DialogFooter>
      </DialogContent>
      <TrophyRoom open={trophyOpen} onOpenChange={setTrophyOpen} />
    </Dialog>
  )
}

interface MapSnapshot {
  zoom: number
  center: { lat: number; lng: number }
  bounds: { south: number; west: number; north: number; east: number }
}

function readMapSnapshot(map: ReturnType<typeof useMap>): MapSnapshot {
  const c = map.getCenter()
  const b = map.getBounds()
  return {
    zoom: round(map.getZoom(), 3),
    center: { lat: round(c.lat, 4), lng: round(c.lng, 4) },
    bounds: {
      south: round(b.getSouth(), 4),
      west: round(b.getWest(), 4),
      north: round(b.getNorth(), 4),
      east: round(b.getEast(), 4),
    },
  }
}

function round(n: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function DebugSection() {
  const map = useMap()
  const game = useGame()
  const layers = useMapLayers()
  const [snap, setSnap] = useState<MapSnapshot>(() => readMapSnapshot(map))
  const [copied, setCopied] = useState(false)

  useMapEvents({
    zoomend: () => setSnap(readMapSnapshot(map)),
    moveend: () => setSnap(readMapSnapshot(map)),
  })

  // Keep the snapshot fresh once when the section first mounts.
  useEffect(() => {
    setSnap(readMapSnapshot(map))
  }, [map])

  const payload = {
    timestamp: new Date().toISOString(),
    map: snap,
    layers: layers.visible,
    game: game
      ? {
          date: game.date.toISOString(),
          speed: game.speed,
          paused: game.paused,
          treasury: Math.round(game.treasury),
          approval: Math.round(game.approval * 10) / 10,
          projects: game.projects.length,
          triggeredEvents: game.triggeredEvents.length,
          pendingEvent: game.pendingEvent?.id ?? null,
          gameOver: game.gameOver?.outcome ?? null,
        }
      : null,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  }
  const json = JSON.stringify(payload, null, 2)

  async function copy() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid gap-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <div className="grid gap-0.5 text-xs">
          <DebugStat label="Zoom" value={String(snap.zoom)} />
          <DebugStat
            label="Center"
            value={`${snap.center.lat}, ${snap.center.lng}`}
          />
          <DebugStat
            label="Bounds"
            value={`${snap.bounds.south},${snap.bounds.west} → ${snap.bounds.north},${snap.bounds.east}`}
          />
          {game ? (
            <>
              <DebugStat
                label="Game"
                value={`${game.date.toISOString().slice(0, 10)} · ${game.speed}× · ${game.paused ? "paused" : "running"}`}
              />
              <DebugStat
                label="Treasury / approval"
                value={`€${Math.round(game.treasury).toLocaleString()}M · ${Math.round(game.approval)}%`}
              />
              <DebugStat
                label="Projects / events"
                value={`${game.projects.length} active · ${game.triggeredEvents.length} resolved`}
              />
            </>
          ) : null}
        </div>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy JSON"}
        </Button>
      </div>
      <pre className="max-h-56 overflow-auto rounded-sm border bg-muted/40 p-2 text-[10px] leading-snug">
        {json}
      </pre>
    </div>
  )
}

function DebugStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 tabular-nums">
      <span className="w-32 text-muted-foreground">{label}</span>
      <span className="flex-1 break-all font-medium">{value}</span>
    </div>
  )
}

const THEME_OPTIONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "light", label: "Light", Icon: SunIcon },
  { key: "dark", label: "Dark", Icon: MoonIcon },
  { key: "system", label: "System", Icon: MonitorIcon },
]

function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const current = theme ?? "dark"
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted/40 p-1">
      {THEME_OPTIONS.map(({ key, label, Icon }) => {
        const active = current === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => setTheme(key)}
            className={
              "flex items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors " +
              (active
                ? "bg-background font-medium"
                : "text-muted-foreground hover:bg-background/60")
            }
            aria-pressed={active}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
