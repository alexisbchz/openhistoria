"use client"

import { MapMarker, useMap, useMapEvents } from "@workspace/ui/components/map"
import type { Feature, FeatureCollection, Point } from "geojson"
import { useEffect, useState } from "react"

import { useMapSelection } from "@/components/map-country-regions"

interface CityProperties {
  NAME?: string
  NAME_EN?: string
  ADM0NAME?: string
  SCALERANK?: number
  POP_MAX?: number
  ADM0CAP?: number
  MEGACITY?: number
  WORLDCITY?: number
}

type CityFeature = Feature<Point, CityProperties>

// Cities have SCALERANK 0–9 in our dataset, derived from population.
// 0 = megacity (≥8M), 4 = ≥500k, 6 = ≥100k, 7 = ≥50k (e.g. Calais), 9 = ≥15k.
// `maxDotRank` decides which cities draw a marker dot;
// `maxLabelRank` is stricter so we don't paint thousands of overlapping names.
// Capitals are always labeled regardless of zoom.
function maxDotRankForZoom(zoom: number): number {
  if (zoom <= 2) return 0 // ≥ 8M
  if (zoom <= 3) return 2 // ≥ 2M
  if (zoom <= 4) return 4 // ≥ 500k
  if (zoom <= 5) return 6 // ≥ 100k (Northern French regional capitals)
  if (zoom <= 6) return 7 // ≥ 50k (Calais)
  if (zoom <= 7) return 8 // ≥ 25k
  return 9 // ≥ 15k
}

function maxLabelRankForZoom(zoom: number): number {
  if (zoom <= 4) return 0 // ≥ 8M
  if (zoom <= 5) return 1 // ≥ 4M
  if (zoom <= 6) return 2 // ≥ 2M
  if (zoom <= 7) return 3 // ≥ 1M
  if (zoom <= 8) return 4 // ≥ 500k
  if (zoom <= 9) return 5 // ≥ 250k
  if (zoom <= 10) return 6 // ≥ 100k
  if (zoom <= 11) return 7 // ≥ 50k (Calais labeled)
  if (zoom <= 12) return 8 // ≥ 25k
  return 9
}

function fontSizeForZoom(zoom: number): number {
  if (zoom <= 4) return 10
  if (zoom <= 6) return 11
  return 12
}

interface Viewport {
  south: number
  north: number
  west: number
  east: number
}

function readViewport(map: maplibregl.Map): Viewport {
  const b = map.getBounds()
  return {
    south: b.getSouth(),
    north: b.getNorth(),
    west: b.getWest(),
    east: b.getEast(),
  }
}

export function MapCities() {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [viewport, setViewport] = useState<Viewport>(() => readViewport(map))
  const [data, setData] = useState<FeatureCollection<
    Point,
    CityProperties
  > | null>(null)
  const { selected, setSelected } = useMapSelection()

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom())
      setViewport(readViewport(map))
    },
    moveend: () => setViewport(readViewport(map)),
  })

  useEffect(() => {
    let cancelled = false
    fetch("/data/cities-15k.geojson")
      .then((r) => r.json())
      .then((json: FeatureCollection<Point, CityProperties>) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const maxDotRank = maxDotRankForZoom(zoom)
  const maxLabelRank = maxLabelRankForZoom(zoom)
  const fontSize = fontSizeForZoom(zoom)
  // At higher zooms our dataset is large; clip to viewport so we don't try to
  // render thousands of markers offscreen.
  const clipToViewport = zoom >= 4
  const { south, north, west, east } = viewport
  const wrapsAntimeridian = west > east
  const visible = data.features.filter((f: CityFeature) => {
    const r = f.properties?.SCALERANK ?? 99
    if (r > maxDotRank) return false
    if (!clipToViewport) return true
    const [lon, lat] = f.geometry.coordinates as [number, number]
    if (lat < south || lat > north) return false
    if (wrapsAntimeridian) {
      return lon >= west || lon <= east
    }
    return lon >= west && lon <= east
  })

  return (
    <>
      {visible.map((feature) => {
        const props = feature.properties ?? {}
        const name = props.NAME_EN ?? props.NAME ?? "Unknown"
        const country = props.ADM0NAME ?? "Unknown"
        const pop = props.POP_MAX
        const isCapital = props.ADM0CAP === 1
        const rank = props.SCALERANK ?? 99
        const showLabel = isCapital || rank <= maxLabelRank
        const coords = feature.geometry.coordinates as [number, number]
        const position: [number, number] = [coords[1], coords[0]]
        const isSelected =
          selected?.type === "city" &&
          selected.name === name &&
          selected.country === country
        const dotSize = isCapital ? 5 : 4

        return (
          <MapMarker
            key={`${country}/${name}/${coords[0]},${coords[1]}`}
            position={position}
            eventHandlers={{
              click: () =>
                setSelected({
                  type: "city",
                  name,
                  country,
                  population: pop,
                }),
            }}
            icon={
              <div
                className="cursor-pointer transition-transform hover:scale-110"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                    borderRadius: "50%",
                    background: isSelected
                      ? "oklch(0.95 0.12 85)"
                      : isCapital
                        ? "oklch(0.85 0.13 80)"
                        : "oklch(0.92 0.05 85)",
                    boxShadow: isCapital
                      ? "0 0 0 1.5px rgba(0,0,0,0.6), 0 0 6px rgba(232,207,156,0.6)"
                      : "0 0 0 1px rgba(0,0,0,0.7)",
                  }}
                />
                {showLabel && (
                  <span
                    className="whitespace-nowrap font-sans"
                    style={{
                      fontSize: `${fontSize}px`,
                      fontWeight: isCapital ? 600 : 500,
                      color: isSelected
                        ? "oklch(0.97 0.06 85)"
                        : isCapital
                          ? "oklch(0.94 0.05 85)"
                          : "oklch(0.92 0.02 85)",
                      textShadow:
                        "0 0 2px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9)",
                      letterSpacing: isCapital ? "0.03em" : "0",
                    }}
                  >
                    {name}
                  </span>
                )}
              </div>
            }
          />
        )
      })}
    </>
  )
}
