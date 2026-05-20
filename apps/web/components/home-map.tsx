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
import { TimeControls } from "@/components/time-controls"

export function HomeMap() {
  return (
    <Map
      center={[20, 0]}
      zoom={3}
      maxZoom={18}
      className="h-svh w-full rounded-none"
    >
      <MapTileLayer />
      <MapSearchControl position="top-2 left-2" placeholder="Search a place…" />
      <MapZoomControl position="top-2 left-64" />
      <MapFullscreenControl position="top-2 right-2" />
      <MapLocateControl position="top-11 right-2" />
      <HomeHud bottomRight={<TimeControls />} />
    </Map>
  )
}
