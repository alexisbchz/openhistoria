"use client"

import { useMap } from "@workspace/ui/components/map"
import { createPortal } from "react-dom"

export function MapTextureOverlay() {
  const map = useMap()
  const container = map.getContainer()

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[300] overflow-hidden"
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.25] mix-blend-overlay"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="map-paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.5
                    0 0 0 0 0.5
                    0 0 0 0 0.5
                    0 0 0 0.6 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#map-paper-grain)" />
      </svg>

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.18] mix-blend-soft-light"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="map-water-shimmer">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.016"
            numOctaves="3"
            seed="3"
          >
            <animate
              attributeName="baseFrequency"
              dur="18s"
              values="0.008 0.016; 0.013 0.010; 0.008 0.016"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.40
                    0 0 0 0 0.62
                    0 0 0 0 0.85
                    0 0 0 0.85 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#map-water-shimmer)" />
      </svg>
    </div>,
    container
  )
}
