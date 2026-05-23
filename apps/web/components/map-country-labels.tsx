"use client"

import { MapMarker, useMap, useMapEvents } from "@workspace/ui/components/map"
import { useEffect, useState } from "react"

import { useCountrySelection } from "@/components/map-country-regions"

type Tier = 1 | 2 | 3

interface CountryLabel {
  name: string
  center: [number, number]
  tier: Tier
}

// tier 1: shown from zoom 2+ — major/large countries
// tier 2: shown from zoom 4+ — most countries
// tier 3: shown from zoom 5+ — small countries
const COUNTRIES: readonly CountryLabel[] = [
  { name: "United States", center: [39.0, -98.5], tier: 1 },
  { name: "Canada", center: [56.0, -96.0], tier: 1 },
  { name: "Mexico", center: [23.6, -102.5], tier: 1 },
  { name: "Brazil", center: [-10.0, -53.0], tier: 1 },
  { name: "Argentina", center: [-35.5, -65.0], tier: 1 },
  { name: "Russia", center: [62.0, 90.0], tier: 1 },
  { name: "China", center: [35.8, 104.2], tier: 1 },
  { name: "India", center: [22.5, 79.0], tier: 1 },
  { name: "Australia", center: [-25.3, 133.8], tier: 1 },
  { name: "Greenland", center: [71.7, -42.6], tier: 1 },
  { name: "Kazakhstan", center: [48.0, 66.9], tier: 1 },
  { name: "Algeria", center: [28.0, 1.7], tier: 1 },
  { name: "Saudi Arabia", center: [23.9, 45.1], tier: 1 },
  { name: "Iran", center: [32.4, 53.7], tier: 1 },
  { name: "Türkiye", center: [39.0, 35.2], tier: 1 },
  { name: "Egypt", center: [26.8, 30.8], tier: 1 },
  { name: "Libya", center: [26.3, 17.2], tier: 1 },
  { name: "Sudan", center: [14.0, 30.2], tier: 1 },
  { name: "DR Congo", center: [-2.5, 23.5], tier: 1 },
  { name: "South Africa", center: [-29.0, 24.0], tier: 1 },
  { name: "Indonesia", center: [-2.5, 118.0], tier: 1 },
  { name: "Mongolia", center: [46.9, 103.8], tier: 1 },
  { name: "Niger", center: [17.6, 8.1], tier: 1 },
  { name: "Mali", center: [17.6, -4.0], tier: 1 },
  { name: "Chad", center: [15.5, 18.7], tier: 1 },
  { name: "Ethiopia", center: [9.2, 40.5], tier: 1 },
  { name: "Angola", center: [-11.2, 17.9], tier: 1 },

  { name: "France", center: [46.6, 2.2], tier: 2 },
  { name: "Spain", center: [40.5, -3.7], tier: 2 },
  { name: "Germany", center: [51.2, 10.4], tier: 2 },
  { name: "Italy", center: [42.5, 12.6], tier: 2 },
  { name: "United Kingdom", center: [54.8, -2.4], tier: 2 },
  { name: "Poland", center: [51.9, 19.1], tier: 2 },
  { name: "Ukraine", center: [49.0, 31.2], tier: 2 },
  { name: "Sweden", center: [62.0, 16.0], tier: 2 },
  { name: "Norway", center: [62.0, 10.0], tier: 2 },
  { name: "Finland", center: [64.0, 26.0], tier: 2 },
  { name: "Romania", center: [45.9, 25.0], tier: 2 },
  { name: "Belarus", center: [53.7, 27.9], tier: 2 },
  { name: "Greece", center: [39.1, 22.8], tier: 2 },
  { name: "Portugal", center: [39.4, -8.2], tier: 2 },
  { name: "Netherlands", center: [52.3, 5.6], tier: 2 },
  { name: "Iraq", center: [33.2, 43.7], tier: 2 },
  { name: "Syria", center: [34.8, 39.0], tier: 2 },
  { name: "Israel", center: [31.5, 35.0], tier: 2 },
  { name: "Jordan", center: [30.6, 36.2], tier: 2 },
  { name: "Yemen", center: [15.6, 48.5], tier: 2 },
  { name: "Oman", center: [21.5, 56.0], tier: 2 },
  { name: "Afghanistan", center: [33.9, 67.7], tier: 2 },
  { name: "Pakistan", center: [30.4, 69.3], tier: 2 },
  { name: "Bangladesh", center: [23.7, 90.4], tier: 2 },
  { name: "Myanmar", center: [21.9, 96.0], tier: 2 },
  { name: "Thailand", center: [15.9, 101.0], tier: 2 },
  { name: "Vietnam", center: [16.0, 107.0], tier: 2 },
  { name: "Malaysia", center: [4.2, 102.0], tier: 2 },
  { name: "Philippines", center: [12.9, 121.8], tier: 2 },
  { name: "Japan", center: [36.2, 138.3], tier: 2 },
  { name: "South Korea", center: [36.0, 127.8], tier: 2 },
  { name: "North Korea", center: [40.3, 127.5], tier: 2 },
  { name: "Morocco", center: [31.8, -7.1], tier: 2 },
  { name: "Tunisia", center: [34.0, 9.5], tier: 2 },
  { name: "Mauritania", center: [21.0, -10.9], tier: 2 },
  { name: "Nigeria", center: [9.1, 8.7], tier: 2 },
  { name: "Cameroon", center: [6.5, 12.3], tier: 2 },
  { name: "Kenya", center: [0.0, 37.9], tier: 2 },
  { name: "Tanzania", center: [-6.4, 34.9], tier: 2 },
  { name: "Uganda", center: [1.4, 32.3], tier: 2 },
  { name: "Somalia", center: [5.2, 46.2], tier: 2 },
  { name: "South Sudan", center: [7.0, 30.0], tier: 2 },
  { name: "Zambia", center: [-13.1, 27.9], tier: 2 },
  { name: "Zimbabwe", center: [-19.0, 29.2], tier: 2 },
  { name: "Mozambique", center: [-18.7, 35.5], tier: 2 },
  { name: "Madagascar", center: [-19.0, 46.9], tier: 2 },
  { name: "Namibia", center: [-23.0, 18.5], tier: 2 },
  { name: "Botswana", center: [-22.3, 24.7], tier: 2 },
  { name: "Colombia", center: [4.6, -74.3], tier: 2 },
  { name: "Venezuela", center: [6.4, -66.6], tier: 2 },
  { name: "Peru", center: [-9.2, -75.0], tier: 2 },
  { name: "Bolivia", center: [-16.3, -64.6], tier: 2 },
  { name: "Chile", center: [-37.0, -71.5], tier: 2 },
  { name: "Paraguay", center: [-23.4, -58.4], tier: 2 },
  { name: "Uruguay", center: [-32.5, -55.8], tier: 2 },
  { name: "Ecuador", center: [-1.8, -78.2], tier: 2 },
  { name: "Cuba", center: [21.5, -77.8], tier: 2 },
  { name: "New Zealand", center: [-41.0, 173.5], tier: 2 },
  { name: "Iceland", center: [64.9, -19.0], tier: 2 },
  { name: "Ireland", center: [53.4, -8.0], tier: 2 },

  { name: "Belgium", center: [50.5, 4.5], tier: 3 },
  { name: "Switzerland", center: [46.8, 8.2], tier: 3 },
  { name: "Austria", center: [47.5, 14.6], tier: 3 },
  { name: "Czechia", center: [49.8, 15.5], tier: 3 },
  { name: "Hungary", center: [47.2, 19.5], tier: 3 },
  { name: "Slovakia", center: [48.7, 19.7], tier: 3 },
  { name: "Slovenia", center: [46.15, 14.99], tier: 3 },
  { name: "Croatia", center: [45.1, 15.2], tier: 3 },
  { name: "Bosnia", center: [43.9, 17.7], tier: 3 },
  { name: "Serbia", center: [44.0, 21.0], tier: 3 },
  { name: "Bulgaria", center: [42.7, 25.5], tier: 3 },
  { name: "Albania", center: [41.15, 20.17], tier: 3 },
  { name: "Macedonia", center: [41.6, 21.7], tier: 3 },
  { name: "Denmark", center: [56.0, 9.5], tier: 3 },
  { name: "Estonia", center: [58.6, 25.0], tier: 3 },
  { name: "Latvia", center: [56.9, 24.6], tier: 3 },
  { name: "Lithuania", center: [55.2, 23.9], tier: 3 },
  { name: "Moldova", center: [47.4, 28.4], tier: 3 },
  { name: "Georgia", center: [42.3, 43.4], tier: 3 },
  { name: "Armenia", center: [40.1, 45.0], tier: 3 },
  { name: "Azerbaijan", center: [40.1, 47.6], tier: 3 },
  { name: "Uzbekistan", center: [41.4, 64.6], tier: 3 },
  { name: "Turkmenistan", center: [38.97, 59.56], tier: 3 },
  { name: "Tajikistan", center: [38.86, 71.28], tier: 3 },
  { name: "Kyrgyzstan", center: [41.2, 74.77], tier: 3 },
  { name: "Nepal", center: [28.4, 84.1], tier: 3 },
  { name: "Sri Lanka", center: [7.9, 80.8], tier: 3 },
  { name: "Cambodia", center: [12.6, 105.0], tier: 3 },
  { name: "Laos", center: [19.9, 102.5], tier: 3 },
  { name: "Lebanon", center: [33.85, 35.9], tier: 3 },
  { name: "UAE", center: [23.4, 53.9], tier: 3 },
  { name: "Qatar", center: [25.35, 51.18], tier: 3 },
  { name: "Kuwait", center: [29.31, 47.48], tier: 3 },
  { name: "Senegal", center: [14.5, -14.5], tier: 3 },
  { name: "Ghana", center: [7.95, -1.0], tier: 3 },
  { name: "Côte d'Ivoire", center: [7.5, -5.5], tier: 3 },
  { name: "Burkina Faso", center: [12.24, -1.56], tier: 3 },
  { name: "Guinea", center: [9.95, -9.7], tier: 3 },
  { name: "Liberia", center: [6.43, -9.43], tier: 3 },
  { name: "Sierra Leone", center: [8.46, -11.78], tier: 3 },
  { name: "Togo", center: [8.62, 0.82], tier: 3 },
  { name: "Benin", center: [9.3, 2.31], tier: 3 },
  { name: "Eritrea", center: [15.18, 39.78], tier: 3 },
  { name: "Rwanda", center: [-1.94, 29.87], tier: 3 },
  { name: "Burundi", center: [-3.37, 29.92], tier: 3 },
  { name: "Malawi", center: [-13.25, 34.3], tier: 3 },
  { name: "Lesotho", center: [-29.6, 28.23], tier: 3 },
  { name: "Eswatini", center: [-26.52, 31.47], tier: 3 },
  { name: "Gabon", center: [-0.8, 11.6], tier: 3 },
  { name: "Congo", center: [-0.7, 15.0], tier: 3 },
  { name: "C.A.R.", center: [6.6, 20.94], tier: 3 },
  { name: "Guatemala", center: [15.78, -90.23], tier: 3 },
  { name: "Honduras", center: [15.2, -86.24], tier: 3 },
  { name: "Nicaragua", center: [12.87, -85.2], tier: 3 },
  { name: "Costa Rica", center: [9.75, -83.75], tier: 3 },
  { name: "Panama", center: [8.54, -80.78], tier: 3 },
  { name: "Dom. Rep.", center: [18.7, -70.2], tier: 3 },
  { name: "Haiti", center: [19.0, -72.3], tier: 3 },
  { name: "Jamaica", center: [18.11, -77.3], tier: 3 },
]

