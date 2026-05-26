"use client"

import {
  fetchCountryData,
  type DiplomaticChannel,
  type DiplomaticTone,
  type FetchedCountryData,
  type FetchedValue,
} from "@workspace/engine"
import {
  BanknoteIcon,
  CoinsIcon,
  GaugeIcon,
  GlobeIcon,
  HeartPulseIcon,
  LandmarkIcon,
  Loader2Icon,
  MailIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PhoneIcon,
  ScaleIcon,
  SendIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useReducer, useState, type ReactNode } from "react"

import { CountryFlag } from "@/components/country-flag"
import { FloatingPanel } from "@/components/floating-panel"
import { useGame, useGameActions } from "@/components/game-provider"
import { useMapSelection } from "@/components/map-country-regions"

interface CacheEntry {
  status: "loading" | "ready" | "error"
  data?: FetchedCountryData
  error?: string
}

const cache = new Map<string, CacheEntry>()
const subscribers = new Set<() => void>()

function notify() {
  for (const s of subscribers) s()
}

function loadCountry(code: string) {
  const existing = cache.get(code)
  if (existing && existing.status !== "error") return
  cache.set(code, { status: "loading" })
  notify()
  fetchCountryData(code)
    .then((data) => {
      cache.set(code, { status: "ready", data })
    })
    .catch((err: unknown) => {
      cache.set(code, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    })
    .finally(notify)
}

function useCountryEntry(code: string | null): CacheEntry | null {
  const [, force] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!code) return
    const sub = () => force()
    subscribers.add(sub)
    loadCountry(code)
    return () => {
      subscribers.delete(sub)
    }
  }, [code])

  return code ? (cache.get(code) ?? null) : null
}

interface Leader {
  name: string | null
  imageUrl: string | null
  wikidataId: string | null
}

interface LeadersData {
  country: { name: string | null; wikidataId: string | null }
  headOfState: Leader | null
  headOfGovernment: Leader | null
}

interface LeadersEntry {
  status: "loading" | "ready" | "error"
  data?: LeadersData
}

const leadersCache = new Map<string, LeadersEntry>()
const leadersSubscribers = new Set<() => void>()

function notifyLeaders() {
  for (const s of leadersSubscribers) s()
}

function loadLeaders(code: string) {
  const existing = leadersCache.get(code)
  if (existing && existing.status !== "error") return
  leadersCache.set(code, { status: "loading" })
  notifyLeaders()
  fetch(`/api/head-of-state?code=${encodeURIComponent(code)}`, {
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as LeadersData
      leadersCache.set(code, { status: "ready", data })
    })
    .catch(() => {
      leadersCache.set(code, { status: "error" })
    })
    .finally(notifyLeaders)
}

function useLeaders(code: string | null): LeadersEntry | null {
  const [, force] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!code) return
    const sub = () => force()
    leadersSubscribers.add(sub)
    loadLeaders(code)
    return () => {
      leadersSubscribers.delete(sub)
    }
  }, [code])

  return code ? (leadersCache.get(code) ?? null) : null
}

interface Alliance {
  name: string
  wikidataId: string
}

interface AlliancesEntry {
  status: "loading" | "ready" | "error"
  data?: Alliance[]
}

const alliancesCache = new Map<string, AlliancesEntry>()
const alliancesSubscribers = new Set<() => void>()

function notifyAlliances() {
  for (const s of alliancesSubscribers) s()
}

function loadAlliances(code: string) {
  const existing = alliancesCache.get(code)
  if (existing && existing.status !== "error") return
  alliancesCache.set(code, { status: "loading" })
  notifyAlliances()
  fetch(`/api/alliances?code=${encodeURIComponent(code)}`, {
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { alliances: Alliance[] }
      alliancesCache.set(code, { status: "ready", data: body.alliances ?? [] })
    })
    .catch(() => {
      alliancesCache.set(code, { status: "error" })
    })
    .finally(notifyAlliances)
}

function useAlliances(code: string | null): AlliancesEntry | null {
  const [, force] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!code) return
    const sub = () => force()
    alliancesSubscribers.add(sub)
    loadAlliances(code)
    return () => {
      alliancesSubscribers.delete(sub)
    }
  }, [code])

  return code ? (alliancesCache.get(code) ?? null) : null
}

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
})

const compactCurrency = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
  style: "currency",
  currency: "USD",
})

const fullCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function CountryInfoPanel() {
  const { selected, setSelected } = useMapSelection()
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 24, y: 80 }
    return { x: Math.max(24, window.innerWidth - 360 - 24), y: 80 }
  })

  const isCountry = selected?.type === "country"
  const rawCode = isCountry ? (selected.iso2 ?? selected.iso3 ?? null) : null
  const code = rawCode ? rawCode.toUpperCase() : null
  const entry = useCountryEntry(code)

  if (!isCountry) return null

  return (
    <FloatingPanel
      open
      onClose={() => setSelected(null)}
      title={selected.name}
      icon={
        <CountryFlag
          code={code}
          title={selected.name}
          className="h-4 w-auto rounded-[1px] ring-1 ring-black/15"
        />
      }
      position={pos}
      onPositionChange={setPos}
      className="w-[360px]"
    >
      {!code ? (
        <NoCodeMessage name={selected.name} />
      ) : (
        <>
          <LeadersBlock code={code} />
          <DiplomacySection code={code} />
          {!entry || entry.status === "loading" ? (
            <LoadingBlock />
          ) : entry.status === "error" ? (
            <ErrorBlock
              message={entry.error ?? "Unknown error"}
              onRetry={() => {
                cache.delete(code)
                loadCountry(code)
              }}
            />
          ) : entry.data ? (
            <CountryBody data={entry.data} />
          ) : null}
        </>
      )}
    </FloatingPanel>
  )
}

type LeaderRole = "hos" | "hog"

function LeadersBlock({ code }: { code: string }) {
  const entry = useLeaders(code)
  const [expanded, setExpanded] = useState<LeaderRole | null>(null)

  if (!entry || entry.status === "error") return null

  const isLoading = entry.status === "loading"
  const data = entry.data
  const hos = data?.headOfState ?? null
  const hog = data?.headOfGovernment ?? null

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 border-b border-border/60 px-3 py-3">
        <div className="size-16 rounded-full bg-muted ring-1 ring-border" />
        <span className="text-sm text-muted-foreground">Loading leaders…</span>
      </div>
    )
  }

  if (!hos && !hog) return null

  // Dual case: head of government distinct from head of state.
  const dual = hos && hog
  // Single case: only one leader returned (often because the API dedup'd them).
  const single = hos && !hog ? hos : !hos && hog ? hog : null
  const singleLabel = hos && !hog ? "Head of state" : "Head of government"

  if (expanded && data) {
    const focused = expanded === "hos" ? hos : hog
    const label =
      expanded === "hos"
        ? hog
          ? "Head of state"
          : singleLabel
        : "Head of government"
    if (!focused) {
      // The expanded leader vanished (cache change) — collapse.
      setExpanded(null)
      return null
    }
    return (
      <div className="flex flex-col gap-3 border-b border-border/60 px-3 py-4">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(null)}
            className="group flex flex-col items-center gap-2"
            aria-label="Collapse portrait"
          >
            {focused.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={focused.imageUrl}
                alt={focused.name ?? label}
                loading="lazy"
                className="size-32 rounded-full object-cover ring-2 ring-border bg-muted transition-transform group-hover:scale-[1.02]"
              />
            ) : (
              <div className="size-32 rounded-full bg-muted ring-2 ring-border" />
            )}
          </button>
          <div className="flex flex-col items-center gap-0.5 leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className="text-lg font-semibold text-foreground">
              {focused.name ?? "—"}
            </span>
          </div>
        </div>
        <LeaderComposer
          targetCode={code}
          targetLeaderName={focused.name ?? "the leader"}
        />
      </div>
    )
  }

  if (dual) {
    return (
      <div className="flex items-start justify-around gap-3 border-b border-border/60 px-3 py-3">
        <LeaderTile
          leader={hos}
          label="Head of state"
          onClick={() => setExpanded("hos")}
        />
        <LeaderTile
          leader={hog}
          label="Head of government"
          onClick={() => setExpanded("hog")}
        />
      </div>
    )
  }

  if (single) {
    return (
      <div className="flex items-center gap-4 border-b border-border/60 px-3 py-3">
        <LeaderTile
          leader={single}
          label={singleLabel}
          onClick={() =>
            setExpanded(hos && !hog ? "hos" : "hog")
          }
          horizontal
        />
      </div>
    )
  }

  return null
}

