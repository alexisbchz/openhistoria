"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import Image from "next/image"

export function PresidentialActionsButton({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label="Presidential actions"
        onClick={onClick}
        className="group absolute bottom-2 left-full ml-2 size-12 cursor-pointer rounded-md transition-transform hover:scale-105 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src="/icons/presidential-actions.png"
          alt=""
          width={200}
          height={200}
          className="size-full object-contain drop-shadow-md"
        />
      </TooltipTrigger>
      <TooltipContent side="right">
        Presidential decisions (D)
      </TooltipContent>
    </Tooltip>
  )
}
