"use client"

import { useState } from "react"
import Link from "next/link"
import { BellIcon, CheckCheckIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"
import { notificationVisual, relativeTime } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const utils = api.useUtils()

  const unreadQuery = api.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 60 * 1000,
  })
  const unread = unreadQuery.data?.count ?? 0

  // Only fetch the list while the popover is open.
  const listQuery = api.notifications.list.useQuery(
    { limit: 6 },
    { enabled: open },
  )
  const items = listQuery.data?.items ?? []

  const refresh = async () => {
    await Promise.all([
      utils.notifications.list.invalidate(),
      utils.notifications.unreadCount.invalidate(),
    ])
  }

  const markRead = api.notifications.markRead.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.notificationMarkedRead, { platform: "web" })
      await refresh()
    },
  })

  const markAllRead = api.notifications.markAllRead.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.notificationMarkedAllRead, { platform: "web" })
      await refresh()
    },
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
            }
          />
        }
      >
        <BellIcon />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheckIcon className="size-3.5" />
              Mark all read
            </button>
          ) : null}
        </div>

        {listQuery.isPending && open ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Activity in your spaces will show up here.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {items.map((item) => {
                const { Icon, accent } = notificationVisual(item.type)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        trackEvent(analyticsEvents.notificationOpened, {
                          platform: "web",
                          notification_type: item.type,
                        })
                        if (!item.read) markRead.mutate({ id: item.id })
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                        !item.read && "bg-primary/5",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted",
                          accent,
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        {item.body ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {item.body}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {relativeTime(item.createdAt)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}

        <div className="border-t p-2">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-full",
            )}
          >
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
