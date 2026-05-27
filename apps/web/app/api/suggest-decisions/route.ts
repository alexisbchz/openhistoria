import { getSuggestionsForNation, type NationCode } from "@workspace/engine"
import { z } from "zod"

import { errorMessage, runLlmObject } from "../llm-utils"

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

const requestSchema = z.object({
  nation: z.string(),
  date: z.string(),
  treasury: z.number(),
  approval: z.number(),
  recentBriefings: z.array(z.string()).max(8).optional(),
})

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
      suggestions: offlineSuggestions(ctx.nation),
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
  ].join(" ")

  const userText = [
    `Nation: ${ctx.nation}`,
    `In-game date: ${ctx.date}`,
    `Treasury: €${Math.round(ctx.treasury).toLocaleString()}M`,
    `Approval: ${ctx.approval.toFixed(0)}%`,
    ctx.recentBriefings && ctx.recentBriefings.length > 0
      ? `Recent events:\n- ${ctx.recentBriefings.join("\n- ")}`
      : "Recent events: (none)",
  ].join("\n")

  try {
    const object = await runLlmObject({
      apiKey,
      schema: suggestionsSchema,
      system: systemText,
      prompt: userText,
      modelId: process.env.OPENROUTER_MODEL || undefined,
    })
    return Response.json({ suggestions: object.suggestions })
  } catch (err) {
    // Hand back the curated offline list rather than a 502; the player still
    // gets a functional decisions panel.
    return Response.json({
      suggestions: offlineSuggestions(ctx.nation),
      fallback: "llm_unavailable",
      error: errorMessage(err, "OpenRouter inference failed"),
    })
  }
}

function offlineSuggestions(nationRaw: string) {
  const nation = nationRaw.trim().toUpperCase() as NationCode
  const all = getSuggestionsForNation(nation)
  // Pick three distinct kinds, picking the first match per kind.
  const out: { kind: string; title: string; prompt: string; hint?: string }[] = []
  const seenKinds = new Set<string>()
  for (const s of all) {
    if (seenKinds.has(s.kind)) continue
    seenKinds.add(s.kind)
    out.push({ kind: s.kind, title: s.title, prompt: s.prompt, hint: s.hint })
    if (out.length === 3) break
  }
  while (out.length < 3 && all.length > 0) {
    const filler = all[out.length % all.length]!
    out.push({
      kind: filler.kind,
      title: filler.title,
      prompt: filler.prompt,
      hint: filler.hint,
    })
  }
  return out
}