function LeaderTile({
  leader,
  label,
  onClick,
  horizontal = false,
}: {
  leader: Leader
  label: string
  onClick: () => void
  horizontal?: boolean
}) {
  const portrait = leader.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={leader.imageUrl}
      alt={leader.name ?? label}
      loading="lazy"
      className="size-16 rounded-full object-cover ring-1 ring-border bg-muted transition-transform group-hover:scale-[1.05]"
    />
  ) : (
    <div className="size-16 rounded-full bg-muted ring-1 ring-border" />
  )

  if (horizontal) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex items-center gap-3 text-left"
        title="Click to enlarge"
      >
        {portrait}
        <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="truncate text-base font-semibold text-foreground">
            {leader.name ?? "—"}
          </span>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-1 flex-col items-center gap-1.5 text-center"
      title="Click to enlarge"
    >
      {portrait}
      <div className="flex flex-col items-center gap-0.5 leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="truncate text-xs font-medium text-foreground max-w-[140px]">
          {leader.name ?? "—"}
        </span>
      </div>
    </button>
  )
}

const CHANNEL_COSTS: Record<DiplomaticChannel, number> = {
  sms: 0,
  tweet: 0,
  call: 5,
  letter: 15,
}

const CHANNEL_META: Record<
  DiplomaticChannel,
  { label: string; icon: LucideIcon; hint: string }
> = {
  sms: { label: "SMS", icon: MessageSquareIcon, hint: "Private message" },
  tweet: { label: "Tweet", icon: MegaphoneIcon, hint: "Public post" },
  call: { label: "Call", icon: PhoneIcon, hint: "Phone call · €5M" },
  letter: { label: "Letter", icon: MailIcon, hint: "Formal démarche · €15M" },
}

const TONE_OPTIONS: Array<{
  value: DiplomaticTone
  label: string
}> = [
  { value: "friendly", label: "Friendly" },
  { value: "neutral", label: "Neutral" },
  { value: "threatening", label: "Threatening" },
  { value: "joking", label: "Joking" },
]

