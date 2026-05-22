"use client"

import * as Flags from "country-flag-icons/react/3x2"
import { hasFlag } from "country-flag-icons"
import { GlobeIcon } from "lucide-react"
import type { ComponentType } from "react"

type FlagsModule = typeof Flags
type FlagKey = keyof FlagsModule

type FlagComponent = ComponentType<{ title?: string; className?: string }>

interface CountryFlagProps {
  code?: string | null
  title?: string
  className?: string
}

export function CountryFlag({ code, title, className }: CountryFlagProps) {
  const upper = code?.toUpperCase()
  if (!upper || !hasFlag(upper)) {
    return <GlobeIcon className={className} />
  }
  const Flag = Flags[upper as FlagKey] as FlagComponent | undefined
  if (!Flag) {
    return <GlobeIcon className={className} />
  }
  return <Flag title={title} className={className} />
}
