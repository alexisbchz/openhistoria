import { NextResponse } from "next/server"

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
const USER_AGENT =
  "openhistoria-dev (https://github.com/openhistoria) head-of-state-endpoint"

interface SparqlBinding {
  type: string
  value: string
}

interface SparqlResponse {
  results: { bindings: Array<Record<string, SparqlBinding>> }
}

interface Leader {
  name: string | null
  wikidataId: string | null
  imageUrl: string | null
}

interface LeadersResponse {
  country: { name: string | null; wikidataId: string | null }
  headOfState: Leader | null
  headOfGovernment: Leader | null
}

interface LeaderRow {
  leader: Leader
  countryName: string | null
  countryWikidataId: string | null
}

function buildQuery(code: string, property: "P35" | "P6"): string {
  const isoProperty = code.length === 2 ? "P297" : "P298"
  return `
    SELECT ?country ?countryLabel ?leader ?leaderLabel ?image WHERE {
      ?country wdt:${isoProperty} "${code}".
      ?country p:${property} ?statement.
      ?statement ps:${property} ?leader.
      FILTER NOT EXISTS { ?statement pq:P582 ?end. }
      OPTIONAL { ?leader wdt:P18 ?image. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es,fr,de,it,pt,ru,zh,ar,ja,[AUTO_LANGUAGE]". }
    }
    LIMIT 1
  `
}

function entityIdFromUri(uri: string): string | null {
  const match = uri.match(/Q\d+$/)
  return match ? match[0] : null
}

function commonsImageUrl(rawUri: string): string {
  // Wikidata P18 values look like:
  // http://commons.wikimedia.org/wiki/Special:FilePath/Photo.jpg
  // That URL already redirects to the actual file; force https.
  return rawUri.replace(/^http:/, "https:")
}

async function fetchLeader(
  code: string,
  property: "P35" | "P6"
): Promise<LeaderRow | null> {
  const sparql = buildQuery(code, property)
  const res = await fetch(
    `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparql)}`,
    {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": USER_AGENT,
      },
    }
  )
  if (!res.ok) {
    throw new Error(`Wikidata returned HTTP ${res.status} for ${property}`)
  }
  const body = (await res.json()) as SparqlResponse
  const row = body.results.bindings[0]
  if (!row) return null

  const wikidataId = row.leader ? entityIdFromUri(row.leader.value) : null
  const rawLabel = row.leaderLabel?.value ?? null
  // When no label exists in any fallback language, the SPARQL service can
  // return the QID itself ("Q5771800") as the label. Treat that as missing
  // so the UI can fall back to the Wikipedia title instead of a Q-number.
  const isQidFallback = rawLabel != null && /^Q\d+$/.test(rawLabel)
  const name = isQidFallback ? null : rawLabel

  return {
    leader: {
      name,
      wikidataId,
      imageUrl: row.image ? commonsImageUrl(row.image.value) : null,
    },
    countryName: row.countryLabel?.value ?? null,
    countryWikidataId: row.country ? entityIdFromUri(row.country.value) : null,
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = url.searchParams.get("code")
  if (!raw) {
    return NextResponse.json(
      { error: "Missing required query param: code (ISO 3166-1 alpha-2 or alpha-3)" },
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

  let hosRow: LeaderRow | null
  let hogRow: LeaderRow | null
  try {
    ;[hosRow, hogRow] = await Promise.all([
      fetchLeader(code, "P35"),
      fetchLeader(code, "P6"),
    ])
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Wikidata request failed: ${err.message}`
            : "Wikidata request failed",
      },
      { status: 502 }
    )
  }

  if (!hosRow && !hogRow) {
    return NextResponse.json(
      { error: `No current leaders found for "${code}"` },
      { status: 404 }
    )
  }

  // Dedup: if both queries point at the same person (USA, Saudi Arabia, etc.),
  // keep them as head of state only — the UI labels that case explicitly.
  let headOfGovernment: Leader | null = hogRow?.leader ?? null
  if (
    hosRow?.leader.wikidataId &&
    hogRow?.leader.wikidataId &&
    hosRow.leader.wikidataId === hogRow.leader.wikidataId
  ) {
    headOfGovernment = null
  }

  const country = {
    name: hosRow?.countryName ?? hogRow?.countryName ?? null,
    wikidataId:
      hosRow?.countryWikidataId ?? hogRow?.countryWikidataId ?? null,
  }

  const response: LeadersResponse = {
    country,
    headOfState: hosRow?.leader ?? null,
    headOfGovernment,
  }

  const cacheControl =
    process.env.NODE_ENV === "production"
      ? "public, s-maxage=86400, stale-while-revalidate=604800"
      : "no-store"

  return NextResponse.json(response, {
    headers: { "Cache-Control": cacheControl },
  })
}
