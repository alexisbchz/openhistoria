"use client"

import {
  Map,
  MapFullscreenControl,
  MapLocateControl,
  MapTileLayer,
  MapZoomControl,
} from "@workspace/ui/components/map"

import { BriefingPanel } from "@/components/briefing-panel"
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
import { MapTextureOverlay } from "@/components/map-texture-overlay"
import { ProjectMarkers } from "@/components/project-markers"
import { TimeControls } from "@/components/time-controls"

function ConditionalMapLayers() {
  const { visible } = useMapLayers()
  return (
    <>
      {visible.countries && <MapCountryRegions />}
      {visible.regions && <MapStates />}
      {visible.countries && <MapCountryLabels />}
      {visible.cities && <MapCities />}
    </>
  )
}

export function HomeMap() {
  return (
    <Map
      center={[20, 0]}
      zoom={3}
      maxZoom={18}
      className="h-svh w-full rounded-none [&_.map-satellite-tiles]:[filter:brightness(0.78)_saturate(1.25)_contrast(1.05)_hue-rotate(-6deg)]"
    >
      <MapLayersProvider>
        <CountrySelectionProvider>
          <MapTileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            darkUrl="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
            maxNativeZoom={18}
            className="map-satellite-tiles"
          />
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
