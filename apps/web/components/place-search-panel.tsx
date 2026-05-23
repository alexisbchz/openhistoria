"use client"

import { useMap } from "@workspace/ui/components/map"
import {
  PlaceAutocomplete,
  type PlaceFeature,
} from "@workspace/ui/components/place-autocomplete"
import { SearchIcon } from "lucide-react"

import { FloatingPanel } from "@/components/floating-panel"
import { useHudState } from "@/components/hud-state"

export function PlaceSearchPanel() {
  const map = useMap()
  const { searchOpen, closeSearch, searchPos, setSearchPos } = useHudState()

  function handleSelect(feature: PlaceFeature) {
    const [lon, lat] = feature.geometry.coordinates as [number, number]
    const targetZoom = Math.max(map.getZoom(), 8)
    map.flyTo({ center: [lon, lat], zoom: targetZoom, duration: 800 })
    closeSearch()
  }

  return (
    <FloatingPanel
      open={searchOpen}
      onClose={closeSearch}
      title="Search a place"
      icon={<SearchIcon className="size-4" />}
      position={searchPos}
      onPositionChange={setSearchPos}
      className="w-80"
    >
      <div className="p-3">
        <PlaceAutocomplete
          placeholder="Type a city, country, address…"
          onPlaceSelect={handleSelect}
          autoFocus
        />
      </div>
    </FloatingPanel>
  )
}
