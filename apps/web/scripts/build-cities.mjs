#!/usr/bin/env node
/**
 * Build a city dataset for the map layer.
 *
 * Downloads GeoNames cities15000.zip (~25k cities with population ≥ 15,000)
 * and converts it to a GeoJSON FeatureCollection compatible with
 * apps/web/components/map-cities.tsx.
 *
 * Output: apps/web/public/data/cities-15k.geojson
 *
 * GeoNames is licensed CC BY 4.0. https://download.geonames.org/export/dump/
 */

import { createWriteStream } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url))
const PROJECT_ROOT = join(SCRIPT_DIR, "..")
const OUT_FILE = join(PROJECT_ROOT, "public/data/cities-15k.geojson")
const SRC_URL = "https://download.geonames.org/export/dump/cities15000.zip"

// GeoNames cities*.txt columns (tab-separated, no header)
const GEONAMES_COLUMNS = [
  "geonameid",
  "name",
  "asciiname",
  "alternatenames",
  "latitude",
  "longitude",
  "feature_class",
  "feature_code",
  "country_code",
  "cc2",
  "admin1_code",
  "admin2_code",
  "admin3_code",
  "admin4_code",
  "population",
  "elevation",
  "dem",
  "timezone",
  "modification_date",
]

// ISO 3166-1 alpha-2 → English country name (covers everything in the dataset).
// Built lazily from REST Countries at runtime to keep the script small.
async function loadCountryNames() {
  const res = await fetch(
    "https://restcountries.com/v3.1/all?fields=name,cca2"
  )
  if (!res.ok) {
    throw new Error(`REST Countries returned ${res.status}`)
  }
  const rows = await res.json()
  const map = new Map()
  for (const row of rows) {
    if (row?.cca2 && row?.name?.common) {
      map.set(row.cca2, row.name.common)
    }
  }
  // Patch: GeoNames uses XK for Kosovo.
  if (!map.has("XK")) map.set("XK", "Kosovo")
  return map
}

// Translate population to a SCALERANK in the same 0–10 spirit as Natural Earth,
// so existing zoom thresholds keep working.
function rankForPopulation(pop) {
  if (pop >= 8_000_000) return 0
  if (pop >= 4_000_000) return 1
  if (pop >= 2_000_000) return 2
  if (pop >= 1_000_000) return 3
  if (pop >= 500_000) return 4
  if (pop >= 250_000) return 5
  if (pop >= 100_000) return 6
  if (pop >= 50_000) return 7
  if (pop >= 25_000) return 8
  return 9
}

async function downloadAndUnzip() {
  const tmp = await mkdir(join(tmpdir(), "openhistoria-cities-"), {
    recursive: true,
  })
  const dir = tmp ?? join(tmpdir(), "openhistoria-cities-fixed")
  await mkdir(dir, { recursive: true })
  const zipPath = join(dir, "cities15000.zip")
  console.log(`Downloading ${SRC_URL} → ${zipPath}`)
  const res = await fetch(SRC_URL)
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download cities15000.zip: HTTP ${res.status}`)
  }
  await pipeline(res.body, createWriteStream(zipPath))
  console.log("Unzipping…")
  // Use system unzip — bundled with macOS and most Linux dev envs.
  const { spawnSync } = await import("node:child_process")
  const result = spawnSync("unzip", ["-o", zipPath, "-d", dir], {
    stdio: "inherit",
  })
  if (result.status !== 0) {
    throw new Error(`unzip exited with code ${result.status}`)
  }
  return { dir, txtPath: join(dir, "cities15000.txt") }
}

function parseLine(line) {
  const cols = line.split("\t")
  const record = {}
  for (let i = 0; i < GEONAMES_COLUMNS.length; i++) {
    record[GEONAMES_COLUMNS[i]] = cols[i] ?? ""
  }
  return record
}

async function build() {
  const { dir, txtPath } = await downloadAndUnzip()
  const countryNames = await loadCountryNames()
  console.log(`Reading ${txtPath}`)
  const raw = await readFile(txtPath, "utf8")
  const lines = raw.split("\n").filter((l) => l.trim().length > 0)
  console.log(`Parsing ${lines.length} rows`)

  const features = []
  let skipped = 0
  for (const line of lines) {
    const r = parseLine(line)
    const lat = Number(r.latitude)
    const lon = Number(r.longitude)
    const pop = Number(r.population)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      skipped++
      continue
    }
    // Skip non-city feature classes (P = populated place is what we want).
    if (r.feature_class && r.feature_class !== "P") {
      skipped++
      continue
    }
    const isCapital =
      r.feature_code === "PPLC" || r.feature_code === "PPLG" ? 1 : 0
    const adm0name =
      countryNames.get(r.country_code) || r.country_code || "Unknown"
    features.push({
      type: "Feature",
      properties: {
        NAME: r.name,
        NAME_EN: r.asciiname || r.name,
        ADM0NAME: adm0name,
        ISO_A2: r.country_code,
        POP_MAX: Number.isFinite(pop) ? pop : 0,
        SCALERANK: rankForPopulation(Number.isFinite(pop) ? pop : 0),
        ADM0CAP: isCapital,
        GEONAMEID: Number(r.geonameid) || 0,
        FEATURE_CODE: r.feature_code,
      },
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
    })
  }
  console.log(`Built ${features.length} features (skipped ${skipped})`)

  const collection = {
    type: "FeatureCollection",
    name: "geonames_cities15000",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    license:
      "Data: GeoNames (CC BY 4.0). https://download.geonames.org/export/dump/",
    features,
  }
  await mkdir(join(PROJECT_ROOT, "public/data"), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(collection))
  console.log(`Wrote ${OUT_FILE}`)

  // Clean up temp dir
  await rm(dir, { recursive: true, force: true }).catch(() => {})
}

build().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
