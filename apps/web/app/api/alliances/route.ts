import { NextResponse } from "next/server"

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
const USER_AGENT =
  "openhistoria-dev (https://github.com/openhistoria) alliances-endpoint"

// Q1127126 = "military alliance" — used as the type filter via instance-of /
// subclass-of*. The query also excludes alliances that have a dissolution date
// (P576) so defunct blocs like SEATO or the Warsaw Pact don't slip through.
const MILITARY_ALLIANCE_QID = "Q1127126"

interface Alliance {
  name: string
  wikidataId: string
}

interface SparqlResponse {
  results: {
    bindings: Array<{
      alliance?: { value: string }
      allianceLabel?: { value: string }
    }>
  }
}

// Hardcoded fallback membership — used only when Wikidata fails or returns
// nothing. Keep in alpha-3; alpha-2 inputs are mapped before lookup.
const NATO_MEMBERS_ALPHA3 = new Set([
  "USA", "GBR", "FRA", "DEU", "ITA", "CAN", "BEL", "NLD", "LUX", "NOR",
  "PRT", "DNK", "ISL", "GRC", "TUR", "ESP", "POL", "CZE", "HUN", "SVK",
  "SVN", "EST", "LVA", "LTU", "BGR", "ROU", "ALB", "HRV", "MNE", "MKD",
  "FIN", "SWE",
])

const CSTO_MEMBERS_ALPHA3 = new Set([
  "RUS", "BLR", "ARM", "KAZ", "KGZ", "TJK",
])

const ALPHA2_TO_ALPHA3: Record<string, string> = {
  US: "USA", GB: "GBR", FR: "FRA", DE: "DEU", IT: "ITA", CA: "CAN",
  BE: "BEL", NL: "NLD", LU: "LUX", NO: "NOR", PT: "PRT", DK: "DNK",
  IS: "ISL", GR: "GRC", TR: "TUR", ES: "ESP", PL: "POL", CZ: "CZE",
  HU: "HUN", SK: "SVK", SI: "SVN", EE: "EST", LV: "LVA", LT: "LTU",
  BG: "BGR", RO: "ROU", AL: "ALB", HR: "HRV", ME: "MNE", MK: "MKD",
  FI: "FIN", SE: "SWE",
  RU: "RUS", BY: "BLR", AM: "ARM", KZ: "KAZ", KG: "KGZ", TJ: "TJK",
}

function buildAllianceQuery(code: string): string {
  const property = code.length === 2 ? "P297" : "P298"
  return `
    SELECT ?alliance ?allianceLabel WHERE {
      ?country wdt:${property} "${code}".
      ?country wdt:P463 ?alliance.
      ?alliance wdt:P31/wdt:P279* wd:${MILITARY_ALLIANCE_QID}.
      FILTER NOT EXISTS { ?alliance wdt:P576 ?dissolved. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,es,de,it,pt,ru,zh,ar,ja,[AUTO_LANGUAGE]". }
    }
  `
}

function entityIdFromUri(uri: string): string | null {
  const match = uri.match(/Q\d+$/)
  return match ? match[0] : null
}

async function fetchFromWikidata(code: string): Promise<Alliance[]> {
  const sparql = buildAllianceQuery(code)
  const res = await fetch(
    `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparql)}`,
    {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": USER_AGENT,
      },
    }
  )
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`)
  const body = (await res.json()) as SparqlResponse

  const seen = new Set<string>()
  const alliances: Alliance[] = []
  for (const row of body.results.bindings) {
    const id = row.alliance ? entityIdFromUri(row.alliance.value) : null
    const rawLabel = row.allianceLabel?.value ?? null
    // Drop entries with no QID, no label, or a QID-as-label fallback.
    if (!id || !rawLabel || /^Q\d+$/.test(rawLabel)) continue
    if (seen.has(id)) continue
    seen.add(id)
    alliances.push({ name: rawLabel, wikidataId: id })
  }
  return alliances
}

function hardcodedFallback(code: string): Alliance[] {
  const alpha3 =
    code.length === 3 ? code : (ALPHA2_TO_ALPHA3[code] ?? code)
  const alliances: Alliance[] = []
  if (NATO_MEMBERS_ALPHA3.has(alpha3)) {
    alliances.push({ name: "NATO", wikidataId: "Q7184" })
  }
  if (CSTO_MEMBERS_ALPHA3.has(alpha3)) {
    alliances.push({
      name: "Collective Security Treaty Organization",
      wikidataId: "Q318693",
    })
  }
  return alliances
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = url.searchParams.get("code")
  if (!raw) {
    return NextResponse.json(
      { error: "Missing required query param: code" },
      { status: 400 }
    )
  }
  const code = raw.trim().toUpperCase()
  if (!/^[A-Z]{2,3}$/.test(code)) {
    return NextResponse.json(
      { error: `Invalid country code "${raw}". Expected ISO alpha-2 or alpha-3.` },
      { status: 400 }
    )
  }

  let alliances: Alliance[] = []
  let usedFallback = false
  try {
    alliances = await fetchFromWikidata(code)
  } catch {
    usedFallback = true
  }
  if (alliances.length === 0) {
    const fallback = hardcodedFallback(code)
    if (fallback.length > 0) {
      alliances = fallback
      usedFallback = true
    }
  }

  const cacheControl =
    process.env.NODE_ENV === "production"
      ? "public, s-maxage=86400, stale-while-revalidate=604800"
      : "no-store"

  return NextResponse.json(
    { alliances, source: usedFallback ? "fallback" : "wikidata" },
    { headers: { "Cache-Control": cacheControl } }
  )
}
