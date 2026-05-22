"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import Image from "next/image"

import { useHudState } from "@/components/hud-state"

export function SearchLocationButton() {
  const { toggleSearch } = useHudState()
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label="Search a place"
        onClick={toggleSearch}
        className="group size-12 cursor-pointer rounded-md transition-transform hover:scale-105 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src="/icons/search-location.png"
          alt=""
          width={200}
          height={200}
          className="size-full object-contain drop-shadow-md"
        />
      </TooltipTrigger>
      <TooltipContent side="right">Search a place</TooltipContent>
    </Tooltip>
  )
}
