"use client"

import {
  defaultProjectEconomics,
  getProjectProgress,
  getSuggestionsForNation,
  PROJECT_KIND_LABELS,
  type DecisionSuggestion,
  type Project,
  type ProjectKind,
  type ProjectLocation,
} from "@workspace/engine"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  AtomIcon,
  BuildingIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClockIcon,
  CrownIcon,
  FactoryIcon,
  HandshakeIcon,
  LandmarkIcon,
  Loader2Icon,
  MapPinIcon,
  RouteIcon,
  ShieldIcon,
  SparklesIcon,
  TrendingUpIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import { FloatingPanel } from "@/components/floating-panel"
import { useGame, useGameActions } from "@/components/game-provider"
import { useHudState } from "@/components/hud-state"
import { describeApiError, postJson } from "@/lib/api-client"

interface DecideResponse {
  name: string
  kind: ProjectKind
  description: string
  expectedDurationDays: number
  location: ProjectLocation
}

const PROJECT_ICONS: Record<ProjectKind, LucideIcon> = {
  "construction:nuclear": AtomIcon,
  "construction:industrial": FactoryIcon,
  "construction:infrastructure": RouteIcon,
  "construction:military": ShieldIcon,
  "construction:civilian": BuildingIcon,
  diplomacy: HandshakeIcon,
  economic: TrendingUpIcon,
  other: LandmarkIcon,
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
})

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function DecisionsPanel() {
  const game = useGame()
  const { addProject, removeProject } = useGameActions()
  const {
    decisionsOpen,
    closeDecisions,
    decisionsPos,
    setDecisionsPos,
  } = useHudState()
  const [prompt, setPrompt] = useState("")
  const [startDate, setStartDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<DecisionSuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const todayIso = game ? toDateInputValue(game.date) : ""
  const effectiveStartDate = startDate || todayIso
  const projects = useMemo(() => game?.projects ?? [], [game?.projects])

  const staticSuggestions = useMemo(
    () => (game ? getSuggestionsForNation(game.nation) : []),
    [game?.nation]
  )
  const groupedSuggestions = useMemo(
    () => groupByKind(staticSuggestions),
    [staticSuggestions]
  )

  async function fetchAiSuggestions() {
    if (!game) return
    setAiLoading(true)
    setAiError(null)
    const result = await postJson<{
      suggestions: Array<Omit<DecisionSuggestion, "id">>
    }>("/api/suggest-decisions", {
      nation: game.nation,
      date: game.date.toISOString(),
      treasury: game.treasury,
      approval: game.approval,
      reformAgenda: game.reformAgenda?.id ?? null,
      recentBriefings: game.briefing.slice(0, 5).map((b) => b.title),
    })
    result.match(
      (data) => {
        const stamped: DecisionSuggestion[] = data.suggestions.map((s, i) => ({
          ...s,
          id: `ai-${Date.now()}-${i}`,
        }))
        setAiSuggestions(stamped)
      },
      (error) => setAiError(describeApiError(error))
    )
    setAiLoading(false)
  }

  function applySuggestion(s: DecisionSuggestion) {
    setPrompt(s.prompt)
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!game) return
    const trimmed = prompt.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    const result = await postJson<DecideResponse>("/api/decide", {
      prompt: trimmed,
      context: {
        nation: game.nation,
        date: game.date.toISOString(),
      },
    })
    result.match(
      (data) => {
        const start = startDate
          ? new Date(`${startDate}T00:00:00`)
          : game.date
        const economics = defaultProjectEconomics(
          data.kind,
          data.expectedDurationDays
        )
        if (game.treasury < economics.upfrontCost) {
          setError(
            `Treasury short by €${(economics.upfrontCost - game.treasury).toFixed(0)}M. Cut spending or pick a smaller project.`
          )
          return
        }
        const project: Project = {
          id: newId(),
          kind: data.kind,
          name: data.name,
          description: data.description,
          expectedDurationDays: data.expectedDurationDays,
          location: data.location,
          startedAt: start.toISOString(),
          ...economics,
        }
        addProject(project)
        setPrompt("")
        setStartDate("")
      },
      (error) => setError(describeApiError(error))
    )
    setLoading(false)
  }

  if (!game) return null

  return (
    <FloatingPanel
      open={decisionsOpen}
      onClose={closeDecisions}
      title="Presidential Decisions"
      icon={<CrownIcon className="size-4" />}
      position={decisionsPos}
      onPositionChange={setDecisionsPos}
      className="h-[560px] w-[820px] max-w-[95vw]"
      bodyClassName="bg-background/95"
    >
      <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] divide-x divide-border/80">
        <section className="flex min-h-0 min-w-0 flex-col">
          <header className="border-b border-border/80 bg-muted/40 px-4 py-2">
            <h3 className="font-semibold text-sm tracking-wide uppercase">
              Active decisions
            </h3>
            <p className="text-muted-foreground text-xs">
              Ongoing, scheduled, and completed initiatives.
            </p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No decisions yet. Use the form to schedule one.
              </p>
            ) : (
              <ul className="grid gap-2">
                {projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    currentDate={game.date}
                    onRemove={() => removeProject(project.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col">
          <header className="flex items-center justify-between gap-2 border-b border-border/80 bg-muted/40 px-4 py-2">
            <div>
              <h3 className="font-semibold text-sm tracking-wide uppercase">
                Suggestions
              </h3>
              <p className="text-muted-foreground text-xs">
                Click a suggestion to draft it, then edit before scheduling.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchAiSuggestions}
              disabled={aiLoading}
              title="Generate 3 AI suggestions tailored to current state"
            >
              {aiLoading ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="size-3.5" />
              )}
              Surprise me
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {aiError && (
              <p className="mb-2 text-xs text-destructive" role="alert">
                AI suggestions failed: {aiError}
              </p>
            )}
            {aiSuggestions.length > 0 && (
              <SuggestionGroup
                label="Suggested for you"
                accent
                suggestions={aiSuggestions}
                onPick={applySuggestion}
              />
            )}
            {groupedSuggestions.length === 0 && aiSuggestions.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No suggestions for {game.nation}.
              </p>
            ) : (
              groupedSuggestions.map(([kind, items]) => (
                <SuggestionGroup
                  key={kind}
                  label={PROJECT_KIND_LABELS[kind]}
                  suggestions={items}
                  onPick={applySuggestion}
                />
              ))
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-2 border-t border-border/80 bg-muted/20 px-4 py-3"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="decision-prompt">Initiative</Label>
              <Textarea
                id="decision-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a decision, or pick a suggestion above."
                rows={3}
                disabled={loading}
              />
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="decision-start-date" className="text-xs">
                  Start date
                </Label>
                <Input
                  id="decision-start-date"
                  type="date"
                  value={effectiveStartDate}
                  min={todayIso}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={loading}
                  className="w-fit"
                />
              </div>
              <div className="text-right text-xs tabular-nums">
                <div className="text-muted-foreground">Treasury</div>
                <div className="font-medium">
                  €{Math.round(game.treasury).toLocaleString()}M
                </div>
              </div>
            </div>
            {error && (
              <p className="text-destructive text-xs" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={closeDecisions}
                disabled={loading}
              >
                Close
              </Button>
              <Button type="submit" disabled={loading || !prompt.trim()}>
                {loading && <Loader2Icon className="animate-spin" />}
                Schedule
              </Button>
            </div>
          </form>
        </section>
      </div>
    </FloatingPanel>
  )
}

function groupByKind(
  suggestions: DecisionSuggestion[]
): Array<[ProjectKind, DecisionSuggestion[]]> {
  const groups = new Map<ProjectKind, DecisionSuggestion[]>()
  for (const s of suggestions) {
    const list = groups.get(s.kind) ?? []
    list.push(s)
    groups.set(s.kind, list)
  }
  // Order matches PROJECT_KIND_LABELS declaration order for stable rendering.
  const order: ProjectKind[] = [
    "construction:nuclear",
    "construction:industrial",
    "construction:infrastructure",
    "construction:military",
    "construction:civilian",
    "diplomacy",
    "economic",
    "other",
  ]
  return order
    .filter((k) => groups.has(k))
    .map((k) => [k, groups.get(k)!] as [ProjectKind, DecisionSuggestion[]])
}

function SuggestionGroup({
  label,
  suggestions,
  onPick,
  accent = false,
}: {
  label: string
  suggestions: DecisionSuggestion[]
  onPick: (s: DecisionSuggestion) => void
  accent?: boolean
}) {
  return (
    <div className="mb-3 last:mb-0">
      <h4
        className={
          accent
            ? "mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary"
            : "mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        }
      >
        {accent && <SparklesIcon className="size-3" />}
        {label}
      </h4>
      <ul className="grid gap-1.5">
        {suggestions.map((s) => {
          const Icon = PROJECT_ICONS[s.kind] ?? MapPinIcon
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className={
                  accent
                    ? "group flex w-full items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/10"
                    : "group flex w-full items-start gap-2 rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5 text-left transition-colors hover:border-border hover:bg-card"
                }
              >
                <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium leading-tight">
                    {s.title}
                  </div>
                  {s.hint && (
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {s.hint}
                    </div>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ProjectRow({
  project,
  currentDate,
  onRemove,
}: {
  project: Project
  currentDate: Date
  onRemove: () => void
}) {
  const Icon = PROJECT_ICONS[project.kind] ?? MapPinIcon
  const progress = getProjectProgress(project, currentDate)
  const startedAt = new Date(project.startedAt)
  const isScheduled = startedAt.getTime() > currentDate.getTime()
  const pct = Math.round(progress.ratio * 100)

  let StatusIcon: LucideIcon = ClockIcon
  let statusLabel: string
  if (isScheduled) {
    StatusIcon = CalendarClockIcon
    statusLabel = `Starts ${dateFormatter.format(startedAt)}`
  } else if (progress.isComplete) {
    StatusIcon = CheckCircle2Icon
    statusLabel = `Completed ${dateFormatter.format(progress.expectedEndAt)}`
  } else {
    statusLabel = `${pct}% · ETA ${dateFormatter.format(progress.expectedEndAt)}`
  }

  return (
    <li className="flex items-start gap-2 rounded-md border border-border/60 bg-card/80 px-3 py-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="break-words font-medium leading-tight">
          {project.name}
        </div>
        <div className="mt-0.5 flex items-start gap-1 text-muted-foreground text-xs">
          <StatusIcon className="mt-0.5 size-3 shrink-0" />
          <span className="break-words">
            {statusLabel} · {project.location.label}
          </span>
        </div>
        {!isScheduled && !progress.isComplete && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary/80"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <div className="mt-1 text-muted-foreground text-xs tabular-nums">
          €{project.upfrontCost}M upfront · €{project.monthlyCost.toFixed(1)}M/mo
          · +{project.completionApproval} approval on complete
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`Cancel ${project.name}`}
        title="Cancel"
        onClick={onRemove}
      >
        <XIcon className="size-4" />
      </Button>
    </li>
  )
}
