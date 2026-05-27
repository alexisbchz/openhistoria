"use client"

import { FR } from "country-flag-icons/react/3x2"
import Image from "next/image"
import type { ReactNode } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import { BriefingToasts } from "@/components/briefing-toasts"
import { CountryInfoPanel } from "@/components/country-info-panel"
import { CountryStatsPanel } from "@/components/country-stats-panel"
import { DebugOverlay } from "@/components/debug-overlay"
import { DecisionsPanel } from "@/components/decisions-panel"
import { PlaceSearchPanel } from "@/components/place-search-panel"
import { EventDialog } from "@/components/event-dialog"
import { GameOverDialog } from "@/components/game-over-dialog"
import { HudStateProvider, useHudState } from "@/components/hud-state"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"
import { PauseMenu } from "@/components/pause-menu"
import { PresidentialActionsButton } from "@/components/presidential-actions-button"
import { SearchLocationButton } from "@/components/search-location-button"
import { WelcomeDialog } from "@/components/welcome-dialog"

interface HomeHudProps {
  topLeft?: ReactNode
  topRight?: ReactNode
  bottomLeft?: ReactNode
  bottomRight?: ReactNode
}

export function HomeHud({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
}: HomeHudProps) {
  return (
    <HudStateProvider>
      <HudShell
        topLeft={topLeft}
        topRight={topRight}
        bottomLeft={bottomLeft ?? <HomeHudCharacter />}
        bottomRight={bottomRight}
      />
    </HudStateProvider>
  )
}

function HudShell({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
}: HomeHudProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1100]">
      {topLeft && (
        <div className="pointer-events-auto absolute top-0 left-0">
          {topLeft}
        </div>
      )}
      {topRight && (
        <div className="pointer-events-auto absolute top-0 right-0">
          {topRight}
        </div>
      )}
      {bottomLeft && (
        <div className="pointer-events-auto absolute bottom-0 left-0">
          {bottomLeft}
        </div>
      )}
      {bottomRight && (
        <div className="pointer-events-auto absolute right-0 bottom-0">
          {bottomRight}
        </div>
      )}
      <KeyboardShortcuts />
      <div className="pointer-events-auto absolute top-2 left-2 z-[1001]">
        <SearchLocationButton />
      </div>
      <CountryStatsPanel />
      <CountryInfoPanel />
      <PlaceSearchPanel />
      <DecisionsPanel />
      <EventDialog />
      <GameOverDialog />
      <WelcomeDialog />
      <PauseMenu />
      <BriefingToasts />
      <DebugOverlay />
    </div>
  )
}

function HomeHudCharacter() {
  const { toggleStats, toggleDecisions } = useHudState()
  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label="Toggle country stats"
          onClick={toggleStats}
          className="block cursor-pointer transition-transform hover:scale-[1.02] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/characters/macron.png"
            alt="Macron"
            width={256}
            height={384}
            className="h-64 w-auto"
            priority
          />
        </TooltipTrigger>
        <TooltipContent side="top">Country stats (S)</TooltipContent>
      </Tooltip>
      <FR
        title="France"
        className="pointer-events-none absolute bottom-2 left-2 h-8 w-auto rounded-[2px] shadow-md ring-1 ring-black/20"
      />
      <PresidentialActionsButton onClick={toggleDecisions} />
    </div>
  )
}
