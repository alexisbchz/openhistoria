import type { NationCode } from "./game"
import type { ProjectKind } from "./projects"

export interface Minister {
  id: string
  role: string
  name: string
  party: string
  portfolio: string
  bonus?: MinisterBonus
}

/**
 * What each minister actually does in the simulation. All bonuses are
 * always-on as long as the minister is in the cabinet — there is no firing
 * mechanic yet, so the default cabinet's effects apply continuously. Each
 * bonus is intentionally small and transparent.
 */
export interface MinisterBonus {
  /** Multiplier applied to the approval cost of bond issuance (default 1). */
  bondApprovalMultiplier?: number
  /** Multiplier applied to the debt-pp cost of bond issuance (default 1). */
  bondDebtMultiplier?: number
  /** Extra approval gained when a project of one of these kinds completes. */
  projectCompletionApprovalBonus?: { kinds: ProjectKind[]; delta: number }
  /** Extra approval drift per day toward the baseline (in addition to the engine default). */
  approvalDriftPerDay?: number
  /** Daily approval direct injection (positive or negative). */
  approvalPerDay?: number
  /** Treasury floor "warning" threshold buffer added (positive widens grace). */
  bankruptcyBufferDays?: number
  /** Opinion-drift multiplier (1.0 = engine default). */
  diplomacyDriftMultiplier?: number
}

const FR_CABINET: Minister[] = [
  {
    id: "pm",
    role: "Prime Minister",
    name: "Sébastien Lecornu",
    party: "Renaissance",
    portfolio: "Coordinates government, sets legislative agenda.",
    bonus: {
      approvalPerDay: 0.01,
      // Half a day extra grace before the impeachment counter trips reads as
      // not enough to matter; we shape this through the drift bonus instead.
      approvalDriftPerDay: 0.01,
    },
  },
  {
    id: "finance",
    role: "Minister of Economy & Finance",
    name: "Antoine Armand",
    party: "Renaissance",
    portfolio: "Budget, taxes, public debt, industrial policy.",
    bonus: {
      bondApprovalMultiplier: 0.75,
      bondDebtMultiplier: 0.9,
    },
  },
  {
    id: "interior",
    role: "Minister of the Interior",
    name: "Bruno Retailleau",
    party: "Les Républicains",
    portfolio: "Public order, immigration, local governance.",
    bonus: {
      // Public-order minister: a slight passive approval lift, real but small.
      approvalPerDay: 0.005,
    },
  },
  {
    id: "foreign",
    role: "Minister for Europe & Foreign Affairs",
    name: "Jean-Noël Barrot",
    party: "MoDem",
    portfolio: "Diplomacy, EU policy, treaty negotiations.",
    bonus: {
      diplomacyDriftMultiplier: 1.3,
    },
  },
  {
    id: "defence",
    role: "Minister of Armed Forces",
    name: "Sébastien Lecornu",
    party: "Renaissance",
    portfolio: "Defence procurement, OPEX, nuclear deterrent.",
    bonus: {
      projectCompletionApprovalBonus: {
        kinds: ["construction:military", "construction:nuclear"],
        delta: 1,
      },
    },
  },
  {
    id: "justice",
    role: "Minister of Justice",
    name: "Didier Migaud",
    party: "Independent",
    portfolio: "Courts, prisons, judicial reform.",
    bonus: {},
  },
  {
    id: "labour",
    role: "Minister of Labour & Health",
    name: "Astrid Panosyan-Bouvet",
    party: "Renaissance",
    portfolio: "Pensions, employment, public health.",
    bonus: {
      projectCompletionApprovalBonus: {
        kinds: ["construction:civilian"],
        delta: 1,
      },
    },
  },
  {
    id: "ecology",
    role: "Minister of Ecological Transition",
    name: "Agnès Pannier-Runacher",
    party: "Renaissance",
    portfolio: "Energy, climate, biodiversity.",
    bonus: {
      projectCompletionApprovalBonus: {
        kinds: ["construction:infrastructure"],
        delta: 1,
      },
    },
  },
]

const REGISTRY: Record<NationCode, Minister[]> = {
  FR: FR_CABINET,
}

export function listMinisters(nation: NationCode): Minister[] {
  return (REGISTRY[nation] ?? []).map((m) => ({
    ...m,
    bonus: m.bonus ? { ...m.bonus } : undefined,
  }))
}

/** Aggregated bonuses for the given nation's cabinet. Cheap to call. */
export interface CabinetEffects {
  bondApprovalMultiplier: number
  bondDebtMultiplier: number
  approvalDriftPerDay: number
  approvalPerDay: number
  diplomacyDriftMultiplier: number
  projectCompletionApprovalBonusByKind: Partial<Record<ProjectKind, number>>
}

const NEUTRAL: CabinetEffects = {
  bondApprovalMultiplier: 1,
  bondDebtMultiplier: 1,
  approvalDriftPerDay: 0,
  approvalPerDay: 0,
  diplomacyDriftMultiplier: 1,
  projectCompletionApprovalBonusByKind: {},
}

export function getCabinetEffects(nation: NationCode): CabinetEffects {
  const ministers = REGISTRY[nation]
  if (!ministers) return NEUTRAL
  const out: CabinetEffects = {
    bondApprovalMultiplier: 1,
    bondDebtMultiplier: 1,
    approvalDriftPerDay: 0,
    approvalPerDay: 0,
    diplomacyDriftMultiplier: 1,
    projectCompletionApprovalBonusByKind: {},
  }
  for (const m of ministers) {
    const b = m.bonus
    if (!b) continue
    if (b.bondApprovalMultiplier != null) {
      out.bondApprovalMultiplier *= b.bondApprovalMultiplier
    }
    if (b.bondDebtMultiplier != null) {
      out.bondDebtMultiplier *= b.bondDebtMultiplier
    }
    if (b.approvalDriftPerDay) {
      out.approvalDriftPerDay += b.approvalDriftPerDay
    }
    if (b.approvalPerDay) {
      out.approvalPerDay += b.approvalPerDay
    }
    if (b.diplomacyDriftMultiplier != null) {
      out.diplomacyDriftMultiplier *= b.diplomacyDriftMultiplier
    }
    if (b.projectCompletionApprovalBonus) {
      for (const kind of b.projectCompletionApprovalBonus.kinds) {
        const prev =
          out.projectCompletionApprovalBonusByKind[kind] ?? 0
        out.projectCompletionApprovalBonusByKind[kind] =
          prev + b.projectCompletionApprovalBonus.delta
      }
    }
  }
  return out
}
