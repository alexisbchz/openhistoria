# Open Historia

A grand strategy sandbox game built on a tickable, deterministic engine. Open
source alternative to Pax Historia.

You take charge of a real-world nation 11 months before an election and shape
the country's economy, diplomacy, and politics until the campaign ends. The
current playable nation is France (Macron's second term, May 2026 →
April 2027); the engine is structured to add more.

## What's in it

- **Tickable engine** (`packages/engine`) — immutable `Game` with a clock,
  economy, project lifecycle, scheduled + procedural events, AI nations,
  cabinet bonuses, save migrations, all driven by an injectable seed for
  deterministic tests.
- **Web UI** (`apps/web`) — Next.js + Leaflet world map. Floating panels for
  country stats, decisions, diplomacy, briefings. Optional LLM-powered
  decision suggestions and roleplay diplomacy via OpenRouter.
- **125+ engine tests** covering economy, AI nations, procedural events,
  bankruptcy/impeachment, reform agendas, bond stress, UTC-safe event timing,
  and the storage Result API.

## Gameplay loop

1. Pick a **reform agenda** at game start — fiscal discipline, European
   leadership, or social renewal. Each lowers the approval threshold at the
   election if you succeed.
2. **Schedule decisions** (projects) on the map: nuclear, industrial,
   infrastructure, military, civilian, diplomacy, economic. Each costs
   upfront, drains the treasury monthly, and pays back approval + GDP when
   complete. AI nations react in real time.
3. **Respond to events**. High-severity story beats pause the game; lower-
   severity procedural events are auto-handled by the cabinet (with a default
   choice) and logged in the briefing.
4. **Issue bonds** to refill the treasury — the cost rises with debt/GDP and
   bonds are refused outright past 160% debt/GDP.
5. **Manage diplomacy**: propose alliances, send SMS / tweets / calls /
   letters to other heads of state. The foreign minister speeds drift toward
   each nation's baseline opinion.
6. **Win or lose** at the 2027 election based on approval + unemployment and
   whether your reform agenda succeeded. Or lose early to bankruptcy
   (treasury < −€500B for 30d) or impeachment (approval < 15% for 30d).

## Controls

| Key       | Action                          |
| --------- | ------------------------------- |
| Space     | Pause / play                    |
| `1`–`5`   | Speed                           |
| `D`       | Toggle decisions panel          |
| `S`       | Toggle country stats panel      |
| `G`       | Toggle diplomacy dashboard      |
| `B`       | Toggle briefing                 |
| `Esc`     | Pause menu / close panel        |
| `` ` ``   | Debug overlay                   |

## Run it locally

```bash
npm install
npm run dev       # turbo dev — starts web app at http://localhost:3000
npm test          # turbo test — runs engine vitest suite
npm run typecheck # turbo typecheck — strict TS across all workspaces
```

Optional environment for LLM-powered features (`apps/web/.env.local`):

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini  # optional override
```

Without an API key, decision suggestions fall back to a curated offline list
and the diplomat-reply endpoint returns a deterministic static reply. The game
remains fully playable.

## Save format

Saves are JSON snapshots stored under the `openhistoria:save` localStorage
key. The schema is versioned (`version: 5` at the time of writing) and the
engine carries migrations for v1 → v5. If a saved blob fails to parse or
migrate, it is moved to `openhistoria:save.bak` and a fresh game is started.

The pause menu has **Export save** and **Import save** buttons that read /
write the same JSON.

## Architecture overview

```
packages/engine            pure TypeScript engine, no UI deps
  src/game.ts              Game class, tick loop, snapshot, win/lose
  src/economy.ts           cashflow, drift, NaN-safe arithmetic
  src/events.ts            curated event library
  src/procedural-events.ts random event templates + cooldowns
  src/ai-nations.ts        12 AI nations: drift, actions, alliances
  src/cabinet.ts           ministers + their passive bonuses
  src/storage.ts           save/load with neverthrow Result types
  test/                    vitest suite

apps/web                   Next.js app
  app/api/*                LLM and Wikidata routes (ResultAsync pipelines)
  components/              floating panels, HUD, dialogs, debug overlay
  lib/api-client.ts        typed fetch helper returning ResultAsync
```

Errors are modelled with [neverthrow](https://github.com/supermacro/neverthrow)
`Result` and `ResultAsync` throughout the engine's storage layer and the web
app's API/fetch layers; the engine's pure tick logic stays exception-free
because every external boundary returns a Result.

## License

MIT. See `LICENSE`.
