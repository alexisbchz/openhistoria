"use client"

import { listMinisters, type Minister, type MinisterBonus } from "@workspace/engine"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { UserIcon } from "lucide-react"
import { useMemo } from "react"

import { useGame } from "@/components/game-provider"

export function CabinetSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const game = useGame()
  const ministers = useMemo<Minister[]>(
    () => (game ? listMinisters(game.nation) : []),
    [game]
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-96">
        <SheetHeader>
          <SheetTitle>Cabinet</SheetTitle>
          <SheetDescription>
            Ministers serving the {game?.stats.name ?? ""} government.
          </SheetDescription>
        </SheetHeader>
        <ul className="grid gap-2 overflow-y-auto px-4 pb-4">
          {ministers.map((m) => (
            <li
              key={m.id}
              className="grid grid-cols-[auto_1fr] gap-3 rounded-md border bg-card p-3"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserIcon className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium leading-tight">
                    {m.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {m.party}
                  </span>
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  {m.role}
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  {m.portfolio}
                </p>
                {m.bonus ? <MinisterBonusList bonus={m.bonus} /> : null}
              </div>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}

function MinisterBonusList({ bonus }: { bonus: MinisterBonus }) {
  const items: string[] = []
  if (bonus.bondApprovalMultiplier && bonus.bondApprovalMultiplier !== 1) {
    items.push(
      `Bonds cost ${Math.round((1 - bonus.bondApprovalMultiplier) * 100)}% less approval`
    )
  }
  if (bonus.bondDebtMultiplier && bonus.bondDebtMultiplier !== 1) {
    items.push(
      `Bonds add ${Math.round((1 - bonus.bondDebtMultiplier) * 100)}% less debt/GDP`
    )
  }
  if (bonus.approvalPerDay) {
    const yearly = (bonus.approvalPerDay * 365).toFixed(1)
    items.push(
      `+${bonus.approvalPerDay.toFixed(2)} approval / day (~${yearly}/yr)`
    )
  }
  if (bonus.diplomacyDriftMultiplier && bonus.diplomacyDriftMultiplier !== 1) {
    items.push(
      `Opinion drift ×${bonus.diplomacyDriftMultiplier.toFixed(2)}`
    )
  }
  if (bonus.projectCompletionApprovalBonus) {
    const kinds = bonus.projectCompletionApprovalBonus.kinds
      .map((k) => k.replace("construction:", ""))
      .join(", ")
    items.push(
      `+${bonus.projectCompletionApprovalBonus.delta} approval on completing ${kinds} projects`
    )
  }
  if (items.length === 0) return null
  return (
    <ul className="mt-1.5 grid gap-0.5 text-[11px] leading-snug text-emerald-500">
      {items.map((it) => (
        <li key={it}>· {it}</li>
      ))}
    </ul>
  )
}
