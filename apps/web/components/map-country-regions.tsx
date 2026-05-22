"use client"

import { MapControlContainer } from "@workspace/ui/components/map"
import { Button } from "@workspace/ui/components/button"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { LeafletMouseEvent, PathOptions, Layer } from "leaflet"
import { XIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useState, type ReactNode } from "react"
import { createContext, useContext } from "react"

const GeoJSON = dynamic(
  () => import("react-leaflet").then((mod) => mod.GeoJSON),
  { ssr: false }
)

export type MapSelection =
  | { type: "country"; name: string; iso2?: string; iso3?: string }
  | { type: "region"; name: string; country: string }
  | { type: "city"; name: string; country: string; population?: number }

interface MapSelectionContextValue {
  selected: MapSelection | null
  setSelected: (value: MapSelection | null) => void
}

const MapSelectionContext = createContext<MapSelectionContextValue | null>(null)

export function CountrySelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<MapSelection | null>(null)
  return (
    <MapSelectionContext.Provider value={{ selected, setSelected }}>
      {children}
    </MapSelectionContext.Provider>
  )
}

export function useMapSelection() {
  const ctx = useContext(MapSelectionContext)
  if (!ctx) {
    throw new Error(
      "useMapSelection must be used within CountrySelectionProvider"
    )
  }
  return ctx
}

// Back-compat alias for label component.
export const useCountrySelection = (): {
  selected: { name: string } | null
  setSelected: (value: { name: string; iso2?: string; iso3?: string } | null) => void
} => {
  const { selected, setSelected } = useMapSelection()
  return {
    selected: selected && selected.type === "country" ? selected : null,
    setSelected: (value) =>
      setSelected(value ? { type: "country", ...value } : null),
  }
}

interface CountryProperties {
  ADMIN?: string
  NAME?: string
  ISO_A2?: string
  ISO_A3?: string
  ISO_A2_EH?: string
  ISO_A3_EH?: string
  WB_A2?: string
  WB_A3?: string
  ADM0_A3?: string
}

type CountryFeature = Feature<Geometry, CountryProperties>

function cleanIso(...candidates: Array<string | undefined>): string | undefined {
  for (const c of candidates) {
    if (!c) continue
    const v = c.trim()
    if (!v) continue
    if (v === "-99" || v === "-99.0") continue
    return v
  }
  return undefined
}

const countryBase: PathOptions = {
  fillColor: "#c9a05c",
  fillOpacity: 0,
  color: "#c9a05c",
  weight: 0,
  opacity: 0,
}

const countryHover: PathOptions = {
  fillColor: "#e8cf9c",
  fillOpacity: 0.12,
  color: "#e8cf9c",
  weight: 1,
  opacity: 0.7,
}

const countrySelected: PathOptions = {
  fillColor: "#e8cf9c",
  fillOpacity: 0.22,
  color: "#f0d89c",
  weight: 2,
  opacity: 1,
}

export function MapCountryRegions() {
  const [data, setData] = useState<FeatureCollection<
    Geometry,
    CountryProperties
  > | null>(null)
  const { selected, setSelected } = useMapSelection()

  useEffect(() => {
    let cancelled = false
    fetch("/data/countries-110m.geojson")
      .then((r) => r.json())
      .then((json: FeatureCollection<Geometry, CountryProperties>) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const onEachFeature = (feature: CountryFeature, layer: Layer) => {
    const props = feature.properties ?? {}
    const name = props.ADMIN ?? props.NAME ?? "Unknown"
    const iso2 = cleanIso(props.ISO_A2, props.ISO_A2_EH, props.WB_A2)
    const iso3 = cleanIso(
      props.ISO_A3,
      props.ISO_A3_EH,
      props.WB_A3,
      props.ADM0_A3
    )
    const isSelected = () =>
      selected !== null &&
      selected.type === "country" &&
      selected.name === name
    const pathLayer = layer as L.Path

    layer.on({
      mouseover: () => {
        if (!isSelected()) pathLayer.setStyle(countryHover)
      },
      mouseout: () => {
        if (!isSelected()) pathLayer.setStyle(countryBase)
      },
      click: (event: LeafletMouseEvent) => {
        setSelected({ type: "country", name, iso2, iso3 })
        event.originalEvent.stopPropagation()
      },
    })
  }

  return (
    <GeoJSON
      data={data}
      style={(feature) => {
        if (!feature) return countryBase
        const name =
          (feature.properties as CountryProperties).ADMIN ??
          (feature.properties as CountryProperties).NAME
        return selected &&
          selected.type === "country" &&
          selected.name === name
          ? countrySelected
          : countryBase
      }}
      onEachFeature={onEachFeature}
      key={selected?.type === "country" ? selected.name : "none"}
    />
  )
}

function selectionLabel(selected: MapSelection): {
  primary: string
  secondary?: string
} {
  if (selected.type === "country") return { primary: selected.name }
  if (selected.type === "region")
    return { primary: selected.name, secondary: selected.country }
  return {
    primary: selected.name,
    secondary: selected.population
      ? `${selected.country} · ${compactInt(selected.population)} pop`
      : selected.country,
  }
}

function compactInt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return `${n}`
}

export function SelectedCountryIndicator() {
  const { selected, setSelected } = useMapSelection()
  if (!selected) return null

  const { primary, secondary } = selectionLabel(selected)

  return (
    <MapControlContainer className="top-2 left-1/2 z-[1000] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-md border bg-background/85 px-3 py-1.5 shadow-lg backdrop-blur-sm">
        <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
          {selected.type}
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
            {primary}
          </span>
          {secondary && (
            <span className="font-sans text-[10px] text-muted-foreground">
              {secondary}
            </span>
          )}
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-6"
          onClick={() => setSelected(null)}
          aria-label="Clear selection"
          title="Clear selection"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
    </MapControlContainer>
  )
}
