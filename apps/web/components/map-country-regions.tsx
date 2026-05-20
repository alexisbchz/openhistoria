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

interface CountryProperties {
  ADMIN?: string
  NAME?: string
  ISO_A2?: string
  ISO_A3?: string
}

type CountryFeature = Feature<Geometry, CountryProperties>

interface SelectedCountry {
  name: string
  iso2?: string
  iso3?: string
}

interface CountrySelectionContextValue {
  selected: SelectedCountry | null
  setSelected: (value: SelectedCountry | null) => void
}

const CountrySelectionContext =
  createContext<CountrySelectionContextValue | null>(null)

export function CountrySelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<SelectedCountry | null>(null)
  return (
    <CountrySelectionContext.Provider value={{ selected, setSelected }}>
      {children}
    </CountrySelectionContext.Provider>
  )
}

export function useCountrySelection() {
  const ctx = useContext(CountrySelectionContext)
  if (!ctx) {
    throw new Error(
      "useCountrySelection must be used within CountrySelectionProvider"
    )
  }
  return ctx
}

const baseStyle: PathOptions = {
  fillColor: "#c9a05c",
  fillOpacity: 0,
  color: "#c9a05c",
  weight: 0,
  opacity: 0,
}

const hoverStyle: PathOptions = {
  fillColor: "#e8cf9c",
  fillOpacity: 0.18,
  color: "#e8cf9c",
  weight: 1.5,
  opacity: 0.9,
}

const selectedStyle: PathOptions = {
  fillColor: "#e8cf9c",
  fillOpacity: 0.28,
  color: "#f0d89c",
  weight: 2,
  opacity: 1,
}

export function MapCountryRegions() {
  const [data, setData] = useState<FeatureCollection<
    Geometry,
    CountryProperties
  > | null>(null)
  const { selected, setSelected } = useCountrySelection()

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
    const iso2 = props.ISO_A2 && props.ISO_A2 !== "-99" ? props.ISO_A2 : undefined
    const iso3 = props.ISO_A3 && props.ISO_A3 !== "-99" ? props.ISO_A3 : undefined
    const isSelected = () =>
      selected !== null && selected.name === name
    const pathLayer = layer as L.Path

    layer.on({
      mouseover: () => {
        if (!isSelected()) pathLayer.setStyle(hoverStyle)
      },
      mouseout: () => {
        if (!isSelected()) pathLayer.setStyle(baseStyle)
      },
      click: (event: LeafletMouseEvent) => {
        setSelected({ name, iso2, iso3 })
        event.originalEvent.stopPropagation()
      },
    })
  }

  return (
    <GeoJSON
      data={data}
      style={(feature) => {
        if (!feature) return baseStyle
        const name =
          (feature.properties as CountryProperties).ADMIN ??
          (feature.properties as CountryProperties).NAME
        return selected && selected.name === name ? selectedStyle : baseStyle
      }}
      onEachFeature={onEachFeature}
      key={selected?.name ?? "none"}
    />
  )
}

export function SelectedCountryIndicator() {
  const { selected, setSelected } = useCountrySelection()
  if (!selected) return null

  return (
    <MapControlContainer className="top-2 left-1/2 z-[1000] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-md border bg-background/85 px-3 py-1.5 shadow-lg backdrop-blur-sm">
        <span className="font-sans text-xs font-semibold uppercase tracking-[0.15em] text-primary">
          {selected.name}
        </span>
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
