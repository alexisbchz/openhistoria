"use client"

import {
  Map,
  MapFullscreenControl,
  MapLocateControl,
  MapSearchControl,
  MapTileLayer,
  MapZoomControl,
} from "@workspace/ui/components/map"

import { HomeHud } from "@/components/home-hud"
import { MapCountryLabels } from "@/components/map-country-labels"
import {
  CountrySelectionProvider,
  MapCountryRegions,
  SelectedCountryIndicator,
} from "@/components/map-country-regions"
import { MapTextureOverlay } from "@/components/map-texture-overlay"
import { ProjectMarkers } from "@/components/project-markers"
import { TimeControls } from "@/components/time-controls"

export function HomeMap() {
  return (
    <Map
      center={[20, 0]}
      zoom={3}
      maxZoom={18}
      className="h-svh w-full rounded-none [&_.map-satellite-tiles]:[filter:brightness(0.78)_saturate(1.25)_contrast(1.05)_hue-rotate(-6deg)] [&_.map-places-tiles]:[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.95))_drop-shadow(0_1px_2px_rgba(0,0,0,0.85))_contrast(1.1)]"
    >
      <CountrySelectionProvider>
        <MapTileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          darkUrl="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          maxNativeZoom={18}
          className="map-satellite-tiles"
        />
        <MapCountryRegions />
        <MapTileLayer
          name="Places"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          darkUrl="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          attribution=""
          opacity={0.78}
          minZoom={4}
          className="map-places-tiles"
        />
        <MapCountryLabels />
        <MapTextureOverlay />
        <MapSearchControl
          position="top-2 left-2"
          placeholder="Search a place…"
        />
        <MapZoomControl position="top-2 left-64" />
        <MapFullscreenControl position="top-2 right-2" />
        <MapLocateControl position="top-11 right-2" />
        <ProjectMarkers />
        <SelectedCountryIndicator />
        <HomeHud bottomRight={<TimeControls />} />
      </CountrySelectionProvider>
    </Map>
  )
}
