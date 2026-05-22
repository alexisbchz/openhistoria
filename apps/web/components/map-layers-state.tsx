"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type MapLayerKey = "countries" | "regions" | "cities"

interface MapLayersValue {
  visible: Record<MapLayerKey, boolean>
  toggle: (key: MapLayerKey) => void
  set: (key: MapLayerKey, value: boolean) => void
}

const MapLayersContext = createContext<MapLayersValue | null>(null)

const DEFAULTS: Record<MapLayerKey, boolean> = {
  countries: true,
  regions: true,
  cities: true,
}

export function MapLayersProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState<Record<MapLayerKey, boolean>>(DEFAULTS)

  const toggle = useCallback((key: MapLayerKey) => {
    setVisible((v) => ({ ...v, [key]: !v[key] }))
  }, [])

  const set = useCallback((key: MapLayerKey, value: boolean) => {
    setVisible((v) => ({ ...v, [key]: value }))
  }, [])

  const value = useMemo<MapLayersValue>(
    () => ({ visible, toggle, set }),
    [visible, toggle, set]
  )

  return (
    <MapLayersContext.Provider value={value}>
      {children}
    </MapLayersContext.Provider>
  )
}

export function useMapLayers(): MapLayersValue {
  const ctx = useContext(MapLayersContext)
  if (!ctx) {
    throw new Error("useMapLayers must be used within a MapLayersProvider")
  }
  return ctx
}
