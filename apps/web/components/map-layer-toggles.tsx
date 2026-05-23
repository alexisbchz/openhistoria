"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  BuildingIcon,
  LandPlotIcon,
  LandmarkIcon,
  MapIcon,
  MountainIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import {
  useMapLayers,
  type Basemap,
  type MapLayerKey,
} from "@/components/map-layers-state"

interface ToggleSpec {
  key: MapLayerKey
  label: string
  icon: ReactNode
}

const TOGGLES: ToggleSpec[] = [
  {
    key: "countries",
    label: "Countries",
    icon: <LandmarkIcon className="size-4" />,
  },
  {
    key: "regions",
    label: "Regions",
    icon: <LandPlotIcon className="size-4" />,
  },
  {
    key: "cities",
    label: "Cities",
    icon: <BuildingIcon className="size-4" />,
  },
]

const BASEMAPS: { key: Basemap; label: string; icon: ReactNode }[] = [
  { key: "satellite", label: "Satellite", icon: <MountainIcon className="size-4" /> },
  { key: "map", label: "Map", icon: <MapIcon className="size-4" /> },
]

export function MapLayerToggles() {
  const { visible, toggle, basemap, setBasemap } = useMapLayers()
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-md border border-border/80 bg-background/85 p-1 shadow-md backdrop-blur-sm">
        {BASEMAPS.map((spec) => {
          const on = basemap === spec.key
          return (
            <Button
              key={spec.key}
              type="button"
              size="sm"
              variant={on ? "default" : "ghost"}
              className={cn(
                "h-8 gap-1.5 px-2 text-xs",
                !on && "text-muted-foreground"
              )}
              onClick={() => setBasemap(spec.key)}
              aria-pressed={on}
              title={`Basemap: ${spec.label}`}
            >
              {spec.icon}
              <span>{spec.label}</span>
            </Button>
          )
        })}
      </div>
      <div className="flex items-center gap-1 rounded-md border border-border/80 bg-background/85 p-1 shadow-md backdrop-blur-sm">
        {TOGGLES.map((spec) => {
          const on = visible[spec.key]
          return (
            <Button
              key={spec.key}
              type="button"
              size="sm"
              variant={on ? "default" : "ghost"}
              className={cn(
                "h-8 gap-1.5 px-2 text-xs",
                !on && "text-muted-foreground"
              )}
              onClick={() => toggle(spec.key)}
              aria-pressed={on}
              title={`${spec.label} (${on ? "shown" : "hidden"})`}
            >
              {spec.icon}
              <span>{spec.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
