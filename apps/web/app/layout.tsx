import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"

import "@workspace/ui/globals.css"
import { GameProvider } from "@/components/game-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"

export const metadata: Metadata = {
  title: {
    default: "Open Historia",
    template: "%s · Open Historia",
  },
  description:
    "A grand strategy sandbox game. Open source alternative to Pax Historia.",
  applicationName: "Open Historia",
  openGraph: {
    title: "Open Historia",
    siteName: "Open Historia",
    type: "website",
  },
  twitter: {
    title: "Open Historia",
    card: "summary_large_image",
  },
}

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ThemeProvider>
          <GameProvider>{children}</GameProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