function tierForZoom(zoom: number): Tier {
  if (zoom <= 3) return 1
  if (zoom <= 4) return 2
  return 3
}

function fontSizeForZoom(zoom: number): number {
  if (zoom <= 3) return 11
  if (zoom <= 5) return 12
  return 13
}

export function MapCountryLabels() {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const { selected, setSelected } = useCountrySelection()

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  })

  useEffect(() => {
    setZoom(map.getZoom())
  }, [map])

  const maxTier = tierForZoom(zoom)
  const fontSize = fontSizeForZoom(zoom)
  const visible = COUNTRIES.filter((c) => c.tier <= maxTier)

  return (
    <>
      {visible.map((country) => {
        const isSelected = selected?.name === country.name
        return (
          <MapMarker
            key={country.name}
            position={country.center}
            eventHandlers={{
              click: () => setSelected({ name: country.name }),
            }}
            icon={
              <div
                className="cursor-pointer whitespace-nowrap rounded-sm px-1.5 py-0.5 font-sans font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-primary/15"
                style={{
                  fontSize: `${fontSize}px`,
                  color: isSelected
                    ? "oklch(0.95 0.08 85)"
                    : "oklch(0.92 0.05 85)",
                  textShadow:
                    "0 0 3px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)",
                  letterSpacing: "0.12em",
                  background: isSelected
                    ? "color-mix(in oklch, var(--primary) 22%, transparent)"
                    : undefined,
                }}
              >
                {country.name}
              </div>
            }
          />
        )
      })}
    </>
  )
}
