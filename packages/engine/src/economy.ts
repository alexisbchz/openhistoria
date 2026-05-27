import type { CountryStats } from "./country-stats"
import type { Project } from "./projects"

const DAYS_PER_YEAR = 365.25
const MS_PER_DAY = 86_400_000

export interface EconomyTickInput {
  date: Date
  treasury: number
  approval: number
  stats: CountryStats
  projects: readonly Project[]
}

export interface EconomyTickResult {
  treasury: number
  approval: number
  stats: CountryStats
  dailyRevenue: number
  dailyExpenses: number
}

export interface CashflowSummary {
  annualRevenue: number
  annualExpenses: number
  projectMonthlyCost: number
  annualBalance: number
  monthlyBalance: number
}

const REVENUE_PCT_OF_GDP = 0.013
const BASELINE_EXPENSES_PCT_OF_GDP = 0.009
const UNEMPLOYMENT_COST_PER_POINT_PCT_OF_GDP = 0.0006
const APPROVAL_BASELINE = 35
const APPROVAL_DRIFT_PER_DAY = 0.08
const TREASURY_PENALTY_THRESHOLD = -20_000
const TREASURY_PENALTY_PER_DAY = 0.05
// Treasury floor at -€2T to keep arithmetic well-defined; below that we just
// stop accumulating losses (the game-over check in Game will have fired well
// before this is reached).
const TREASURY_FLOOR = -2_000_000
const GDP_FLOOR = 1_000_000_000 // $1B — keeps per-capita math finite

export function getCashflow(
  stats: CountryStats,
  projects: readonly Project[]
): CashflowSummary {
  const gdpMillions = stats.economy.gdpUsd / 1_000_000
  const revenue = gdpMillions * REVENUE_PCT_OF_GDP
  const baselineSpending = gdpMillions * BASELINE_EXPENSES_PCT_OF_GDP
  const unemploymentCost =
    gdpMillions *
    UNEMPLOYMENT_COST_PER_POINT_PCT_OF_GDP *
    Math.max(0, stats.economy.unemploymentPct - 5)
  const projectMonthly = projects.reduce((sum, p) => sum + p.monthlyCost, 0)
  const projectAnnual = projectMonthly * 12
  const annualExpenses = baselineSpending + unemploymentCost + projectAnnual
  const annualBalance = revenue - annualExpenses
  return {
    annualRevenue: revenue,
    annualExpenses,
    projectMonthlyCost: projectMonthly,
    annualBalance,
    monthlyBalance: annualBalance / 12,
  }
}

export function applyEconomyTick(
  input: EconomyTickInput,
  days: number
): EconomyTickResult {
  if (days <= 0) {
    return {
      treasury: input.treasury,
      approval: input.approval,
      stats: input.stats,
      dailyRevenue: 0,
      dailyExpenses: 0,
    }
  }
  const cashflow = getCashflow(input.stats, input.projects)
  const dailyRevenue = cashflow.annualRevenue / DAYS_PER_YEAR
  const dailyExpenses = cashflow.annualExpenses / DAYS_PER_YEAR
  const dailyBalance = dailyRevenue - dailyExpenses
  let treasury = safeNumber(
    input.treasury + dailyBalance * days,
    input.treasury
  )
  if (treasury < TREASURY_FLOOR) treasury = TREASURY_FLOOR

  let approval = driftApproval(input.approval, days)
  if (treasury < TREASURY_PENALTY_THRESHOLD) {
    // Penalty scales with depth so a runaway deficit actually hurts.
    const depth = (TREASURY_PENALTY_THRESHOLD - treasury) / 100_000
    const penalty = TREASURY_PENALTY_PER_DAY * (1 + Math.min(3, depth)) * days
    approval = clampApproval(approval - penalty)
  }

  const stats = drift(input.stats, days)

  return { treasury, approval, stats, dailyRevenue, dailyExpenses }
}

function driftApproval(approval: number, days: number): number {
  const delta = (APPROVAL_BASELINE - approval) * APPROVAL_DRIFT_PER_DAY * 0.01 * days
  return clampApproval(approval + delta)
}

function clampApproval(v: number): number {
  return Math.max(0, Math.min(100, v))
}

function drift(stats: CountryStats, days: number): CountryStats {
  const yearsFraction = clamp(days / DAYS_PER_YEAR, -50, 50)
  const economy = { ...stats.economy }
  const rawGdp = economy.gdpUsd * Math.pow(1 + 0.013, yearsFraction)
  economy.gdpUsd = Math.max(GDP_FLOOR, safeNumber(rawGdp, economy.gdpUsd))
  const pop = Math.max(1, stats.demographics.population)
  economy.gdpPerCapitaUsd = safeNumber(
    economy.gdpUsd / pop,
    economy.gdpPerCapitaUsd
  )
  economy.inflationPct = clamp(
    safeNumber(
      economy.inflationPct + (2 - economy.inflationPct) * 0.05 * yearsFraction,
      economy.inflationPct
    ),
    0,
    20
  )
  economy.unemploymentPct = clamp(
    safeNumber(
      economy.unemploymentPct +
        (7 - economy.unemploymentPct) * 0.04 * yearsFraction,
      economy.unemploymentPct
    ),
    2,
    25
  )
  const demographics = { ...stats.demographics }
  const natural =
    (stats.demographics.birthRatePer1000 - stats.demographics.deathRatePer1000) /
    1000
  const nextPop = Math.round(
    safeNumber(
      stats.demographics.population * (1 + natural * yearsFraction),
      stats.demographics.population
    )
  )
  demographics.population = Math.max(1, nextPop)
  return { ...stats, economy, demographics, asOf: stats.asOf }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function safeNumber(v: number, fallback: number): number {
  if (Number.isFinite(v)) return v
  return fallback
}

/**
 * Returns a sanitised stats object: any NaN/Infinity values are replaced with
 * the matching value from `fallback` (typically the previous tick's stats or
 * the initial-stats record). Called whenever stats cross a trust boundary
 * (load from storage, after applyEffects, etc.).
 */
export function sanitizeStats(
  stats: CountryStats,
  fallback: CountryStats
): CountryStats {
  return {
    ...stats,
    economy: {
      gdpUsd: Math.max(
        GDP_FLOOR,
        safeNumber(stats.economy.gdpUsd, fallback.economy.gdpUsd)
      ),
      gdpPerCapitaUsd: safeNumber(
        stats.economy.gdpPerCapitaUsd,
        fallback.economy.gdpPerCapitaUsd
      ),
      unemploymentPct: clamp(
        safeNumber(
          stats.economy.unemploymentPct,
          fallback.economy.unemploymentPct
        ),
        0,
        100
      ),
      inflationPct: clamp(
        safeNumber(stats.economy.inflationPct, fallback.economy.inflationPct),
        -50,
        100
      ),
      publicDebtPctGdp: clamp(
        safeNumber(
          stats.economy.publicDebtPctGdp,
          fallback.economy.publicDebtPctGdp
        ),
        0,
        1000
      ),
    },
    demographics: {
      ...stats.demographics,
      population: Math.max(
        1,
        Math.round(
          safeNumber(
            stats.demographics.population,
            fallback.demographics.population
          )
        )
      ),
    },
  }
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_DAY
}
