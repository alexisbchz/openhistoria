"use client"

import {
  getProjectProgress,
  type Project,
  type ProjectKind,
  type ProjectProgress,
} from "@workspace/engine"
import {
  MapMarker,
  MapPopup,
  MapTooltip,
} from "@workspace/ui/components/map"
import {
  AtomIcon,
  BuildingIcon,
  CheckIcon,
  FactoryIcon,
  HandshakeIcon,
  LandmarkIcon,
  MapPinIcon,
  RouteIcon,
  ShieldIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"

import { useGame, useGameActions } from "@/components/game-provider"

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

const KIND_LABELS: Record<ProjectKind, string> = {
  "construction:nuclear": "Nuclear",
  "construction:industrial": "Industry",
  "construction:infrastructure": "Infrastructure",
  "construction:military": "Military",
  "construction:civilian": "Civilian",
  diplomacy: "Diplomacy",
  economic: "Economy",
  other: "Other",
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
})

function formatRemaining(days: number): string {
  if (days <= 0) return "—"
  if (days < 60) return `${Math.round(days)} day${days >= 1.5 ? "s" : ""}`
  const months = days / 30
  if (months < 24) return `${months.toFixed(1)} months`
  return `${(days / 365).toFixed(1)} years`
}

export function ProjectMarkers() {
  const game = useGame()
  const { cancelProject } = useGameActions()
  if (!game) return null

  return (
    <>
      {game.projects.map((project) => (
        <ProjectMarker
          key={project.id}
          project={project}
          progress={getProjectProgress(project, game.date)}
          currentDate={game.date}
          onCancel={() => cancelProject(project.id)}
        />
      ))}
    </>
  )
}

function ProjectMarker({
  project,
  progress,
  currentDate,
  onCancel,
}: {
  project: Project
  progress: ProjectProgress
  currentDate: Date
  onCancel: () => void
}) {
  const Icon = PROJECT_ICONS[project.kind] ?? MapPinIcon
  const pct = Math.round(progress.ratio * 100)
  const startedAt = new Date(project.startedAt)
  const isScheduled = startedAt.getTime() > currentDate.getTime()

  return (
    <MapMarker
      position={[project.location.latitude, project.location.longitude]}
      icon={<MarkerIcon icon={Icon} progress={progress} />}
      iconAnchor={[16, 16]}
      zIndex={500}
    >
      <MapTooltip>{project.name}</MapTooltip>
      <MapPopup className="min-w-[280px] max-w-[320px]">
        <div className="grid gap-3">
          <div className="grid gap-0.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Icon className="size-3" />
              <span>{KIND_LABELS[project.kind] ?? project.kind}</span>
              <span>·</span>
              <span className="truncate">{project.location.label}</span>
            </div>
            <div className="font-semibold leading-tight">{project.name}</div>
          </div>

          {project.description && (
            <p className="text-xs leading-snug text-muted-foreground">
              {project.description}
            </p>
          )}

          <div className="grid gap-1">
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className="text-muted-foreground">
                {isScheduled
                  ? "Scheduled"
                  : progress.isComplete
                    ? "Complete"
                    : `${pct}%`}
              </span>
              <span className="text-muted-foreground">
                {isScheduled
                  ? `Starts ${dateFormatter.format(startedAt)}`
                  : progress.isComplete
                    ? `Finished ${dateFormatter.format(progress.expectedEndAt)}`
                    : `ETA ${dateFormatter.format(progress.expectedEndAt)}`}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={
                  progress.isComplete
                    ? "h-full bg-emerald-500"
                    : isScheduled
                      ? "h-full bg-amber-500/70"
                      : "h-full bg-primary"
                }
                style={{ width: `${isScheduled ? 0 : pct}%` }}
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <DetailRow
              label="Start"
              value={dateFormatter.format(startedAt)}
            />
            <DetailRow
              label="Duration"
              value={`${project.expectedDurationDays} d`}
            />
            <DetailRow
              label="Elapsed"
              value={
                isScheduled
                  ? "—"
                  : `${Math.round(progress.elapsedDays)} d`
              }
            />
            <DetailRow
              label="Remaining"
              value={
                progress.isComplete
                  ? "—"
                  : formatRemaining(progress.remainingDays)
              }
            />
            <DetailRow
              label="Upfront"
              value={`€${project.upfrontCost.toLocaleString()}M`}
              accent="cost"
            />
            <DetailRow
              label="Monthly"
              value={`€${project.monthlyCost.toFixed(1)}M`}
              accent="cost"
            />
            <DetailRow
              label="On complete"
              value={`+${project.completionApproval} approval`}
              accent="bonus"
            />
            <DetailRow
              label=""
              value={`+€${project.completionGdp.toLocaleString()}M GDP`}
              accent="bonus"
            />
          </dl>

          {!progress.isComplete && (
            <button
              type="button"
              onClick={onCancel}
              className="self-start rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-400"
              title={
                isScheduled
                  ? "Cancel before it starts (full refund)"
                  : "Cancel — 50% refund scaled to remaining work"
              }
            >
              {isScheduled ? "Cancel" : "Cancel project"}
            </button>
          )}
        </div>
      </MapPopup>
    </MapMarker>
  )
}

function DetailRow({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: "cost" | "bonus"
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 tabular-nums">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          accent === "bonus"
            ? "font-medium text-emerald-600 dark:text-emerald-400"
            : accent === "cost"
              ? "font-medium text-foreground"
              : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  )
}

function MarkerIcon({
  icon: Icon,
  progress,
}: {
  icon: LucideIcon
  progress: ProjectProgress
}) {
  const radius = 14
  const stroke = 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress.ratio)

  return (
    <div className="relative size-8">
      <svg
        viewBox="0 0 32 32"
        className="absolute inset-0 size-full -rotate-90"
        aria-hidden
      >
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.2)"
          strokeWidth={stroke}
        />
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke={progress.isComplete ? "#10b981" : "#3b82f6"}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className={
          progress.isComplete
            ? "absolute inset-1 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-md"
            : "absolute inset-1 flex items-center justify-center rounded-full bg-background text-foreground shadow-md"
        }
      >
        {progress.isComplete ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <Icon className="size-3.5" />
        )}
      </div>
    </div>
  )
}
