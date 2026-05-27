# @workspace/engine

Pure TypeScript engine for Open Historia. No DOM, no React, no network — it
takes a clock and a starting state and returns a new immutable state every
tick. The web app in `apps/web` is the only consumer today, but the engine is
deliberately framework-free so it can power a CLI, a server simulator, or
another UI.

## Quick start

```ts
import { Game, saveGame, loadGameResult } from "@workspace/engine"

let game = Game.createNew().with({ paused: false })

for (let i = 0; i < 365; i++) {
  if (game.pendingEvent) {
    game = game.resolveEventChoice(
      game.pendingEvent.id,
      game.pendingEvent.choices[0]!.id
    )
    continue
  }
  if (game.gameOver) break
  game = game.tick(1)
}

console.log(game.gameOver?.outcome) // "won" | "lost" | undefined
```

## Public surface

### `Game`
Immutable root state. Every mutating method returns a new `Game`. Field set
includes nation, date, projects, treasury, approval, stats, triggered/pending
events, relations, reform agenda, weekly history, cabinet appointments, and a
`triggeredWarnings` set for one-shot UI notifications.

| Method | What it does |
| --- | --- |
| `Game.createNew()` | Builds the default 2026 France start. |
| `tick(days)` | Advances time, applies economy + events + AI tick. No-op if paused, game-over, or a pending event is unresolved. |
| `with(overrides)` | Functional update; returns a new `Game`. |
| `addProject(p)` / `cancelProject(id)` | Project lifecycle. Refused projects log a "Cabinet refused" warning. |
| `issueBond(amountM)` | Raise treasury. Refused outright at debt/GDP ≥ 160%. Cost scales above 130%. |
| `mediaTour()` | Small approval bump at a treasury cost. |
| `proposeAlliance(code)` / `breakAlliance(code)` | Diplomatic state changes. |
| `signTradeDeal(code)` / `issueSanctions(code)` | Economic player verbs, 90d cooldown via `RelationState.lastEconomicActionAt`. |
| `sendDiplomaticMessage(args)` | Apply a precomputed message outcome. |
| `setReformAgenda(id)` | Pick from `REFORM_AGENDAS`. |
| `appointMinister(roleId, candidateId)` | Cabinet reshuffle. |
| `resolveEventChoice(eventId, choiceId)` | Decide a pending event. |
| `toSnapshot()` / `Game.fromSnapshot()` | Versioned serialisation (current v5). |

### Clock & determinism
`packages/engine/src/clock.ts` exposes an injectable `Clock` with `now()`,
`uuid()`, and `random()`. Tests use `makeDeterministicClock({ seed })` so a
given seed produces a byte-identical snapshot across runs. **Never call
`Math.random()` or `Date.now()` from engine code** — always go through the
clock so determinism holds.

### Storage
`storage.ts` uses [`neverthrow`](https://github.com/supermacro/neverthrow):

- `saveGame(game): Result<void, StorageError>` — never throws.
- `loadGameResult(): Result<Game | null, StorageError>` — ok(null) when
  nothing is saved, err(parse_error / migration_error / quota_exceeded /
  no_window) otherwise.
- Corrupt blobs are quarantined to `openhistoria:save.bak`; the main slot is
  cleared so the next bootstrap creates a clean game.
- `loadGameWithStatus()` exposes a backward-compatible `{ game, corrupted? }`
  shape for older call sites.

### Events
`events.ts` ships a curated event library plus `getDueEvent` / `getNextEvent`.
Events have severity (low/medium/high) — only high-severity events pause the
game; lower-severity events auto-resolve via the cabinet's default choice.
Events can declare a `requires` precondition referencing a previously chosen
event + choice, enabling short narrative chains.

Procedural events live in `procedural-events.ts` with per-template cooldowns
to avoid spam. AI nations can also originate proposals at runtime via
`maybeGenerateAiProposal` — surfaced as a high-severity event the player
accepts or declines.

### Cabinet
`cabinet.ts` carries multiple candidates per role with distinct
`MinisterBonus` shapes (bond discount, completion approval, diplomatic drift
multiplier, deficit-penalty dampening, etc.). `getCabinetEffects(nation,
appointments)` aggregates the active stack.

### Economy
`economy.ts` is NaN-safe at every boundary: arithmetic falls back to the prior
value when results are non-finite. `sanitizeStats(stats, fallback)` is the
clamp/repair helper used by snapshot loaders and the event-effects applier.

### AI
`ai-nations.ts` defines 12 nations with opinion drift toward a `baseOpinion`,
opinionated reactions to player project kinds, and a quarterly economic-action
roll (`trade_deal`, `sanctions`, `tariffs`, `foreign_investment`).
`AI_BLOCS` is a static catalogue (Anglosphere, EU core, BRICS-leaning,
Indo-Pacific) surfaced by the UI as context.

### Reform agendas
`REFORM_AGENDAS` has five agendas (fiscal discipline, european leadership,
social renewal, technology sovereignty, security first). `evaluateReformAgenda`
returns whether the player is on track; the election outcome uses a lower
approval threshold when the agenda succeeds.

## Snapshot versioning

`GameSnapshot.version` is currently `5`. Migrators in `Game.fromSnapshot`
upgrade older shapes (v1–v4) to v5 by seeding the new fields and running
`sanitizeStats` on the stored economy/demographics blob. Storage quarantines
corrupt JSON before reaching the migrator.

## Testing

```bash
npm test                  # vitest run
npm run test:coverage     # with @vitest/coverage-v8
npm run test:watch
```

The test suite covers economy/drift, AI nation drift + economic actions,
procedural cooldowns, save round-trip + corruption quarantine, bankruptcy +
impeachment trips, weekly history, reform agendas, cabinet bonus aggregation
+ appointments, event chain preconditions, determinism (same seed → same
snapshot), bond stress/cap, and a perf benchmark (1y sim < 2s).
