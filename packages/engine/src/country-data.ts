/**
 * Reusable country data fetcher.
 *
 * Pulls demographic and economic indicators from the World Bank API and
 * country basics (capital, region, official name) from REST Countries.
 *
 * - World Bank API: https://api.worldbank.org/v2 (free, CORS-friendly, no auth)
 * - REST Countries:  https://restcountries.com/v3.1 (free, CORS-friendly, no auth)
 *
 * The fetcher accepts any ISO 3166-1 alpha-2 or alpha-3 code. Each indicator
 * is returned with the year it represents so callers can judge freshness.
 * If a single indicator fails or is missing, that field is `null` but the
 * overall fetch still succeeds.
 */

const WB_BASE = "https://api.worldbank.org/v2"
const RC_BASE = "https://restcountries.com/v3.1"

const WB_INDICATORS = {
  population: "SP.POP.TOTL",
  gdpUsd: "NY.GDP.MKTP.CD",
  gdpPerCapitaUsd: "NY.GDP.PCAP.CD",
  lifeExpectancy: "SP.DYN.LE00.IN",
  urbanizationPct: "SP.URB.TOTL.IN.ZS",
  unemploymentPct: "SL.UEM.TOTL.ZS",
  inflationPct: "FP.CPI.TOTL.ZG",
  publicDebtPctGdp: "GC.DOD.TOTL.GD.ZS",
  birthRatePer1000: "SP.DYN.CBRT.IN",
  deathRatePer1000: "SP.DYN.CDRT.IN",
} as const

type WBField = keyof typeof WB_INDICATORS

export interface FetchedValue {
  value: number
  year: number
}

export interface FetchedCountryData {
  code: string
  alpha3: string
  name: string
  officialName: string
  capital: string | null
  region: string | null
  subregion: string | null
  demographics: {
    population: FetchedValue | null
    birthRatePer1000: FetchedValue | null
    deathRatePer1000: FetchedValue | null
    lifeExpectancy: FetchedValue | null
    urbanizationPct: FetchedValue | null
  }
  economy: {
    gdpUsd: FetchedValue | null
    gdpPerCapitaUsd: FetchedValue | null
    unemploymentPct: FetchedValue | null
    inflationPct: FetchedValue | null
    publicDebtPctGdp: FetchedValue | null
  }
  asOf: string
}

export interface FetchCountryDataOptions {
  fetchImpl?: typeof fetch
  signal?: AbortSignal
  /** Number of years back to query World Bank (default 8). */
  yearsBack?: number
}

interface RestCountryRow {
  name: { common: string; official: string }
  cca2: string
  cca3: string
  capital?: string[]
  region?: string
  subregion?: string
}

async function fetchRestCountries(
  code: string,
  options: FetchCountryDataOptions
): Promise<RestCountryRow | null> {
  const fetchFn = options.fetchImpl ?? fetch
  const url = `${RC_BASE}/alpha/${encodeURIComponent(code)}?fields=name,capital,cca2,cca3,region,subregion`
  const res = await fetchFn(url, { signal: options.signal })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`REST Countries returned ${res.status} for ${code}`)
  }
  const body = (await res.json()) as RestCountryRow | RestCountryRow[]
  if (Array.isArray(body)) return body[0] ?? null
  return body
}

async function fetchWorldBankIndicator(
  countryCode: string,
  indicator: string,
  options: FetchCountryDataOptions
): Promise<FetchedValue | null> {
  const fetchFn = options.fetchImpl ?? fetch
  const currentYear = new Date().getUTCFullYear()
  const yearsBack = options.yearsBack ?? 8
  const start = currentYear - yearsBack
  const url = `${WB_BASE}/country/${encodeURIComponent(countryCode)}/indicator/${indicator}?format=json&date=${start}:${currentYear}&per_page=100`

  const res = await fetchFn(url, { signal: options.signal })
  if (!res.ok) {
    throw new Error(
      `World Bank API ${res.status} for ${indicator} (${countryCode})`
    )
  }
  const body = (await res.json()) as unknown
  if (!Array.isArray(body) || body.length < 2) return null
  const rows = body[1] as Array<{ value: number | null; date: string }> | null
  if (!rows) return null

  let best: FetchedValue | null = null
  for (const row of rows) {
    if (row.value == null) continue
    const year = Number(row.date)
    if (!Number.isFinite(year)) continue
    if (!best || year > best.year) {
      best = { value: row.value, year }
    }
  }
  return best
}

export async function fetchCountryData(
  code: string,
  options: FetchCountryDataOptions = {}
): Promise<FetchedCountryData> {
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z]{2,3}$/.test(normalized)) {
    throw new Error(
      `Invalid country code "${code}". Expected ISO 3166-1 alpha-2 (e.g. "FR") or alpha-3 (e.g. "FRA").`
    )
  }

  const indicatorEntries = Object.entries(WB_INDICATORS) as Array<
    [WBField, string]
  >

  const [rc, ...wbResults] = await Promise.all([
    fetchRestCountries(normalized, options),
    ...indicatorEntries.map(([field, indicator]) =>
      fetchWorldBankIndicator(normalized, indicator, options)
        .then((value) => [field, value] as const)
        .catch(() => [field, null] as const)
    ),
  ])

  if (!rc) {
    throw new Error(`Country not found: ${code}`)
  }

  const wb: Partial<Record<WBField, FetchedValue | null>> = {}
  for (const [field, value] of wbResults) {
    wb[field] = value
  }

  return {
    code: rc.cca2,
    alpha3: rc.cca3,
    name: rc.name.common,
    officialName: rc.name.official,
    capital: rc.capital?.[0] ?? null,
    region: rc.region ?? null,
    subregion: rc.subregion ?? null,
    demographics: {
      population: wb.population ?? null,
      birthRatePer1000: wb.birthRatePer1000 ?? null,
      deathRatePer1000: wb.deathRatePer1000 ?? null,
      lifeExpectancy: wb.lifeExpectancy ?? null,
      urbanizationPct: wb.urbanizationPct ?? null,
    },
    economy: {
      gdpUsd: wb.gdpUsd ?? null,
      gdpPerCapitaUsd: wb.gdpPerCapitaUsd ?? null,
      unemploymentPct: wb.unemploymentPct ?? null,
      inflationPct: wb.inflationPct ?? null,
      publicDebtPctGdp: wb.publicDebtPctGdp ?? null,
    },
    asOf: new Date().toISOString(),
  }
}
