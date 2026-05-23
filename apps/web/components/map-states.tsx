"use client"

import { useMap, useMapEvents } from "@workspace/ui/components/map"
import { useEffect, useRef, useState } from "react"

import {
  ADM1_FILL_LAYER,
  ADM1_STROKE_LAYER,
  ADM1_SOURCE_LAYER,
  GADM_SOURCE_ID,
} from "@/components/map-gadm-source"
import {
  useGadmSource,
  useMapSelection,
} from "@/components/map-country-regions"

const MIN_ZOOM_VISIBLE = 4

export function MapStates() {
  const map = useMap()
  const sourceReady = useGadmSource()
  const { selected, setSelected } = useMapSelection()
  const [zoom, setZoom] = useState(() => map.getZoom())
  const [layersReady, setLayersReady] = useState(false)
  const hoveredIdRef = useRef<string | number | null>(null)

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  })

  const enabled = sourceReady && zoom >= MIN_ZOOM_VISIBLE

  useEffect(() => {
    if (!enabled) return

    if (!map.getLayer(ADM1_FILL_LAYER)) {
      map.addLayer({
        id: ADM1_FILL_LAYER,
        type: "fill",
        source: GADM_SOURCE_ID,
        "source-layer": ADM1_SOURCE_LAYER,
        minzoom: MIN_ZOOM_VISIBLE,
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#f0d89c",
            ["boolean", ["feature-state", "hover"], false],
            "#e8cf9c",
            "#e8cf9c",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.35,
            ["boolean", ["feature-state", "hover"], false],
            0.2,
            0,
          ],
        },
      })
    }
    if (!map.getLayer(ADM1_STROKE_LAYER)) {
      map.addLayer({
        id: ADM1_STROKE_LAYER,
        type: "line",
        source: GADM_SOURCE_ID,
        "source-layer": ADM1_SOURCE_LAYER,
        minzoom: MIN_ZOOM_VISIBLE,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#f6df9a",
            ["boolean", ["feature-state", "hover"], false],
            "#f4dca8",
            "#e8cf9c",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2.5,
            ["boolean", ["feature-state", "hover"], false],
            2,
            1,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            1,
            ["boolean", ["feature-state", "hover"], false],
            1,
            0.55,
          ],
          "line-dasharray": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            ["literal", [1]],
            ["boolean", ["feature-state", "hover"], false],
            ["literal", [1]],
            ["literal", [4, 4]],
          ],
        },
      })
    }
    setLayersReady(true)

    return () => {
      if (map.getLayer(ADM1_STROKE_LAYER)) map.removeLayer(ADM1_STROKE_LAYER)
      if (map.getLayer(ADM1_FILL_LAYER)) map.removeLayer(ADM1_FILL_LAYER)
      setLayersReady(false)
    }
  }, [map, enabled])

  useEffect(() => {
    if (!layersReady) return

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [ADM1_FILL_LAYER],
      })
      const feature = features[0]
      if (!feature) return
      const props = feature.properties as Record<string, unknown>
      const name =
        (props.NAME_1 as string | undefined) ??
        (props.VARNAME_1 as string | undefined) ??
        "Unknown"
      const country =
        (props.NAME_0 as string | undefined) ??
        (props.COUNTRY as string | undefined) ??
        "Unknown"
      const gid = props.GID_1 as string | undefined
      setSelected({ type: "region", name, country, gid })
    }

    const handleMouseMove = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (!feature || feature.id == null) return
      if (hoveredIdRef.current === feature.id) return
      if (hoveredIdRef.current != null) {
        map.setFeatureState(
          {
            source: GADM_SOURCE_ID,
            sourceLayer: ADM1_SOURCE_LAYER,
            id: hoveredIdRef.current,
          },
          { hover: false }
        )
      }
      map.setFeatureState(
        {
          source: GADM_SOURCE_ID,
          sourceLayer: ADM1_SOURCE_LAYER,
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
            sourceLayer: ADM1_SOURCE_LAYER,
            id: hoveredIdRef.current,
          },
          { hover: false }
        )
        hoveredIdRef.current = null
      }
      map.getCanvas().style.cursor = ""
    }

    map.on("click", ADM1_FILL_LAYER, handleClick)
    map.on("mousemove", ADM1_FILL_LAYER, handleMouseMove)
    map.on("mouseleave", ADM1_FILL_LAYER, handleMouseLeave)

    return () => {
      map.off("click", ADM1_FILL_LAYER, handleClick)
      map.off("mousemove", ADM1_FILL_LAYER, handleMouseMove)
      map.off("mouseleave", ADM1_FILL_LAYER, handleMouseLeave)
    }
  }, [map, layersReady, setSelected])

  useEffect(() => {
    if (!layersReady) return
    if (selected?.type !== "region" || !selected.gid) return
    const id = selected.gid
    map.setFeatureState(
      { source: GADM_SOURCE_ID, sourceLayer: ADM1_SOURCE_LAYER, id },
      { selected: true }
    )
    return () => {
      map.setFeatureState(
        { source: GADM_SOURCE_ID, sourceLayer: ADM1_SOURCE_LAYER, id },
        { selected: false }
      )
    }
  }, [map, layersReady, selected])

  return null
}
