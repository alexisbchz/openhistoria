import type { NationCode } from "./game"
import type { ProjectKind } from "./projects"

export interface DecisionSuggestion {
  id: string
  kind: ProjectKind
  title: string
  /** Text that is sent to /api/decide when the player schedules this. */
  prompt: string
  /** One-line description shown under the title. Optional. */
  hint?: string
}

const FR_SUGGESTIONS: DecisionSuggestion[] = [
  // Nuclear
  {
    id: "fr-nuc-epr2-penly",
    kind: "construction:nuclear",
    title: "EPR2 reactor at Penly",
    prompt:
      "Begin construction of a second EPR2 nuclear reactor at the Penly site in Normandy.",
    hint: "Anchors long-term energy sovereignty · 10+ year horizon",
  },
  {
    id: "fr-nuc-smr-marcoule",
    kind: "construction:nuclear",
    title: "Small modular reactor pilot",
    prompt:
      "Pilot a small modular reactor (SMR) program at the Marcoule site in southern France.",
    hint: "Next-gen reactors · 5–7 year horizon",
  },

  // Industrial
  {
    id: "fr-ind-dunkerque-batteries",
    kind: "construction:industrial",
    title: "Battery gigafactory in Dunkerque",
    prompt:
      "Construct a lithium-ion battery gigafactory in Dunkerque to anchor the EV supply chain.",
    hint: "Industrial sovereignty · creates ~3000 jobs",
  },
  {
    id: "fr-ind-toulouse-aerospace",
    kind: "construction:industrial",
    title: "Toulouse aerospace expansion",
    prompt:
      "Expand the Toulouse aerospace cluster with new R&D facilities for next-generation aircraft.",
    hint: "Strategic industry · Airbus ecosystem",
  },

  // Infrastructure
  {
    id: "fr-inf-paris-nice-tgv",
    kind: "construction:infrastructure",
    title: "Paris–Nice high-speed line",
    prompt:
      "Build a TGV high-speed rail line connecting Paris to Nice via the Rhône corridor.",
    hint: "Cuts journey time to under 4 hours",
  },
  {
    id: "fr-inf-marseille-port",
    kind: "construction:infrastructure",
    title: "Marseille-Fos port modernization",
    prompt:
      "Modernize the Port of Marseille-Fos to handle next-generation container shipping.",
    hint: "Mediterranean gateway · CMA CGM hub",
  },

  // Military
  {
    id: "fr-mil-cherbourg-shipyard",
    kind: "construction:military",
    title: "Cherbourg shipyard expansion",
    prompt:
      "Expand the Cherbourg naval shipyard to accelerate Suffren-class submarine production.",
    hint: "Strategic deterrent capacity",
  },
  {
    id: "fr-mil-indopacific-base",
    kind: "construction:military",
    title: "Indo-Pacific forward base",
    prompt:
      "Establish a forward operating base in French Polynesia to project power in the Indo-Pacific.",
    hint: "Overseas footprint",
  },

  // Civilian
  {
    id: "fr-civ-social-housing",
    kind: "construction:civilian",
    title: "Social housing program",
    prompt:
      "Launch a nationwide program to build 100,000 social housing units over five years.",
    hint: "Addresses affordability crisis",
  },
  {
    id: "fr-civ-lyon-hospitals",
    kind: "construction:civilian",
    title: "Lyon hospital renovation",
    prompt:
      "Renovate the Lyon hospital network with modernized ICU and emergency facilities.",
    hint: "Healthcare modernization",
  },

  // Diplomacy
  {
    id: "fr-dip-berlin-visit",
    kind: "diplomacy",
    title: "State visit to Berlin",
    prompt:
      "Conduct a state visit to Berlin to reaffirm the Franco-German axis and coordinate EU policy.",
    hint: "Reinforces EU leadership",
  },
  {
    id: "fr-dip-eu-africa-summit",
    kind: "diplomacy",
    title: "EU–Africa summit",
    prompt:
      "Host a EU–Africa trade and security summit in Paris with heads of state from the African Union.",
    hint: "Continental partnership",
  },

  // Economy
  {
    id: "fr-eco-station-f-boost",
    kind: "economic",
    title: "Startup capital injection",
    prompt:
      "Inject sovereign capital into the Station F startup ecosystem to scale homegrown deep-tech companies.",
    hint: "Tech sovereignty",
  },
  {
    id: "fr-eco-sme-tax-cut",
    kind: "economic",
    title: "Industrial SME tax relief",
    prompt:
      "Enact a targeted tax cut for small and mid-size industrial manufacturers reshoring production.",
    hint: "Reshoring incentive",
  },

  // Other
  {
    id: "fr-oth-civic-service",
    kind: "other",
    title: "Universal civic service",
    prompt:
      "Establish a mandatory three-month civic service program for all 18-year-olds focused on national cohesion.",
    hint: "Generational reform",
  },
  {
    id: "fr-oth-pension-reform",
    kind: "other",
    title: "Pension reform",
    prompt:
      "Initiate a pension reform raising the standard retirement age to 65, with hardship exemptions.",
    hint: "Politically risky · approval cost",
  },
]

const BY_NATION: Partial<Record<NationCode, DecisionSuggestion[]>> = {
  FR: FR_SUGGESTIONS,
}

export function getSuggestionsForNation(
  nation: NationCode
): DecisionSuggestion[] {
  return BY_NATION[nation] ?? []
}

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  "construction:nuclear": "Nuclear",
  "construction:industrial": "Industrial",
  "construction:infrastructure": "Infrastructure",
  "construction:military": "Defense",
  "construction:civilian": "Civilian",
  diplomacy: "Diplomacy",
  economic: "Economy",
  other: "Other",
}