function LeaderComposer({
  targetCode,
  targetLeaderName,
}: {
  targetCode: string
  targetLeaderName: string
}) {
  const game = useGame()
  const actions = useGameActions()
  const playerLeaders = useLeaders(game?.nation ?? null)

  const [channel, setChannel] = useState<DiplomaticChannel>("sms")
  const [tone, setTone] = useState<DiplomaticTone>("neutral")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState<{
    reply: string
    opinionDelta: number
  } | null>(null)

  if (!game) return null
  if (targetCode === game.nation) return null

  // Prefer head of government, fall back to head of state, then character id.
  const playerLeaderName =
    playerLeaders?.data?.headOfGovernment?.name ??
    playerLeaders?.data?.headOfState?.name ??
    game.character

  const cost = CHANNEL_COSTS[channel]
  const canAfford = game.treasury >= cost
  const trimmed = message.trim()
  const canSend = !sending && trimmed.length > 0 && canAfford && !game.gameOver

  async function handleSend() {
    if (!game || !canSend) return
    setSending(true)
    setError(null)
    setReply(null)
    try {
      const res = await fetch("/api/diplomat-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: { nation: game.nation, leaderName: playerLeaderName },
          to: { nation: targetCode, leaderName: targetLeaderName },
          channel,
          tone,
          message: trimmed,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          typeof body?.error === "string" ? body.error : `HTTP ${res.status}`
        )
      }
      const data = (await res.json()) as {
        reply: string
        opinionDelta: number
        briefingTitle: string
      }
      actions.sendDiplomaticMessage({
        target: targetCode,
        opinionDelta: data.opinionDelta,
        cost,
        briefingTitle: data.briefingTitle,
        briefingDetail: `via ${CHANNEL_META[channel].label} · ${tone}`,
        briefingKind: data.opinionDelta < 0 ? "warning" : "milestone",
      })
      setReply({ reply: data.reply, opinionDelta: data.opinionDelta })
      setMessage("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Channel
        </span>
        {(Object.keys(CHANNEL_META) as DiplomaticChannel[]).map((c) => {
          const meta = CHANNEL_META[c]
          const Icon = meta.icon
          const selected = channel === c
          const c_cost = CHANNEL_COSTS[c]
          const unaffordable = c_cost > game.treasury
          return (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              disabled={unaffordable && !selected}
              title={meta.hint}
              className={
                selected
                  ? "flex items-center gap-1 rounded-md border border-primary bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary"
                  : unaffordable
                    ? "flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground/40 cursor-not-allowed"
                    : "flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }
            >
              <Icon className="size-3" />
              {meta.label}
              {c_cost > 0 && (
                <span className="text-[9px] opacity-70">€{c_cost}M</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tone
        </span>
        {TONE_OPTIONS.map((t) => {
          const selected = tone === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTone(t.value)}
              className={
                selected
                  ? "rounded-md border border-primary bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary"
                  : "rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={`Write a ${tone} ${CHANNEL_META[channel].label.toLowerCase()} to ${targetLeaderName}…`}
        rows={3}
        disabled={sending}
        className="resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-snug placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
        maxLength={800}
      />

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {cost > 0
            ? canAfford
              ? `Costs €${cost}M`
              : `Need €${cost}M (treasury short)`
            : "No cost"}
        </span>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={
            canSend
              ? "flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              : "flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
          }
        >
          {sending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SendIcon className="size-3.5" />
          )}
          Send
        </button>
      </div>

      {reply && (
        <div className="grid gap-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
            <span className="font-semibold text-muted-foreground">
              {targetLeaderName} replied
            </span>
            <span
              className={
                reply.opinionDelta > 0
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : reply.opinionDelta < 0
                    ? "font-semibold text-red-600 dark:text-red-400"
                    : "font-semibold text-muted-foreground"
              }
            >
              {reply.opinionDelta > 0 ? "+" : ""}
              {reply.opinionDelta} opinion
            </span>
          </div>
          <p className="text-xs italic leading-snug text-foreground">
            “{reply.reply}”
          </p>
        </div>
      )}
    </div>
  )
}

function DiplomacySection({ code }: { code: string }) {
  const game = useGame()
  const actions = useGameActions()
  const targetAlliancesEntry = useAlliances(code)
  const playerAlliancesEntry = useAlliances(game?.nation ?? null)

  if (!game || game.gameOver) return null
  if (code === game.nation) return null

  const relation = game.getRelation(code)
  const { opinion, allied: bilateralAllied } = relation

  const targetAlliances = targetAlliancesEntry?.data ?? []
  const playerAlliances = playerAlliancesEntry?.data ?? []
  const playerSet = new Set(playerAlliances.map((a) => a.wikidataId))
  const sharedAlliances = targetAlliances.filter((a) =>
    playerSet.has(a.wikidataId)
  )
  const alliedViaAlliance = sharedAlliances.length > 0
  const allied = bilateralAllied || alliedViaAlliance

  const opinionLabel = opinion > 0 ? `+${opinion}` : `${opinion}`
  const opinionColor =
    opinion > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : opinion < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"
  const fillPct = Math.abs(opinion)
  const fillSide = opinion >= 0 ? "left-1/2" : "right-1/2"
  const fillColor =
    opinion > 0
      ? "bg-emerald-500/70"
      : opinion < 0
        ? "bg-red-500/70"
        : "bg-muted"

  const statusLabel = alliedViaAlliance
    ? `Allied via ${sharedAlliances[0]!.name}`
    : bilateralAllied
      ? "Allied"
      : "Neutral"

  return (
    <div className="grid gap-2 border-b border-border/60 px-3 py-3 text-sm">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Diplomacy
        </h3>
        <span
          className={
            allied
              ? "rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400"
              : "rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          }
        >
          {statusLabel}
        </span>
      </header>

      {targetAlliances.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Member of
          </span>
          {targetAlliances.map((a) => {
            const shared = playerSet.has(a.wikidataId)
            return (
              <span
                key={a.wikidataId}
                title={
                  shared
                    ? `Both ${game.nation} and ${code} are members`
                    : a.name
                }
                className={
                  shared
                    ? "rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                    : "rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                }
              >
                {a.name}
              </span>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Opinion</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
          <div
            className={`absolute top-0 bottom-0 ${fillSide} ${fillColor}`}
            style={{ width: `${fillPct / 2}%` }}
          />
        </div>
        <span
          className={`tabular-nums text-xs font-semibold ${opinionColor} w-10 text-right`}
        >
          {opinionLabel}
        </span>
      </div>

      <button
        type="button"
        disabled={alliedViaAlliance}
        onClick={() =>
          bilateralAllied
            ? actions.breakAlliance(code)
            : actions.proposeAlliance(code)
        }
        className={
          alliedViaAlliance
            ? "self-start rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-700/70 dark:text-emerald-400/70 cursor-not-allowed"
            : bilateralAllied
              ? "self-start rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-400"
              : "self-start rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
        }
        title={
          alliedViaAlliance
            ? `Already allied through ${sharedAlliances[0]!.name}`
            : undefined
        }
      >
        {alliedViaAlliance
          ? `Allied via ${sharedAlliances[0]!.name}`
          : bilateralAllied
            ? "Break alliance"
            : "Propose alliance"}
      </button>
    </div>
  )
}

function NoCodeMessage({ name }: { name: string }) {
  return (
    <div className="px-4 py-6 text-center text-muted-foreground text-sm">
      No ISO code available for <span className="font-medium">{name}</span> —
      can&apos;t fetch World Bank data.
    </div>
  )
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-8 text-muted-foreground text-sm">
      <Loader2Icon className="size-4 animate-spin" />
      Loading country data…
    </div>
  )
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="grid gap-2 px-4 py-4 text-sm">
      <p className="text-destructive">{message}</p>
      <button
        type="button"
        className="self-start text-xs text-muted-foreground underline hover:text-foreground"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  )
}

function CountryBody({ data }: { data: FetchedCountryData }) {
  return (
    <div className="grid gap-3 px-3 py-3 text-sm">
      <section className="grid gap-1">
        <header className="flex items-center justify-between">
          <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
            Overview
          </h3>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {data.code} · {data.alpha3}
          </span>
        </header>
        <Row
          icon={<LandmarkIcon className="size-3.5" />}
          label="Capital"
          value={data.capital ?? "—"}
        />
        <Row
          icon={<GlobeIcon className="size-3.5" />}
          label="Region"
          value={
            data.subregion
              ? `${data.region ?? "—"} · ${data.subregion}`
              : (data.region ?? "—")
          }
        />
      </section>

      <section className="grid gap-1 border-t border-border/60 pt-2">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Demographics
        </h3>
        <Row
          icon={<UsersIcon className="size-3.5" />}
          label="Population"
          value={renderValue(data.demographics.population, (v) =>
            compactNumber.format(v)
          )}
          year={data.demographics.population?.year}
        />
        <Row
          icon={<HeartPulseIcon className="size-3.5" />}
          label="Life expectancy"
          value={renderValue(
            data.demographics.lifeExpectancy,
            (v) => `${v.toFixed(1)} y`
          )}
          year={data.demographics.lifeExpectancy?.year}
        />
        <Row
          icon={<TrendingUpIcon className="size-3.5" />}
          label="Birth / 1k"
          value={renderValue(data.demographics.birthRatePer1000, (v) =>
            v.toFixed(1)
          )}
          year={data.demographics.birthRatePer1000?.year}
        />
        <Row
          icon={<TrendingDownIcon className="size-3.5" />}
          label="Death / 1k"
          value={renderValue(data.demographics.deathRatePer1000, (v) =>
            v.toFixed(1)
          )}
          year={data.demographics.deathRatePer1000?.year}
        />
        <Row
          icon={<GaugeIcon className="size-3.5" />}
          label="Urban"
          value={renderValue(
            data.demographics.urbanizationPct,
            (v) => `${v.toFixed(1)}%`
          )}
          year={data.demographics.urbanizationPct?.year}
        />
      </section>

      <section className="grid gap-1 border-t border-border/60 pt-2">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Economy
        </h3>
        <Row
          icon={<CoinsIcon className="size-3.5" />}
          label="GDP"
          value={renderValue(data.economy.gdpUsd, (v) =>
            compactCurrency.format(v)
          )}
          year={data.economy.gdpUsd?.year}
        />
        <Row
          icon={<BanknoteIcon className="size-3.5" />}
          label="GDP / capita"
          value={renderValue(data.economy.gdpPerCapitaUsd, (v) =>
            fullCurrency.format(v)
          )}
          year={data.economy.gdpPerCapitaUsd?.year}
        />
        <Row
          icon={<TrendingDownIcon className="size-3.5" />}
          label="Unemployment"
          value={renderValue(
            data.economy.unemploymentPct,
            (v) => `${v.toFixed(1)}%`
          )}
          year={data.economy.unemploymentPct?.year}
        />
        <Row
          icon={<TrendingUpIcon className="size-3.5" />}
          label="Inflation"
          value={renderValue(
            data.economy.inflationPct,
            (v) => `${v.toFixed(1)}%`
          )}
          year={data.economy.inflationPct?.year}
        />
        <Row
          icon={<ScaleIcon className="size-3.5" />}
          label="Debt / GDP"
          value={renderValue(
            data.economy.publicDebtPctGdp,
            (v) => `${v.toFixed(1)}%`
          )}
          year={data.economy.publicDebtPctGdp?.year}
        />
      </section>

      <p className="border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        Sources: World Bank, REST Countries. Year shown next to each value.
      </p>
    </div>
  )
}

function renderValue(
  fv: FetchedValue | null,
  format: (v: number) => string
): ReactNode {
  if (!fv) return <span className="text-muted-foreground">—</span>
  return <span className="font-medium tabular-nums">{format(fv.value)}</span>
}

function Row({
  icon,
  label,
  value,
  year,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  year?: number
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1.5">
        {value}
        {year ? (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            ’{String(year).slice(-2)}
          </span>
        ) : null}
      </span>
    </div>
  )
}
