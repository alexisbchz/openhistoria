import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { z } from "zod"

const DEFAULT_MODEL = "openai/gpt-4o-mini"

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
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not set" },
      { status: 500 }
    )
  }

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 })
  }
  const ctx = parsed.data

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

  const openrouter = createOpenRouter({ apiKey })
  const model = openrouter.chat(process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL)

  try {
    const result = await generateObject({
      model,
      schema: suggestionsSchema,
      system: systemText,
      prompt: userText,
    })
    return Response.json({ suggestions: result.object.suggestions })
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "OpenRouter inference failed",
      },
      { status: 502 }
    )
  }
}
