"use client"

import type { SaveSlotEntry } from "@workspace/engine"
import { SAVE_SLOT_IDS, type SaveSlotId } from "@workspace/engine"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { FolderOpenIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useGameActions } from "@/components/game-provider"

interface SaveSlotsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const gameDateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
})

export function SaveSlotsDialog({ open, onOpenChange }: SaveSlotsDialogProps) {
  const { saveToSlot, loadFromSlot, clearSlot, listSaveSlots } =
    useGameActions()
  const [slots, setSlots] = useState<SaveSlotEntry[]>([])
  const [labels, setLabels] = useState<Record<SaveSlotId, string>>(
    () =>
      Object.fromEntries(
        SAVE_SLOT_IDS.map((id) => [id, ""])
      ) as Record<SaveSlotId, string>
  )

  function refresh() {
    setSlots(listSaveSlots())
  }

  useEffect(() => {
    if (open) refresh()
  }, [open])

  function handleSave(id: SaveSlotId) {
    const labelInput = labels[id]?.trim()
    const label =
      labelInput && labelInput.length > 0
        ? labelInput
        : `Slot ${id.replace("slot-", "")}`
    const result = saveToSlot(id, label)
    if (result.ok) {
      toast.success(`Saved to ${label}`)
      refresh()
    } else {
      toast.error("Save failed", { description: result.error })
    }
  }

  function handleLoad(id: SaveSlotId) {
    const result = loadFromSlot(id)
    if (result.ok) {
      toast.success("Loaded")
      onOpenChange(false)
    } else {
      toast.error("Load failed", { description: result.error })
    }
  }

  function handleDelete(id: SaveSlotId) {
    clearSlot(id)
    refresh()
  }

  function findEntry(id: SaveSlotId): SaveSlotEntry | undefined {
    return slots.find((s) => s.id === id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SaveIcon className="size-4" />
            Save slots
          </DialogTitle>
          <DialogDescription>
            Three manual slots alongside the autosave. Labels are optional.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {SAVE_SLOT_IDS.map((id) => {
            const entry = findEntry(id)
            const occupied = !!entry
            return (
              <li
                key={id}
                className="grid gap-2 rounded-md border bg-card p-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {id.replace("slot-", "Slot ")}
                  </span>
                  {entry ? (
                    <span className="text-[10px] text-muted-foreground">
                      Saved {dateFmt.format(new Date(entry.savedAt))}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Empty</span>
                  )}
                </div>
                {entry ? (
                  <div>
                    <div className="font-medium leading-tight">
                      {entry.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      In-game: {gameDateFmt.format(new Date(entry.gameDate))}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder={
                      entry ? "Overwrite with new label…" : "Optional label"
                    }
                    value={labels[id]}
                    onChange={(e) =>
                      setLabels((p) => ({ ...p, [id]: e.target.value }))
                    }
                    className="h-8 flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleSave(id)}
                    className="h-8"
                  >
                    <SaveIcon />
                    {occupied ? "Overwrite" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!occupied}
                    onClick={() => handleLoad(id)}
                    className="h-8"
                  >
                    <FolderOpenIcon />
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!occupied}
                    onClick={() => handleDelete(id)}
                    className="h-8"
                    aria-label={`Delete ${id}`}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
