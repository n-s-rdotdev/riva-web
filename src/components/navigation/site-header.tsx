import Link from "next/link"

import { NotificationsBell } from "@/components/navigation/notifications-bell"
import { SiteCommand } from "@/components/navigation/site-command"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b bg-background">
      <div className="flex h-(--header-height) w-full items-center justify-between gap-2 px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Riva" className="size-8 dark:invert" />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate text-xl font-bold">Riva</span>
            <span className="-mt-1 truncate text-xs text-muted-foreground">
              v0.0.1
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <SiteCommand />
        </div>
      </div>
    </header>
  )
}
