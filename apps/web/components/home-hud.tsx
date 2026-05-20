import Image from "next/image"
import type { ReactNode } from "react"

interface HomeHudProps {
  topLeft?: ReactNode
  topRight?: ReactNode
  bottomLeft?: ReactNode
  bottomRight?: ReactNode
}

export function HomeHud({
  topLeft,
  topRight,
  bottomLeft = <HomeHudCharacter />,
  bottomRight,
}: HomeHudProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1100]">
      {topLeft && (
        <div className="pointer-events-auto absolute top-0 left-0">
          {topLeft}
        </div>
      )}
      {topRight && (
        <div className="pointer-events-auto absolute top-0 right-0">
          {topRight}
        </div>
      )}
      {bottomLeft && (
        <div className="pointer-events-auto absolute bottom-0 left-0">
          {bottomLeft}
        </div>
      )}
      {bottomRight && (
        <div className="pointer-events-auto absolute right-0 bottom-0">
          {bottomRight}
        </div>
      )}
    </div>
  )
}

function HomeHudCharacter() {
  return (
    <div className="relative">
      <Image
        src="/characters/macron.png"
        alt="Macron"
        width={256}
        height={384}
        className="h-64 w-auto"
        priority
      />
      <FrenchFlag className="absolute bottom-2 left-2 h-8 w-auto drop-shadow-md" />
      <PresidentialActionsButton />
    </div>
  )
}

function PresidentialActionsButton() {
  return (
    <button
      type="button"
      aria-label="Presidential actions"
      title="Presidential actions"
      className="group absolute bottom-2 left-full ml-2 size-12 cursor-pointer rounded-md transition-transform hover:scale-105 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Image
        src="/icons/presidential-actions.png"
        alt=""
        width={200}
        height={200}
        className="size-full object-contain drop-shadow-md"
      />
    </button>
  )
}

function FrenchFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      className={className}
      aria-label="Flag of France"
    >
      <defs>
        <linearGradient
          id="french-flag-folds"
          x1="0"
          x2="30"
          y1="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.12" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="0.25" stopColor="#000" stopOpacity="0.25" />
          <stop offset="0.38" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0.2" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="0.75" stopColor="#000" stopOpacity="0.25" />
          <stop offset="0.88" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient
          id="french-flag-sheen"
          x1="0"
          x2="0"
          y1="0"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect x="0" width="10" height="20" fill="#000091" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#E1000F" />
      <rect width="30" height="20" fill="url(#french-flag-folds)" />
      <rect width="30" height="20" fill="url(#french-flag-sheen)" />
      <rect
        x="0.15"
        y="0.15"
        width="29.7"
        height="19.7"
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.3"
      />
    </svg>
  )
}
