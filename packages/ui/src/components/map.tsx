"use client"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  LoaderCircleIcon,
  MaximizeIcon,
  MinimizeIcon,
  MinusIcon,
  NavigationIcon,
  PlusIcon,
} from "lucide-react"
import maplibregl, {
  type Map as MapLibreMap,
  type MapEventType,
  type MapLayerEventType,
  type LngLatLike,
  type StyleSpecification,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { Protocol } from "pmtiles"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

export type LatLng = [number, number] // [lat, lng] — kept for parity with leaflet callers

let pmtilesRegistered = false
function ensurePMTilesProtocol() {
  if (pmtilesRegistered) return
  if (typeof window === "undefined") return
  const protocol = new Protocol()
  maplibregl.addProtocol("pmtiles", protocol.tile)
  pmtilesRegistered = true
}

const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  glyphs:
    "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0b1220" },
    },
  ],
}

interface MapContextValue {
  map: MapLibreMap
  container: HTMLDivElement
}

const MapContext = createContext<MapContextValue | null>(null)

export function useMap(): MapLibreMap {
  const ctx = useContext(MapContext)
  if (!ctx) {
    throw new Error("useMap must be used inside <Map>")
  }
  return ctx.map
}

function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext)
  if (!ctx) {
    throw new Error("Map primitives must be used inside <Map>")
  }
  return ctx
}

type EventHandlers = Partial<{
  [K in keyof MapEventType]: (event: MapEventType[K]) => void
}>

export function useMapEvents(handlers: EventHandlers): MapLibreMap {
  const map = useMap()
  // Re-bind every render — handlers are typically inline. Cleanup is cheap.
  useEffect(() => {
    const entries = Object.entries(handlers) as Array<
      [keyof MapEventType, (event: unknown) => void]
    >
    for (const [event, handler] of entries) {
      map.on(event, handler as never)
    }
    return () => {
      for (const [event, handler] of entries) {
        map.off(event, handler as never)
      }
    }
  })
  return map
}

interface MapProps {
  center: LatLng
  zoom?: number
  minZoom?: number
  maxZoom?: number
  className?: string
  children?: ReactNode
}

export function Map({
  center,
  zoom = 3,
  minZoom,
  maxZoom = 18,
  className,
  children,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ctx, setCtx] = useState<MapContextValue | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    ensurePMTilesProtocol()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: EMPTY_STYLE,
      center: [center[1], center[0]],
      zoom,
      minZoom,
      maxZoom,
      attributionControl: false,
      hash: false,
    })

    map.on("load", () => {
      setCtx({ map, container: containerRef.current! })
    })

    return () => {
      setCtx(null)
      map.remove()
    }
    // Initial position/zoom — don't re-create the map when these change later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
    >
      {ctx && (
        <MapContext.Provider value={ctx}>{children}</MapContext.Provider>
      )}
    </div>
  )
}

// ── Raster basemap ───────────────────────────────────────────────────────────

interface MapTileLayerProps {
  url: string
  tileSize?: number
  maxNativeZoom?: number
  attribution?: string
  brightness?: number // 0..1, caps output brightness
  saturation?: number // -1..1
  contrast?: number // -1..1
  hueRotate?: number // degrees
}

export function MapTileLayer({
  url,
  tileSize = 256,
  maxNativeZoom = 19,
  brightness,
  saturation,
  contrast,
  hueRotate,
}: MapTileLayerProps) {
  const map = useMap()
  // Stable id so the cleanup removes the same source/layer it added.
  const id = useMemo(() => `raster-${cryptoRandomId()}`, [])

  useEffect(() => {
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: "raster",
        tiles: [url],
        tileSize,
        maxzoom: maxNativeZoom,
      })
    }
    if (!map.getLayer(id)) {
      // Always insert raster basemap at the bottom of the layer stack so
      // vector overlays render above it.
      const firstLayer = map.getStyle().layers?.find((l) => l.id !== "background")
      const paint: Record<string, number> = {}
      if (brightness !== undefined) paint["raster-brightness-max"] = brightness
      if (saturation !== undefined) paint["raster-saturation"] = saturation
      if (contrast !== undefined) paint["raster-contrast"] = contrast
      if (hueRotate !== undefined) paint["raster-hue-rotate"] = hueRotate
      map.addLayer(
        {
          id,
          type: "raster",
          source: id,
          paint: paint as Record<string, unknown>,
        },
        firstLayer?.id
      )
    }
    return () => {
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url])

  return null
}

// ── Markers ──────────────────────────────────────────────────────────────────

interface MarkerContextValue {
  marker: maplibregl.Marker
  element: HTMLDivElement
  position: LatLng
}

const MarkerContext = createContext<MarkerContextValue | null>(null)

function useMarkerContext(): MarkerContextValue {
  const ctx = useContext(MarkerContext)
  if (!ctx) {
    throw new Error("MapPopup/MapTooltip must be inside <MapMarker>")
  }
  return ctx
}

