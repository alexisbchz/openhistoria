import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { z } from "zod"

const DEFAULT_MODEL = "openai/gpt-4o-mini"
const NOMINATIM_USER_AGENT = "openhistoria-dev (https://github.com/openhistoria)"

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

const llmSchema = z.object({
  name: z.string().describe("Short title for the project."),
  kind: projectKindEnum.describe("Category that best matches the decision."),
  description: z
    .string()
    .describe("One- or two-sentence explanation of what is being undertaken."),
  expectedDurationDays: z
    .number()
    .int()
    .min(1)
    .max(36500)
    .describe(
      "Realistic completion time in days, based on real-world references. " +
        "Examples: nuclear plant ≈ 3650 (10y), high-speed rail ≈ 2920 (8y), " +
        "highway ≈ 1095 (3y), hospital ≈ 1095 (3y), military base ≈ 730 (2y), " +
        "factory ≈ 730 (2y), residential block ≈ 365 (1y), " +
        "diplomatic agreement ≈ 90, economic reform ≈ 180."
    ),
  location: z.object({
    label: z
      .string()
      .describe(
        "Clean human-readable place name to display, e.g. 'Calais, France'. " +
          "Prefer the most prominent canonical place (city / region) the player named."
      ),
    query: z
      .string()
      .describe(
        "Geocoding search query. Should resolve to the city center or main " +
          "landmark the player named. Format as 'City, Country' when possible."
      ),
  }),
})

const requestSchema = z.object({
  prompt: z.string().min(1),
  context: z.object({
    nation: z.string(),
    date: z.string(),
  }),
})

interface GeocodeResult {
  latitude: number
  longitude: number
}

async function geocode(query: string): Promise<GeocodeResult> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", query)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")

  const res = await fetch(url, {
    headers: { "User-Agent": NOMINATIM_USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(`Geocoding failed: HTTP ${res.status}`)
  }
  const results = (await res.json()) as Array<{ lat: string; lon: string }>
  const top = results[0]
  if (!top) {
    throw new Error(`No geocoding result for: ${query}`)
  }
  return {
    latitude: Number.parseFloat(top.lat),
    longitude: Number.parseFloat(top.lon),
  }
}

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

  const { prompt, context } = parsed.data

  const systemText = [
    "You are a strategy game assistant.",
    "The player governs a real-world nation and issues a decision they want to enact.",
    "Translate the decision into a concrete project anchored at a real geographic location.",
    "For the location query, always use the most canonical, widely recognized place name —",
    "typically a city, region, or country. Do NOT invent obscure hamlets or villages.",
    "If the player names a city, use that exact city. If they only name a region,",
    "use the regional capital or most prominent city.",
    "Respond in the player's input language for name and description.",
  ].join(" ")

  const userText = [
    `Nation: ${context.nation}`,
    `In-game date: ${context.date}`,
    `Decision: ${prompt}`,
  ].join("\n")

  const openrouter = createOpenRouter({ apiKey })
  const model = openrouter.chat(process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL)

  let object: z.infer<typeof llmSchema>
  try {
    const result = await generateObject({
      model,
      schema: llmSchema,
      system: systemText,
      prompt: userText,
    })
    object = result.object
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "OpenRouter inference failed",
      },
      { status: 502 }
    )
  }

  let coords: GeocodeResult
  try {
    coords = await geocode(object.location.query)
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Geocoding failed",
        attempted: object.location.query,
      },
      { status: 502 }
    )
  }

  return Response.json({
    name: object.name,
    kind: object.kind,
    description: object.description,
    expectedDurationDays: object.expectedDurationDays,
    location: {
      label: object.location.label,
      latitude: coords.latitude,
      longitude: coords.longitude,
    },
  })
}
