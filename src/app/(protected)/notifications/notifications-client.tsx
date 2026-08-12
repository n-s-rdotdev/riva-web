"use client"

import { BellIcon, CheckCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"
import { notificationVisual, relativeTime } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

export function NotificationsClient() {
  const utils = api.useUtils()
  const listQuery = api.notifications.list.useQuery({ limit: 50 })
  const items = listQuery.data?.items ?? []
  const hasUnread = items.some((item) => !item.read)

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
      trackEvent(analyticsEvents.notificationMarkedAllRead, {
        platform: "web",
      })
      await refresh()
    },
  })

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Activity
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Notifications
          </h1>
        </div>
        {hasUnread ? (
          <Button
            variant="outline"
            size="sm"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheckIcon />
            Mark all read
          </Button>
        ) : null}
      </header>

      {listQuery.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <BellIcon className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Updates about your spaces and activity will show up here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const { Icon, accent } = notificationVisual(item.type)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={item.read || markRead.isPending}
                  onClick={() => {
                    trackEvent(analyticsEvents.notificationOpened, {
                      platform: "web",
                      notification_type: item.type,
                    })
                    if (!item.read) markRead.mutate({ id: item.id })
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                    item.read
                      ? "bg-card"
                      : "border-primary/30 bg-primary/5 hover:bg-primary/10",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted",
                      accent,
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {item.title}
                      </p>
                      {!item.read ? (
                        <span className="size-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    {item.body ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {item.body}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(item.createdAt)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