interface MapMarkerProps {
  position: LatLng
  icon?: ReactNode
  anchor?: maplibregl.PositionAnchor
  className?: string
  /**
   * Stacking order against other markers. Maplibre stacks markers purely by
   * DOM insertion order, which means re-mounted markers (e.g. cities updating
   * on every pan) end up on top of stable ones. Set a higher value to keep a
   * marker on top regardless of insertion order.
   */
  zIndex?: number
  /** Optional click handler on the marker element. */
  eventHandlers?: { click?: (event: MouseEvent) => void }
  children?: ReactNode
  // Accepted for back-compat with the leaflet API — ignored. Position the
  // icon via CSS in the JSX you pass to `icon`.
  iconAnchor?: [number, number]
  keyboard?: boolean
}

export function MapMarker({
  position,
  icon,
  anchor = "center",
  className,
  zIndex,
  eventHandlers,
  children,
}: MapMarkerProps) {
  const map = useMap()
  const [element] = useState<HTMLDivElement>(() => {
    const div = document.createElement("div")
    return div
  })
  const [marker, setMarker] = useState<maplibregl.Marker | null>(null)

  // Click handler kept in a ref so we don't tear down the listener on every
  // render.
  const clickHandlerRef = useRef(eventHandlers?.click)
  clickHandlerRef.current = eventHandlers?.click

  useEffect(() => {
    if (className) element.className = className
  }, [className, element])

  useEffect(() => {
    if (zIndex == null) {
      element.style.zIndex = ""
    } else {
      element.style.zIndex = String(zIndex)
    }
  }, [zIndex, element])

  useEffect(() => {
    const m = new maplibregl.Marker({ element, anchor })
      .setLngLat([position[1], position[0]])
      .addTo(map)
    setMarker(m)

    const handleClick = (event: MouseEvent) => {
      // Stop the click from bubbling to the map canvas (which would clear
      // selection on background clicks).
      event.stopPropagation()
      clickHandlerRef.current?.(event)
    }
    element.addEventListener("click", handleClick)

    return () => {
      element.removeEventListener("click", handleClick)
      m.remove()
      setMarker(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, element, anchor])

  useEffect(() => {
    marker?.setLngLat([position[1], position[0]])
  }, [marker, position])

  const markerCtx = useMemo<MarkerContextValue | null>(
    () => (marker ? { marker, element, position } : null),
    [marker, element, position]
  )

  return (
    <>
      {createPortal(icon, element)}
      {markerCtx && (
        <MarkerContext.Provider value={markerCtx}>
          {children}
        </MarkerContext.Provider>
      )}
    </>
  )
}

// ── Popup ────────────────────────────────────────────────────────────────────

interface MapPopupProps {
  className?: string
  offset?: number
  children?: ReactNode
}

export function MapPopup({ className, offset = 24, children }: MapPopupProps) {
  const map = useMap()
  const { marker, element: markerElement } = useMarkerContext()
  const [content] = useState<HTMLDivElement>(() =>
    document.createElement("div")
  )

  useEffect(() => {
    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset,
      className: cn(
        "z-50 [&_.maplibregl-popup-content]:rounded-md [&_.maplibregl-popup-content]:border [&_.maplibregl-popup-content]:bg-popover [&_.maplibregl-popup-content]:p-4 [&_.maplibregl-popup-content]:text-popover-foreground [&_.maplibregl-popup-content]:shadow-md",
        className
      ),
    }).setDOMContent(content)

    marker.setPopup(popup)

    return () => {
      // Detach from marker; popup.remove is called by setPopup(undefined).
      marker.setPopup(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marker, map, offset])

  // Suppress immediate map click (which would re-open or fight the popup) when
  // user clicks the marker to open it; maplibre handles open/close on the
  // marker element already, so nothing extra needed here.
  void markerElement

  return createPortal(<div className={className}>{children}</div>, content)
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

interface MapTooltipProps {
  className?: string
  offset?: number
  children?: ReactNode
}

export function MapTooltip({
  className,
  offset = 18,
  children,
}: MapTooltipProps) {
  const map = useMap()
  const { marker, element: markerElement, position } = useMarkerContext()
  const [content] = useState<HTMLDivElement>(() =>
    document.createElement("div")
  )

  useEffect(() => {
    const tooltip = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      closeOnMove: false,
      offset,
      className:
        "pointer-events-none z-40 [&_.maplibregl-popup-content]:rounded-md [&_.maplibregl-popup-content]:border [&_.maplibregl-popup-content]:bg-popover [&_.maplibregl-popup-content]:px-2 [&_.maplibregl-popup-content]:py-1 [&_.maplibregl-popup-content]:text-xs [&_.maplibregl-popup-content]:text-popover-foreground [&_.maplibregl-popup-content]:shadow",
    }).setDOMContent(content)

    let isOpen = false
    const show = () => {
      if (isOpen) return
      tooltip.setLngLat([position[1], position[0]]).addTo(map)
      isOpen = true
    }
    const hide = () => {
      if (!isOpen) return
      tooltip.remove()
      isOpen = false
    }

    markerElement.addEventListener("mouseenter", show)
    markerElement.addEventListener("mouseleave", hide)

    return () => {
      markerElement.removeEventListener("mouseenter", show)
      markerElement.removeEventListener("mouseleave", hide)
      tooltip.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, marker, markerElement, position[0], position[1]])

  return createPortal(<div className={className}>{children}</div>, content)
}

// ── Controls ─────────────────────────────────────────────────────────────────

export function MapControlContainer({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = (event: Event) => event.stopPropagation()
    el.addEventListener("mousedown", stop)
    el.addEventListener("touchstart", stop, { passive: true })
    el.addEventListener("wheel", stop, { passive: true })
    el.addEventListener("dblclick", stop)
    el.addEventListener("contextmenu", stop)
    return () => {
      el.removeEventListener("mousedown", stop)
      el.removeEventListener("touchstart", stop)
      el.removeEventListener("wheel", stop)
      el.removeEventListener("dblclick", stop)
      el.removeEventListener("contextmenu", stop)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={cn("absolute z-[1000] size-fit cursor-default", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function MapZoomControl({
  position = "top-1 left-1",
  className,
  ...props
}: React.ComponentProps<"div"> & { position?: string }) {
  const map = useMap()
  const [zoomLevel, setZoomLevel] = useState(map.getZoom())

  useMapEvents({
    zoomend: () => setZoomLevel(map.getZoom()),
  })

  return (
    <MapControlContainer className={cn(position, className)}>
      <ButtonGroup orientation="vertical" aria-label="Zoom controls" {...props}>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label="Zoom in"
          title="Zoom in"
          className="border"
          disabled={zoomLevel >= (map.getMaxZoom?.() ?? 22)}
          onClick={() => map.zoomIn()}
        >
          <PlusIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label="Zoom out"
          title="Zoom out"
          className="border"
          disabled={zoomLevel <= (map.getMinZoom?.() ?? 0)}
          onClick={() => map.zoomOut()}
        >
          <MinusIcon />
        </Button>
      </ButtonGroup>
    </MapControlContainer>
  )
}

export function MapFullscreenControl({
  position = "top-1 right-1",
  className,
  ...props
}: React.ComponentProps<"button"> & { position?: string }) {
  const map = useMap()
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const container = map.getContainer()
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === container)
    }
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [map])

  function toggle() {
    const target = map.getContainer().parentElement ?? map.getContainer()
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void target.requestFullscreen()
    }
  }

  return (
    <MapControlContainer className={cn(position, className)}>
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        onClick={toggle}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="border"
        {...props}
      >
        {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
      </Button>
    </MapControlContainer>
  )
}

export function MapLocateControl({
  position = "right-1 bottom-1",
  className,
  onLocationFound,
  onLocationError,
  ...props
}: React.ComponentProps<"button"> & {
  position?: string
  onLocationFound?: (coords: GeolocationCoordinates) => void
  onLocationError?: (error: GeolocationPositionError) => void
}) {
  const map = useMap()
  const [isLocating, setIsLocating] = useState(false)
  const [tracking, setTracking] = useState(false)

  function locate() {
    if (!navigator.geolocation) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false)
        setTracking(true)
        const { latitude, longitude } = pos.coords
        map.flyTo({
          center: [longitude, latitude] satisfies LngLatLike,
          zoom: Math.max(map.getZoom(), 10),
        })
        onLocationFound?.(pos.coords)
      },
      (err) => {
        setIsLocating(false)
        setTracking(false)
        onLocationError?.(err)
      }
    )
  }

  return (
    <MapControlContainer className={cn(position, className)}>
      <Button
        type="button"
        size="icon-sm"
        variant={tracking ? "default" : "secondary"}
        onClick={locate}
        disabled={isLocating}
        title={isLocating ? "Locating..." : "Locate me"}
        aria-label={isLocating ? "Locating..." : "Locate me"}
        className="border"
        {...props}
      >
        {isLocating ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : (
          <NavigationIcon />
        )}
      </Button>
    </MapControlContainer>
  )
}

// ── Layer-level event hook ───────────────────────────────────────────────────

/**
 * Subscribe to maplibre style-layer events (click, mouseenter, mouseleave,
 * mousemove). Use this for hover/click on vector polygon layers.
 */
export function useMapLayerEvent<K extends keyof MapLayerEventType>(
  layerId: string | string[] | undefined,
  event: K,
  handler: (event: MapLayerEventType[K]) => void,
  enabled = true
) {
  const map = useMap()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled || !layerId) return
    const layers = Array.isArray(layerId) ? layerId : [layerId]
    const wrapped = (e: MapLayerEventType[K]) => handlerRef.current(e)
    for (const id of layers) {
      map.on(event, id, wrapped as never)
    }
    return () => {
      for (const id of layers) {
        map.off(event, id, wrapped as never)
      }
    }
  }, [map, event, enabled, layerId])
}

// ── Utility ──────────────────────────────────────────────────────────────────

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 10)
}
