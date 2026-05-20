export type NationCode = "FR"
export type CharacterId = "macron"
export type GameSpeed = 1 | 2 | 3 | 4 | 5

export const SPEED_MS_PER_DAY: Record<GameSpeed, number> = {
  1: 2000,
  2: 1000,
  3: 500,
  4: 200,
  5: 50,
}

export interface GameSnapshot {
  version: 1
  nation: NationCode
  character: CharacterId
  date: string
  startedAt: string
  speed: GameSpeed
  paused: boolean
}

interface GameFields {
  nation: NationCode
  character: CharacterId
  date: Date
  startedAt: Date
  speed: GameSpeed
  paused: boolean
}

export class Game {
  readonly nation: NationCode
  readonly character: CharacterId
  readonly date: Date
  readonly startedAt: Date
  readonly speed: GameSpeed
  readonly paused: boolean

  constructor(init: GameFields) {
    this.nation = init.nation
    this.character = init.character
    this.date = init.date
    this.startedAt = init.startedAt
    this.speed = init.speed
    this.paused = init.paused
  }

  static createNew(): Game {
    const now = new Date()
    return new Game({
      nation: "FR",
      character: "macron",
      date: now,
      startedAt: now,
      speed: 1,
      paused: true,
    })
  }

  with(overrides: Partial<GameFields>): Game {
    return new Game({
      nation: this.nation,
      character: this.character,
      date: this.date,
      startedAt: this.startedAt,
      speed: this.speed,
      paused: this.paused,
      ...overrides,
    })
  }

  advanceDays(days: number): Game {
    return this.with({
      date: new Date(this.date.getTime() + days * 86_400_000),
    })
  }

  toSnapshot(): GameSnapshot {
    return {
      version: 1,
      nation: this.nation,
      character: this.character,
      date: this.date.toISOString(),
      startedAt: this.startedAt.toISOString(),
      speed: this.speed,
      paused: this.paused,
    }
  }

  static fromSnapshot(snapshot: GameSnapshot): Game {
    return new Game({
      nation: snapshot.nation,
      character: snapshot.character,
      date: new Date(snapshot.date),
      startedAt: new Date(snapshot.startedAt),
      speed: snapshot.speed ?? 1,
      paused: snapshot.paused ?? true,
    })
  }
}
