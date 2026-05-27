import { z } from "zod"

import { describeLlmError, runLlmObject } from "../llm-utils"

const channelEnum = z.enum(["sms", "tweet", "call", "letter"])
const toneEnum = z.enum(["friendly", "neutral", "threatening", "joking"])

const requestSchema = z.object({
  from: z.object({
    nation: z.string(),
    leaderName: z.string(),
  }),
  to: z.object({
    nation: z.string(),
    leaderName: z.string(),
  }),
  channel: channelEnum,
  tone: toneEnum,
  message: z.string().min(1).max(800),
})

const responseSchema = z.object({
  reply: z
    .string()
    .min(10)
    .max(400)
    .describe(
      "1–3 sentence reply spoken in the recipient's voice. Stay in character, plausible, no markdown."
    ),
  opinionDelta: z
    .number()
    .int()
    .min(-25)
    .max(25)
    .describe(
      "Integer change to the bilateral opinion score (−25 to +25). Reflect both the message content and the channel/tone fit. A threatening tweet sent publicly is harsher than a private SMS. A friendly handwritten letter swings more positively than a brief text."
    ),
  briefingTitle: z
    .string()
    .min(8)
    .max(80)
    .describe(
      "Short newsroom-style headline for the briefing log (e.g. 'Macron texts Starmer over Channel migration')."
    ),
})

function describeChannel(channel: z.infer<typeof channelEnum>): string {
  switch (channel) {
    case "sms":
      return "a private SMS / direct message"
    case "tweet":
      return "a PUBLIC post on social media (visible worldwide)"
    case "call":
      return "a phone call"
    case "letter":
      return "a formal diplomatic letter / démarche"
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.format() }, { status: 400 })
  }
  const { from, to, channel, tone, message } = parsed.data

  if (from.nation.trim().toUpperCase() === to.nation.trim().toUpperCase()) {
    return Response.json(
      { error: "Cannot send a diplomatic message to your own nation." },
      { status: 400 }
    )
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return Response.json(staticReply(channel, tone, to.leaderName, from.leaderName))
  }

  const systemText = [
    "You are roleplaying a head of state replying to a diplomatic message from another world leader.",
    "Stay strictly in character as the recipient. Speak in first person.",
    "Reply in 1–3 sentences, plausible and grounded in real geopolitics.",
    "Then judge how the bilateral opinion shifts (-25 to +25) based on the message's content,",
    "the channel used, and the tone — public threats hurt more than private ones; formal letters carry more weight than SMS.",
    "Also write a short newsroom-style briefing headline for the player's game log.",
  ].join(" ")

  const userText = [
    `Recipient: ${to.leaderName} (head of ${to.nation})`,
    `Sender: ${from.leaderName} (head of ${from.nation})`,
    `Channel: ${describeChannel(channel)}`,
    `Tone: ${tone}`,
    `Message: """${message}"""`,
  ].join("\n")

  const result = await runLlmObject({
    apiKey,
    schema: responseSchema,
    system: systemText,
    prompt: userText,
    modelId: process.env.OPENROUTER_MODEL || undefined,
  })
  return result.match(
    (object) => Response.json(object),
    (error) =>
      Response.json({
        ...staticReply(channel, tone, to.leaderName, from.leaderName),
        fallback: "llm_unavailable",
        error: describeLlmError(error),
      })
  )
}

function staticReply(
  channel: z.infer<typeof channelEnum>,
  tone: z.infer<typeof toneEnum>,
  recipientName: string,
  senderName: string
) {
  const opinionByTone: Record<z.infer<typeof toneEnum>, number> = {
    friendly: 4,
    neutral: 1,
    joking: 0,
    threatening: -6,
  }
  return {
    reply:
      tone === "threatening"
        ? `${senderName}, threats by ${channel} are not how partners speak. The matter is closed.`
        : `${senderName}, message received. I'll take it under advisement and we will speak again soon.`,
    opinionDelta: opinionByTone[tone],
    briefingTitle: `${senderName} ${channel === "tweet" ? "tweets" : "writes"} ${recipientName}`,
  }
}
