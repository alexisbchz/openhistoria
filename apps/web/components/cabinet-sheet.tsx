"use client"

import {
  listCabinetCandidates,
  type Minister,
  type MinisterBonus,
} from "@workspace/engine"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { CheckIcon, UserIcon } from "lucide-react"
import { useMemo } from "react"

import { useGame, useGameActions } from "@/components/game-provider"

export function CabinetSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const game = useGame()
  const { appointMinister } = useGameActions()
  const roles = useMemo(
    () => (game ? listCabinetCandidates(game.nation) : []),
    [game?.nation]
  )

  function activeId(roleId: string): string {
    return (
      game?.cabinet[roleId] ??
      roles.find((r) => r.roleId === roleId)?.candidates[0]?.id ??
      ""
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cabinet</SheetTitle>
          <SheetDescription>
            Each role has alternates with different specialties. Switching
            ministers re-applies the bonus stack immediately.
          </SheetDescription>
        </SheetHeader>
        <ul className="grid gap-3 px-4 pb-4">
          {roles.map((role) => {
            const current = activeId(role.roleId)
            return (
              <li
                key={role.roleId}
                className="grid gap-2 rounded-md border bg-card p-3"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {role.role}
                </div>
                {role.candidates.map((c) => {
                  const isActive = c.id === current
                  return (
                    <div
                      key={c.id}
                      className={
                        "grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-sm border p-2 " +
                        (isActive
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:border-border")
                      }
                    >
                      <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <UserIcon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium leading-tight">
                            {c.name}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {c.party}
                          </span>
                        </div>
                        <p className="text-xs leading-snug text-muted-foreground">
                          {c.portfolio}
                        </p>
                        {c.bonus ? <MinisterBonusList bonus={c.bonus} /> : null}
                      </div>
                      <div className="self-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary-foreground">
                            <CheckIcon className="size-3" /> In post
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              appointMinister(role.roleId, c.id)
                            }
                          >
                            Appoint
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}

function MinisterBonusList({ bonus }: { bonus: MinisterBonus }) {
  const items: string[] = []
  if (bonus.bondApprovalMultiplier && bonus.bondApprovalMultiplier !== 1) {
    items.push(
      `Bonds ${bonus.bondApprovalMultiplier < 1 ? "cost" : "lose"} ${Math.abs(
        Math.round((1 - bonus.bondApprovalMultiplier) * 100)
      )}% ${bonus.bondApprovalMultiplier < 1 ? "less" : "more"} approval`
    )
  }
  if (bonus.bondDebtMultiplier && bonus.bondDebtMultiplier !== 1) {
    items.push(
      `Bonds add ${bonus.bondDebtMultiplier < 1 ? "less" : "more"} debt/GDP (${Math.abs(
        Math.round((1 - bonus.bondDebtMultiplier) * 100)
      )}%)`
    )
  }
  if (bonus.approvalPerDay) {
    items.push(`${formatSigned(bonus.approvalPerDay.toFixed(3))} approval / day`)
  }
  if (bonus.diplomacyDriftMultiplier && bonus.diplomacyDriftMultiplier !== 1) {
    items.push(
      `Opinion drift ×${bonus.diplomacyDriftMultiplier.toFixed(2)}`
    )
  }
  if (
    bonus.treasuryPenaltyMultiplier &&
    bonus.treasuryPenaltyMultiplier !== 1
  ) {
    items.push(
      `Deficit penalty ${bonus.treasuryPenaltyMultiplier < 1 ? "dampened" : "amplified"} ${Math.abs(
        Math.round((1 - bonus.treasuryPenaltyMultiplier) * 100)
      )}%`
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

function formatSigned(n: string): string {
  if (n.startsWith("-")) return n
  return `+${n}`
}

// Quiet the unused import warning in case Minister is needed for typings later.
export type _MinisterTypingShim = Minister
