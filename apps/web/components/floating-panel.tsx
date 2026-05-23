"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { XIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

let topZ = 1200

interface FloatingPanelProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  icon?: ReactNode
  position: { x: number; y: number }
  onPositionChange: (pos: { x: number; y: number }) => void
  className?: string
  bodyClassName?: string
  headerExtra?: ReactNode
  children: ReactNode
}

export function FloatingPanel({
  open,
  onClose,
  title,
  icon,
  position,
  onPositionChange,
  className,
  bodyClassName,
  headerExtra,
  children,
}: FloatingPanelProps) {
  const [z, setZ] = useState(() => ++topZ)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  useEffect(() => {
    if (open) setZ(++topZ)
  }, [open])

  function bringToFront() {
    if (z < topZ) setZ(++topZ)
  }

  function clamp(pos: { x: number; y: number }) {
    const w = panelRef.current?.offsetWidth ?? 0
    const h = panelRef.current?.offsetHeight ?? 0
    const maxX = Math.max(0, window.innerWidth - w)
    const maxY = Math.max(0, window.innerHeight - h)
    return {
      x: Math.max(0, Math.min(maxX, pos.x)),
      y: Math.max(0, Math.min(maxY, pos.y)),
    }
  }

  function onHeaderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return
    bringToFront()
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onHeaderPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const { dx, dy } = dragRef.current
    onPositionChange(clamp({ x: e.clientX - dx, y: e.clientY - dy }))
  }

  function onHeaderPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  if (!open) return null
  return (
    <div
      ref={panelRef}
      className={cn(
        "pointer-events-auto fixed flex flex-col overflow-hidden rounded-md border border-border/80 bg-background/95 shadow-2xl ring-1 ring-black/40 backdrop-blur-sm",
        className
      )}
      style={{ left: position.x, top: position.y, zIndex: z }}
      onPointerDownCapture={bringToFront}
      role="region"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div
        className="flex cursor-move select-none items-center justify-between gap-2 border-b border-border/80 bg-gradient-to-b from-muted/90 to-muted/60 px-3 py-1.5"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold tracking-wide">
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1" data-no-drag>
          {headerExtra}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            aria-label="Close panel"
            title="Close (Esc)"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>
        {children}
      </div>
    </div>
  )
}
