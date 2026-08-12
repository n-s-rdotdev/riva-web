"use client"

import { useEffect, useState } from "react"
import { SparklesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"
import { api } from "@/trpc/react"

export function BillingClient() {
  const statusQuery = api.billing.getStatus.useQuery()
  const status = statusQuery.data
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (status) {
      trackEvent(analyticsEvents.billingViewed, {
        platform: "web",
        provider_configured: status.providerConfigured,
        tier: status.tier,
      })
    }
  }, [status])

  const startUpgrade = api.billing.startUpgrade.useMutation({
    onSuccess: (result) => {
      trackEvent(analyticsEvents.billingUpgradeStarted, { platform: "web" })
      if (!result.ok) {
        trackEvent(analyticsEvents.billingUpgradeUnavailable, {
          platform: "web",
          reason_code: result.reasonCode,
        })
        setNotice(result.message)
      }
    },
  })

  if (statusQuery.isPending || !status) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your plan and upgrade options.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Current plan
            </p>
            <p className="mt-1 text-2xl font-semibold capitalize">
              {status.tier}
            </p>
          </div>
          <Badge variant="secondary">Active</Badge>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{status.message}</p>

        <div className="mt-6 flex flex-col gap-3 border-t pt-5">
          <Button
            className="w-fit"
            disabled={startUpgrade.isPending}
            onClick={() => startUpgrade.mutate()}
          >
            <SparklesIcon />
            {startUpgrade.isPending ? "Checking…" : "Upgrade"}
          </Button>
          {notice ? (
            <p className="text-sm text-muted-foreground" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
