import { getSuggestionsForNation, type NationCode } from "@workspace/engine"
import { z } from "zod"

import { describeLlmError, runLlmObject } from "../llm-utils"

const projectKindEnum = z.enum([
  "construction:nuclear",
  "construction:industrial",
  "construction:infrastructure",
  "construction:military",
  "construction:civilian",
  "diplomacy",
  "economic",
  "other",
])

const suggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        kind: projectKindEnum,
        title: z
          .string()
          .min(3)
          .max(48)
          .describe(
            "Short card label (3–6 words, like a headline). Must NOT be a prefix of the prompt. Capitalize like a title."
          ),
        prompt: z
          .string()
          .min(15)
          .max(220)
          .describe(
            "Self-contained directive the player will send to /api/decide. Single sentence, complete (do not run off mid-clause), anchored at a real city or region when applicable. Plain prose, no markdown."
          ),
        hint: z
          .string()
          .max(80)
          .optional()
          .describe("Optional one-line context shown under the title."),
      })
    )
    .min(3)
    .max(3),
})

const reformAgendaEnum = z.enum([
  "fiscal_discipline",
  "european_leadership",
  "social_renewal",
])

const requestSchema = z.object({
  nation: z.string(),
  date: z.string(),
  treasury: z.number(),
  approval: z.number(),
  reformAgenda: reformAgendaEnum.nullable().optional(),
  recentBriefings: z.array(z.string()).max(8).optional(),
})

const AGENDA_KIND_BIAS: Record<
  z.infer<typeof reformAgendaEnum>,
  string[]
> = {
  fiscal_discipline: ["economic", "construction:industrial", "diplomacy"],
  european_leadership: [
    "diplomacy",
    "construction:military",
    "construction:infrastructure",
  ],
  social_renewal: [
    "construction:civilian",
    "construction:infrastructure",
    "economic",
  ],
}

const AGENDA_HINTS: Record<z.infer<typeof reformAgendaEnum>, string> = {
  fiscal_discipline:
    "Player's reform agenda is FISCAL DISCIPLINE — favour deficit-friendly decisions (reforms, exports, tax-base broadening).",
  european_leadership:
    "Player's reform agenda is EUROPEAN LEADERSHIP — favour EU-facing diplomatic and joint-infrastructure decisions.",
  social_renewal:
    "Player's reform agenda is SOCIAL RENEWAL — favour decisions that visibly reduce unemployment or strengthen public services.",
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 })
  }
  const ctx = parsed.data

  const apiKey = process.env.OPENROUTER_API_KEY
  // No API key: silently fall back to the curated offline suggestions so the
  // panel still works in local dev / when the key is unset.
  if (!apiKey) {
    return Response.json({
      suggestions: offlineSuggestions(ctx.nation, ctx.reformAgenda ?? null),
      fallback: "no_api_key",
    })
  }

  const systemText = [
    "You are a strategy game assistant.",
    "Suggest exactly 3 distinct decisions a head of state could issue right now,",
    "tailored to the nation's current situation (treasury, approval, recent events).",
    "STRICT: the three suggestions MUST use three different kinds — never repeat a kind.",
    "Pick from: construction:nuclear, construction:industrial, construction:infrastructure,",
    "construction:military, construction:civilian, diplomacy, economic, other.",
    "Each prompt must be a single complete sentence (subject + verb + object), not a fragment.",
    "Each suggestion must reference a real city, region, or institution when applicable.",
    "Avoid generic phrasing.",
    ctx.reformAgenda ? AGENDA_HINTS[ctx.reformAgenda] : "",
  ]
    .filter(Boolean)
    .join(" ")

  const userText = [
    `Nation: ${ctx.nation}`,
    `In-game date: ${ctx.date}`,
    `Treasury: €${Math.round(ctx.treasury).toLocaleString()}M`,
    `Approval: ${ctx.approval.toFixed(0)}%`,
    ctx.recentBriefings && ctx.recentBriefings.length > 0
      ? `Recent events:\n- ${ctx.recentBriefings.join("\n- ")}`
      : "Recent events: (none)",
  ].join("\n")

  const result = await runLlmObject({
    apiKey,
    schema: suggestionsSchema,
    system: systemText,
    prompt: userText,
    modelId: process.env.OPENROUTER_MODEL || undefined,
  })
  return result.match(
    (object) => Response.json({ suggestions: object.suggestions }),
    // Hand back the curated offline list rather than a 502; the player still
    // gets a functional decisions panel.
    (error) =>
      Response.json({
        suggestions: offlineSuggestions(ctx.nation, ctx.reformAgenda ?? null),
        fallback: "llm_unavailable",
        error: describeLlmError(error),
      })
  )
}

function offlineSuggestions(
  nationRaw: string,
  agenda: z.infer<typeof reformAgendaEnum> | null
) {
  const nation = nationRaw.trim().toUpperCase() as NationCode
  const all = getSuggestionsForNation(nation)
  // Order by agenda preference, then first-match-per-kind.
  const preferred = agenda ? AGENDA_KIND_BIAS[agenda] : []
  const sorted = [...all].sort(
    (a, b) =>
      preferredIndex(preferred, a.kind) - preferredIndex(preferred, b.kind)
  )
  const out: { kind: string; title: string; prompt: string; hint?: string }[] = []
  const seenKinds = new Set<string>()
  for (const s of sorted) {
    if (seenKinds.has(s.kind)) continue
    seenKinds.add(s.kind)
    out.push({ kind: s.kind, title: s.title, prompt: s.prompt, hint: s.hint })
    if (out.length === 3) break
  }
  while (out.length < 3 && sorted.length > 0) {
    const filler = sorted[out.length % sorted.length]!
    out.push({
      kind: filler.kind,
      title: filler.title,
      prompt: filler.prompt,
      hint: filler.hint,
    })
  }
  return out
}

function preferredIndex(preferred: string[], kind: string): number {
  const i = preferred.indexOf(kind)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}
