import type { NationCode } from "./game"

export interface Demographics {
  population: number
  medianAge: number
  birthRatePer1000: number
  deathRatePer1000: number
  lifeExpectancy: number
  urbanizationPct: number
}

export interface Economy {
  gdpUsd: number
  gdpPerCapitaUsd: number
  unemploymentPct: number
  inflationPct: number
  publicDebtPctGdp: number
}

export interface Government {
  type: string
  headOfState: string
  headOfGovernment: string
  capital: string
}

export interface CountryStats {
  code: NationCode
  name: string
  asOf: string
  demographics: Demographics
  economy: Economy
  government: Government
}

const INITIAL_STATS: Record<NationCode, CountryStats> = {
  FR: {
    code: "FR",
    name: "France",
    asOf: "2026-01-01",
    demographics: {
      population: 68_400_000,
      medianAge: 42.3,
      birthRatePer1000: 10.4,
      deathRatePer1000: 9.5,
      lifeExpectancy: 82.7,
      urbanizationPct: 81.5,
    },
    economy: {
      gdpUsd: 3_130_000_000_000,
      gdpPerCapitaUsd: 45_760,
      unemploymentPct: 7.3,
      inflationPct: 2.1,
      publicDebtPctGdp: 112.0,
    },
    government: {
      type: "Semi-presidential republic",
      headOfState: "Emmanuel Macron",
      headOfGovernment: "Sébastien Lecornu",
      capital: "Paris",
    },
  },
}

export class CountryStatsProvider {
  async fetch(code: NationCode): Promise<CountryStats> {
    const stats = INITIAL_STATS[code]
    if (!stats) {
      throw new Error(`No initial stats available for nation: ${code}`)
    }
    return structuredClone(stats)
  }

  fetchSync(code: NationCode): CountryStats {
    const stats = INITIAL_STATS[code]
    if (!stats) {
      throw new Error(`No initial stats available for nation: ${code}`)
    }
    return structuredClone(stats)
  }

  has(code: NationCode): boolean {
    return code in INITIAL_STATS
  }
}
