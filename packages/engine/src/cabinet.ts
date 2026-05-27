import type { NationCode } from "./game"
import type { ProjectKind } from "./projects"

export interface Minister {
  /** Unique candidate id, e.g. "fr-finance-armand". */
  id: string
  /** Role slot, e.g. "finance". Multiple candidates share the same roleId. */
  roleId: string
  /** Display label for the role. */
  role: string
  name: string
  party: string
  portfolio: string
  bonus?: MinisterBonus
}

/**
 * What each minister actually does in the simulation. Bonuses are
 * always-on for whichever candidate is currently appointed to the role.
 */
export interface MinisterBonus {
  bondApprovalMultiplier?: number
  bondDebtMultiplier?: number
  projectCompletionApprovalBonus?: { kinds: ProjectKind[]; delta: number }
  approvalDriftPerDay?: number
  approvalPerDay?: number
  bankruptcyBufferDays?: number
  diplomacyDriftMultiplier?: number
  /**
   * Multiplier on the deficit / treasury-penalty piece of approval drift; <1
   * dampens, >1 amplifies. Hooks through getCabinetEffects.
   */
  treasuryPenaltyMultiplier?: number
}

const FR_CABINET: Minister[] = [
  // Prime Minister candidates
  {
    id: "fr-pm-lecornu",
    roleId: "pm",
    role: "Prime Minister",
    name: "Sébastien Lecornu",
    party: "Renaissance",
    portfolio: "Coordinates government, sets legislative agenda.",
    bonus: { approvalPerDay: 0.01, approvalDriftPerDay: 0.01 },
  },
  {
    id: "fr-pm-attal",
    roleId: "pm",
    role: "Prime Minister",
    name: "Gabriel Attal",
    party: "Renaissance",
    portfolio: "Younger, telegenic — leans into media wins.",
    bonus: { approvalPerDay: 0.02 },
  },
  // Finance candidates
  {
    id: "fr-finance-armand",
    roleId: "finance",
    role: "Minister of Economy & Finance",
    name: "Antoine Armand",
    party: "Renaissance",
    portfolio: "Budget, taxes, public debt, industrial policy.",
    bonus: { bondApprovalMultiplier: 0.75, bondDebtMultiplier: 0.9 },
  },
  {
    id: "fr-finance-lemaire",
    roleId: "finance",
    role: "Minister of Economy & Finance",
    name: "Bruno Le Maire",
    party: "Renaissance",
    portfolio: "Veteran finance hand; growth-first, deficit-tolerant.",
    bonus: {
      bondApprovalMultiplier: 0.9,
      bondDebtMultiplier: 1,
      projectCompletionApprovalBonus: {
        kinds: ["economic", "construction:industrial"],
        delta: 1,
      },
    },
  },
  // Interior candidates
  {
    id: "fr-interior-retailleau",
    roleId: "interior",
    role: "Minister of the Interior",
    name: "Bruno Retailleau",
    party: "Les Républicains",
    portfolio: "Public order, immigration, local governance.",
    bonus: { approvalPerDay: 0.005 },
  },
  {
    id: "fr-interior-darmanin",
    roleId: "interior",
    role: "Minister of the Interior",
    name: "Gérald Darmanin",
    party: "Renaissance",
    portfolio: "Operationally aggressive; trades EU goodwill for order.",
    bonus: {
      approvalPerDay: 0.012,
      diplomacyDriftMultiplier: 0.85,
    },
  },
  // Foreign affairs candidates
  {
    id: "fr-foreign-barrot",
    roleId: "foreign",
    role: "Minister for Europe & Foreign Affairs",
    name: "Jean-Noël Barrot",
    party: "MoDem",
    portfolio: "Diplomacy, EU policy, treaty negotiations.",
    bonus: { diplomacyDriftMultiplier: 1.3 },
  },
  {
    id: "fr-foreign-colonna",
    roleId: "foreign",
    role: "Minister for Europe & Foreign Affairs",
    name: "Catherine Colonna",
    party: "Independent",
    portfolio: "Veteran ambassador; quieter but unmissed in capitals.",
    bonus: { diplomacyDriftMultiplier: 1.2, approvalPerDay: 0.005 },
  },
  // Defence candidates
  {
    id: "fr-defence-lecornu",
    roleId: "defence",
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
    id: "fr-defence-parly",
    roleId: "defence",
    role: "Minister of Armed Forces",
    name: "Florence Parly",
    party: "Renaissance",
    portfolio: "Past defence minister; tilts toward industrial output.",
    bonus: {
      projectCompletionApprovalBonus: {
        kinds: ["construction:military"],
        delta: 2,
      },
    },
  },
  // Justice candidates
  {
    id: "fr-justice-migaud",
    roleId: "justice",
    role: "Minister of Justice",
    name: "Didier Migaud",
    party: "Independent",
    portfolio: "Courts, prisons, judicial reform.",
    bonus: {},
  },
  {
    id: "fr-justice-dupond-moretti",
    roleId: "justice",
    role: "Minister of Justice",
    name: "Éric Dupond-Moretti",
    party: "Renaissance",
    portfolio: "Ex-prosecutor; combative, useful in scandal cycles.",
    bonus: { approvalPerDay: 0.003 },
  },
  // Labour & Health candidates
  {
    id: "fr-labour-panosyan",
    roleId: "labour",
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
    id: "fr-labour-dussopt",
    roleId: "labour",
    role: "Minister of Labour & Health",
    name: "Olivier Dussopt",
    party: "Renaissance",
    portfolio: "Pension-reform veteran; lowers deficit-penalty impact.",
    bonus: { treasuryPenaltyMultiplier: 0.85 },
  },
  // Ecology candidates
  {
    id: "fr-ecology-pannier-runacher",
    roleId: "ecology",
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
  {
    id: "fr-ecology-rousseau",
    roleId: "ecology",
    role: "Minister of Ecological Transition",
    name: "Sandrine Rousseau",
    party: "EELV",
    portfolio: "Green hardliner; bigger civilian bonus, harder on debt.",
    bonus: {
      projectCompletionApprovalBonus: {
        kinds: ["construction:civilian", "construction:infrastructure"],
        delta: 2,
      },
      bondDebtMultiplier: 1.15,
    },
  },
]

const REGISTRY: Record<NationCode, Minister[]> = {
  FR: FR_CABINET,
}

/**
 * Active minister appointments: map of roleId → candidate id. Anything
 * missing falls back to the first candidate per role.
 */
export type CabinetAppointments = Readonly<Record<string, string>>

function clone(m: Minister): Minister {
  return { ...m, bonus: m.bonus ? { ...m.bonus } : undefined }
}

/** All known candidates for a nation, grouped by role. */
export function listCabinetCandidates(
  nation: NationCode
): { roleId: string; role: string; candidates: Minister[] }[] {
  const all = REGISTRY[nation] ?? []
  const byRole = new Map<string, Minister[]>()
  for (const m of all) {
    const bucket = byRole.get(m.roleId) ?? []
    bucket.push(clone(m))
    byRole.set(m.roleId, bucket)
  }
  return Array.from(byRole.entries()).map(([roleId, candidates]) => ({
    roleId,
    role: candidates[0]!.role,
    candidates,
  }))
}

/** Returns the active appointment per role (one Minister per role slot). */
export function listMinisters(
  nation: NationCode,
  appointments?: CabinetAppointments
): Minister[] {
  const candidates = REGISTRY[nation]
  if (!candidates) return []
  const seenRoles = new Set<string>()
  const out: Minister[] = []
  for (const m of candidates) {
    if (seenRoles.has(m.roleId)) continue
    const chosenId = appointments?.[m.roleId]
    const chosen = chosenId
      ? (candidates.find((c) => c.id === chosenId && c.roleId === m.roleId) ?? m)
      : m
    out.push(clone(chosen))
    seenRoles.add(m.roleId)
  }
  return out
}

/** Returns true iff the given candidate id exists for the nation. */
export function isValidAppointment(
  nation: NationCode,
  roleId: string,
  candidateId: string
): boolean {
  const candidates = REGISTRY[nation] ?? []
  return candidates.some((c) => c.id === candidateId && c.roleId === roleId)
}

export interface CabinetEffects {
  bondApprovalMultiplier: number
  bondDebtMultiplier: number
  approvalDriftPerDay: number
  approvalPerDay: number
  diplomacyDriftMultiplier: number
  treasuryPenaltyMultiplier: number
  projectCompletionApprovalBonusByKind: Partial<Record<ProjectKind, number>>
}

const NEUTRAL: CabinetEffects = {
  bondApprovalMultiplier: 1,
  bondDebtMultiplier: 1,
  approvalDriftPerDay: 0,
  approvalPerDay: 0,
  diplomacyDriftMultiplier: 1,
  treasuryPenaltyMultiplier: 1,
  projectCompletionApprovalBonusByKind: {},
}

export function getCabinetEffects(
  nation: NationCode,
  appointments?: CabinetAppointments
): CabinetEffects {
  const ministers = listMinisters(nation, appointments)
  if (ministers.length === 0) return NEUTRAL
  const out: CabinetEffects = {
    bondApprovalMultiplier: 1,
    bondDebtMultiplier: 1,
    approvalDriftPerDay: 0,
    approvalPerDay: 0,
    diplomacyDriftMultiplier: 1,
    treasuryPenaltyMultiplier: 1,
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
    if (b.treasuryPenaltyMultiplier != null) {
      out.treasuryPenaltyMultiplier *= b.treasuryPenaltyMultiplier
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
