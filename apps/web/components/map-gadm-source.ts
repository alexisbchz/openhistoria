// Shared maplibre source + layer config for the GADM PMTiles archive.
//
// Drop your GADM build at `apps/web/public/data/gadm.pmtiles`. Tile it with
// tippecanoe so each admin level lives in its own source-layer:
//   tippecanoe -o gadm.pmtiles -l adm0 gadm_410-levels_ADM_0.geojson \
//              -l adm1 gadm_410-levels_ADM_1.geojson \
//              --use-attribute-for-id=GID_0 ...
//
// We promoteId on both source-layers so each rendered feature has a stable
// id we can target with map.setFeatureState (used for hover/selected styling).

import type { VectorSourceSpecification } from "maplibre-gl"

export const GADM_PMTILES_URL = "pmtiles:///data/gadm.pmtiles"
export const GADM_SOURCE_ID = "gadm"

export const ADM0_SOURCE_LAYER = "adm0"
export const ADM1_SOURCE_LAYER = "adm1"

export const ADM0_FILL_LAYER = "gadm-adm0-fill"
export const ADM0_STROKE_LAYER = "gadm-adm0-stroke"
export const ADM1_FILL_LAYER = "gadm-adm1-fill"
export const ADM1_STROKE_LAYER = "gadm-adm1-stroke"

export const gadmSourceSpec: VectorSourceSpecification = {
  type: "vector",
  url: GADM_PMTILES_URL,
  promoteId: {
    [ADM0_SOURCE_LAYER]: "GID_0",
    [ADM1_SOURCE_LAYER]: "GID_1",
  },
}
