"use client"

import {
  Map,
  MapFullscreenControl,
  MapLocateControl,
  MapTileLayer,
  MapZoomControl,
} from "@workspace/ui/components/map"

import { BriefingPanel } from "@/components/briefing-panel"
import { ElectionPoll } from "@/components/election-poll"
import { HomeHud } from "@/components/home-hud"
import { MapCities } from "@/components/map-cities"
import { MapCountryLabels } from "@/components/map-country-labels"
import {
  CountrySelectionProvider,
  MapCountryRegions,
  SelectedCountryIndicator,
} from "@/components/map-country-regions"
import { MapLayerToggles } from "@/components/map-layer-toggles"
import {
  MapLayersProvider,
  useMapLayers,
} from "@/components/map-layers-state"
import { MapStates } from "@/components/map-states"
import { MapOpinionMarkers } from "@/components/map-opinion-markers"
import { MapTextureOverlay } from "@/components/map-texture-overlay"
import { ProjectMarkers } from "@/components/project-markers"
import { TimeControls } from "@/components/time-controls"
import { TrendStrip } from "@/components/trend-strip"

const ESRI_SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const CARTO_LIGHT_URL =
  "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"

function Basemap() {
  const { basemap } = useMapLayers()
  if (basemap === "satellite") {
    return (
      <MapTileLayer
        url={ESRI_SATELLITE_URL}
        maxNativeZoom={18}
        brightness={0.78}
        saturation={0.25}
        contrast={0.05}
        hueRotate={354}
      />
    )
  }
  return <MapTileLayer url={CARTO_LIGHT_URL} maxNativeZoom={19} />
}

function ConditionalMapLayers() {
  const { visible } = useMapLayers()
  return (
    <>
      {visible.countries && <MapCountryRegions />}
      {visible.regions && <MapStates />}
      {visible.countries && <MapCountryLabels />}
      {visible.cities && <MapCities />}
      {visible.opinions && <MapOpinionMarkers />}
    </>
  )
}

export function HomeMap() {
  return (
    <Map center={[20, 0]} zoom={3} maxZoom={18} className="h-svh w-full">
      <MapLayersProvider>
        <CountrySelectionProvider>
          <Basemap />
          <ConditionalMapLayers />
          <MapTextureOverlay />
          <MapZoomControl position="top-2 right-2" />
          <MapFullscreenControl position="top-20 right-2" />
          <MapLocateControl position="top-32 right-2" />
          <ProjectMarkers />
          <SelectedCountryIndicator />
          <HomeHud
            bottomRight={
              <div className="flex flex-col items-end gap-2">
                <ElectionPoll />
                <TrendStrip />
                <BriefingPanel />
                <TimeControls />
                <MapLayerToggles />
              </div>
            }
          />
        </CountrySelectionProvider>
      </MapLayersProvider>
    </Map>
  )
}
