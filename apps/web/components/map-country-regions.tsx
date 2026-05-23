"use client"

import {
  MapControlContainer,
  useMap,
} from "@workspace/ui/components/map"
import { Button } from "@workspace/ui/components/button"
import { XIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { createContext, useContext } from "react"

import {
  ADM0_FILL_LAYER,
  ADM0_STROKE_LAYER,
  ADM0_SOURCE_LAYER,
  GADM_SOURCE_ID,
  gadmSourceSpec,
} from "@/components/map-gadm-source"

export type MapSelection =
  | { type: "country"; name: string; iso2?: string; iso3?: string }
  | { type: "region"; name: string; country: string; gid?: string }
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

/**
 * Add the shared GADM PMTiles source to the map exactly once, no matter how
 * many layers reference it. Returns true once the source is registered so
 * dependent layers know it's safe to mount.
 */
export function useGadmSource(): boolean {
  const map = useMap()
  const [ready, setReady] = useState(() => Boolean(map.getSource(GADM_SOURCE_ID)))

  useEffect(() => {
    if (!map.getSource(GADM_SOURCE_ID)) {
      map.addSource(GADM_SOURCE_ID, gadmSourceSpec)
    }
    setReady(true)
    // The source is shared across components; leave it in place on unmount.
  }, [map])

  return ready
}

export function MapCountryRegions() {
  const map = useMap()
  const { selected, setSelected } = useMapSelection()
  const sourceReady = useGadmSource()
  const [layersReady, setLayersReady] = useState(false)
  const hoveredIdRef = useRef<string | number | null>(null)

  useEffect(() => {
    if (!sourceReady) return

    if (!map.getLayer(ADM0_FILL_LAYER)) {
      map.addLayer({
        id: ADM0_FILL_LAYER,
        type: "fill",
        source: GADM_SOURCE_ID,
        "source-layer": ADM0_SOURCE_LAYER,
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#e8cf9c",
            ["boolean", ["feature-state", "hover"], false],
            "#e8cf9c",
            "#c9a05c",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.22,
            ["boolean", ["feature-state", "hover"], false],
            0.12,
            0,
          ],
        },
      })
    }
    if (!map.getLayer(ADM0_STROKE_LAYER)) {
      map.addLayer({
        id: ADM0_STROKE_LAYER,
        type: "line",
        source: GADM_SOURCE_ID,
        "source-layer": ADM0_SOURCE_LAYER,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#f0d89c",
            "#e8cf9c",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2,
            ["boolean", ["feature-state", "hover"], false],
            1,
            0,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            1,
            ["boolean", ["feature-state", "hover"], false],
            0.7,
            0,
          ],
        },
      })
    }
    setLayersReady(true)

    return () => {
      if (map.getLayer(ADM0_STROKE_LAYER)) map.removeLayer(ADM0_STROKE_LAYER)
      if (map.getLayer(ADM0_FILL_LAYER)) map.removeLayer(ADM0_FILL_LAYER)
      setLayersReady(false)
    }
  }, [map, sourceReady])

  useEffect(() => {
    if (!layersReady) return

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [ADM0_FILL_LAYER],
      })
      const feature = features[0]
      if (!feature) return
      const props = feature.properties as Record<string, unknown>
      const name =
        (props.NAME_0 as string | undefined) ??
        (props.COUNTRY as string | undefined) ??
        "Unknown"
      const iso3 = props.GID_0 as string | undefined
      setSelected({ type: "country", name, iso3 })
    }

    const handleMouseMove = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (!feature || feature.id == null) return
      if (hoveredIdRef.current === feature.id) return
      if (hoveredIdRef.current != null) {
        map.setFeatureState(
          {
            source: GADM_SOURCE_ID,
            sourceLayer: ADM0_SOURCE_LAYER,
            id: hoveredIdRef.current,
          },
          { hover: false }
        )
      }
      map.setFeatureState(
        {
          source: GADM_SOURCE_ID,
          sourceLayer: ADM0_SOURCE_LAYER,
          id: feature.id,
        },
        { hover: true }
      )
      hoveredIdRef.current = feature.id
      map.getCanvas().style.cursor = "pointer"
    }

    const handleMouseLeave = () => {
      if (hoveredIdRef.current != null) {
        map.setFeatureState(
          {
            source: GADM_SOURCE_ID,
            sourceLayer: ADM0_SOURCE_LAYER,
            id: hoveredIdRef.current,
          },
          { hover: false }
        )
        hoveredIdRef.current = null
      }
      map.getCanvas().style.cursor = ""
    }

    map.on("click", ADM0_FILL_LAYER, handleClick)
    map.on("mousemove", ADM0_FILL_LAYER, handleMouseMove)
    map.on("mouseleave", ADM0_FILL_LAYER, handleMouseLeave)

    return () => {
      map.off("click", ADM0_FILL_LAYER, handleClick)
      map.off("mousemove", ADM0_FILL_LAYER, handleMouseMove)
      map.off("mouseleave", ADM0_FILL_LAYER, handleMouseLeave)
    }
  }, [map, layersReady, setSelected])

  // Reflect the current selection in feature-state so the polygon highlights.
  useEffect(() => {
    if (!layersReady) return
    if (selected?.type !== "country" || !selected.iso3) return
    const id = selected.iso3
    map.setFeatureState(
      { source: GADM_SOURCE_ID, sourceLayer: ADM0_SOURCE_LAYER, id },
      { selected: true }
    )
    return () => {
      map.setFeatureState(
        { source: GADM_SOURCE_ID, sourceLayer: ADM0_SOURCE_LAYER, id },
        { selected: false }
      )
    }
  }, [map, layersReady, selected])

  return null
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
