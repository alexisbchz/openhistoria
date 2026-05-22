import { describe, expect, it } from "vitest"

import {
  fetchCountryData,
  type FetchedCountryData,
} from "../src/country-data"

const NETWORK_TIMEOUT_MS = 30_000

const CASES: Array<{
  code: string
  alpha3: string
  nameIncludes: string
  capital: string
  region: string
  minPopulation: number
}> = [
  {
    code: "FR",
    alpha3: "FRA",
    nameIncludes: "France",
    capital: "Paris",
    region: "Europe",
    minPopulation: 60_000_000,
  },
  {
    code: "DE",
    alpha3: "DEU",
    nameIncludes: "Germany",
    capital: "Berlin",
    region: "Europe",
    minPopulation: 70_000_000,
  },
  {
    code: "US",
    alpha3: "USA",
    nameIncludes: "United States",
    capital: "Washington",
    region: "Americas",
    minPopulation: 300_000_000,
  },
  {
    code: "JP",
    alpha3: "JPN",
    nameIncludes: "Japan",
    capital: "Tokyo",
    region: "Asia",
    minPopulation: 100_000_000,
  },
  {
    code: "BR",
    alpha3: "BRA",
    nameIncludes: "Brazil",
    capital: "Brasília",
    region: "Americas",
    minPopulation: 180_000_000,
  },
  {
    code: "IN",
    alpha3: "IND",
    nameIncludes: "India",
    capital: "New Delhi",
    region: "Asia",
    minPopulation: 1_000_000_000,
  },
]

const currentYear = new Date().getUTCFullYear()

function assertReasonableValue(
  data: FetchedCountryData,
  pickValue: (d: FetchedCountryData) => { value: number; year: number } | null,
  bounds: { min: number; max: number; label: string }
) {
  const fetched = pickValue(data)
  // World Bank values can be missing for some countries / years — that's OK,
  // but if present they should be inside the sane bounds.
  if (fetched == null) return
  expect(
    fetched.value,
    `${data.name} ${bounds.label} = ${fetched.value} (year ${fetched.year})`
  ).toBeGreaterThanOrEqual(bounds.min)
  expect(
    fetched.value,
    `${data.name} ${bounds.label} = ${fetched.value} (year ${fetched.year})`
  ).toBeLessThanOrEqual(bounds.max)
  expect(fetched.year).toBeGreaterThanOrEqual(currentYear - 12)
  expect(fetched.year).toBeLessThanOrEqual(currentYear)
}

describe("fetchCountryData (integration)", () => {
  it.concurrent.each(CASES)(
    "returns reasonable data for $code ($nameIncludes)",
    async (testCase) => {
      const data = await fetchCountryData(testCase.code)

      expect(data.code).toBe(testCase.code)
      expect(data.alpha3).toBe(testCase.alpha3)
      expect(data.name).toContain(testCase.nameIncludes)
      expect(data.capital).toContain(testCase.capital)
      expect(data.region).toBe(testCase.region)
      expect(data.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/)

      expect(data.demographics.population).not.toBeNull()
      expect(data.demographics.population!.value).toBeGreaterThanOrEqual(
        testCase.minPopulation
      )

      // GDP must be present and plausible.
      expect(data.economy.gdpUsd).not.toBeNull()
      expect(data.economy.gdpUsd!.value).toBeGreaterThan(0)

      // Range sanity checks (skip when an indicator is unavailable).
      assertReasonableValue(data, (d) => d.demographics.lifeExpectancy, {
        min: 40,
        max: 95,
        label: "life expectancy",
      })
      assertReasonableValue(data, (d) => d.demographics.urbanizationPct, {
        min: 0,
        max: 100,
        label: "urbanization",
      })
      assertReasonableValue(data, (d) => d.demographics.birthRatePer1000, {
        min: 4,
        max: 60,
        label: "birth rate",
      })
      assertReasonableValue(data, (d) => d.demographics.deathRatePer1000, {
        min: 2,
        max: 30,
        label: "death rate",
      })
      assertReasonableValue(data, (d) => d.economy.unemploymentPct, {
        min: 0,
        max: 50,
        label: "unemployment",
      })
      assertReasonableValue(data, (d) => d.economy.inflationPct, {
        min: -10,
        max: 500,
        label: "inflation",
      })
      assertReasonableValue(data, (d) => d.economy.publicDebtPctGdp, {
        min: 0,
        max: 400,
        label: "public debt / GDP",
      })
      assertReasonableValue(data, (d) => d.economy.gdpPerCapitaUsd, {
        min: 100,
        max: 250_000,
        label: "GDP per capita",
      })
    },
    NETWORK_TIMEOUT_MS
  )

  it(
    "accepts alpha-3 codes",
    async () => {
      const data = await fetchCountryData("FRA")
      expect(data.code).toBe("FR")
      expect(data.alpha3).toBe("FRA")
      expect(data.name).toContain("France")
    },
    NETWORK_TIMEOUT_MS
  )

  it(
    "normalizes lowercase input",
    async () => {
      const data = await fetchCountryData("de")
      expect(data.code).toBe("DE")
      expect(data.name).toContain("Germany")
    },
    NETWORK_TIMEOUT_MS
  )

  it("rejects malformed codes", async () => {
    await expect(fetchCountryData("ZZZZ")).rejects.toThrow(/Invalid country code/)
    await expect(fetchCountryData("1")).rejects.toThrow(/Invalid country code/)
    await expect(fetchCountryData("")).rejects.toThrow(/Invalid country code/)
  })

  it(
    "throws for unknown but well-formed codes",
    async () => {
      await expect(fetchCountryData("ZZ")).rejects.toThrow(/not found/i)
    },
    NETWORK_TIMEOUT_MS
  )

  it("uses injected fetch implementation", async () => {
    const calls: string[] = []
    const fakeFetch: typeof fetch = async (input) => {
      const url =
        typeof input === "string" ? input : (input as URL | Request).toString()
      calls.push(url)
      if (url.includes("restcountries.com")) {
        return new Response(
          JSON.stringify([
            {
              name: { common: "Testland", official: "The Republic of Testland" },
              cca2: "TT",
              cca3: "TST",
              capital: ["Testville"],
              region: "Test",
              subregion: "Inner Test",
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      }
      // World Bank: one row with a recent value
      return new Response(
        JSON.stringify([
          { page: 1, pages: 1, per_page: 100, total: 1 },
          [{ value: 1234, date: String(currentYear - 1) }],
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    }

    const data = await fetchCountryData("TT", { fetchImpl: fakeFetch })
    expect(data.name).toBe("Testland")
    expect(data.capital).toBe("Testville")
    expect(data.demographics.population?.value).toBe(1234)
    expect(data.economy.gdpUsd?.value).toBe(1234)
    expect(calls.some((u) => u.includes("restcountries.com"))).toBe(true)
    expect(calls.some((u) => u.includes("worldbank.org"))).toBe(true)
  })
})
