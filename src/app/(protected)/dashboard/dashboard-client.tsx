"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowUpRightIcon,
  LayoutDashboardIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

type Preset = "month" | "30d" | "year" | "all"

export function DashboardClient() {
  const [spaceId, setSpaceId] = useState("")
  const [preset, setPreset] = useState<Preset>("month")
  const spacesQuery = api.spaces.list.useQuery({ page: 1, pageSize: 50 })
  const dashboardQuery = api.dashboard.getOverview.useQuery({
    spaceId: spaceId || undefined,
    preset,
  })
  const overview = dashboardQuery.data
  const spaces = spacesQuery.data?.items ?? []

  useEffect(() => {
    if (!overview) return

    trackEvent(analyticsEvents.dashboardViewed, {
      platform: "web",
      space_id: overview.space?.id ?? null,
      date_range_preset: preset,
      has_transactions: overview.summary.hasTransactions,
      has_sources: overview.summary.hasSources,
      transaction_count_bucket: bucketCount(overview.summary.transactionCount),
      source_count_bucket: bucketCount(overview.summary.sourceCount),
      label_count_bucket: bucketCount(overview.summary.labelCount),
    })
  }, [overview, preset])

  function changePreset(value: Preset) {
    setPreset(value)
    trackEvent(analyticsEvents.dashboardFilterChanged, {
      platform: "web",
      date_range_preset: value,
      space_id: overview?.space?.id ?? null,
    })
  }

  function changeSpace(value: string) {
    setSpaceId(value)
    trackEvent(analyticsEvents.dashboardFilterChanged, {
      platform: "web",
      date_range_preset: preset,
      space_id: value || null,
    })
  }

  if (dashboardQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading dashboard...</p>
  }

  if (!overview?.space) {
    return (
      <div className="rounded-lg border bg-background p-8 text-center">
        <LayoutDashboardIcon className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">No dashboard data yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a space and source to start seeing summaries.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Default-space financial overview for {overview.space.name}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={spaceId}
            onChange={(event) => changeSpace(event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none"
          >
            <option value="">Default space</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
          <select
            value={preset}
            onChange={(event) => changePreset(event.target.value as Preset)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none"
          >
            <option value="month">This month</option>
            <option value="30d">Last 30 days</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
          </select>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Current balance" value={formatMoney(overview.summary.currentBalance)} />
        <Metric label="Credits" value={formatMoney(overview.summary.credits)} tone="positive" />
        <Metric label="Debits" value={formatMoney(overview.summary.debits)} tone="negative" />
        <Metric
          label="Net movement"
          value={formatMoney(overview.summary.net)}
          tone={overview.summary.net >= 0 ? "positive" : "negative"}
        />
      </section>

      {!overview.summary.hasTransactions ? (
        <div className="rounded-lg border bg-background p-5">
          <p className="text-sm font-medium">No dashboard data yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add transactions to fill summaries and charts.
          </p>
          <Link className="mt-4 inline-flex text-sm font-medium text-primary" href="/transactions">
            Add entry
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-lg border bg-background p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Cashflow</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {overview.dateRange.label}
                </p>
              </div>
              <Badge variant="secondary">{overview.cashflowSeries.length} points</Badge>
            </div>
            <div className="mt-5 grid gap-2">
              {overview.cashflowSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enough transaction data yet.
                </p>
              ) : null}
              {overview.cashflowSeries.slice(-10).map((point) => (
                <div key={point.date} className="grid grid-cols-[6rem_1fr_5rem] items-center gap-3">
                  <span className="text-xs text-muted-foreground">{point.date}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        point.net >= 0 ? "bg-emerald-500" : "bg-rose-500",
                      )}
                      style={{
                        width: `${Math.max(8, Math.min(100, Math.abs(point.net)))}%`,
                      }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-right text-xs font-medium",
                      point.net >= 0 ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {formatMoney(point.net)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <BreakdownPanel
              title="Source breakdown"
              empty="No sources in this view yet."
              rows={overview.sourceBreakdown.map((source) => ({
                id: source.id,
                label: source.typeName,
                detail: source.name,
                value: formatMoney(source.currentBalance),
                share: source.share,
              }))}
            />
            <BreakdownPanel
              title="Label breakdown"
              empty="No labeled transactions yet."
              rows={overview.labelBreakdown.map((label) => ({
                id: label.id,
                label: label.name,
                detail: `${label.count} transaction${label.count === 1 ? "" : "s"}`,
                value: formatMoney(label.net),
                share: label.share,
              }))}
            />
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent transactions</h2>
              <Link className="text-xs font-medium text-primary" href="/transactions">
                View all
              </Link>
            </div>
            <div className="mt-3 space-y-3">
              {overview.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : null}
              {overview.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {transaction.description}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {transaction.sourceName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      transaction.type === "credit" ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {transaction.type === "credit" ? "+" : "-"}
                    {formatMoney(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-background p-4">
            <h2 className="text-sm font-semibold">Quick links</h2>
            <div className="mt-3 space-y-2">
              {overview.quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  {link.label}
                  <ArrowUpRightIcon className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string | number
  tone?: "neutral" | "positive" | "negative"
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 truncate text-2xl font-semibold",
          tone === "positive" && "text-emerald-500",
          tone === "negative" && "text-rose-500",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function BreakdownPanel({
  title,
  rows,
  empty,
}: {
  title: string
  empty: string
  rows: Array<{
    id: string
    label: string
    detail: string
    value: string
    share: number
  }>
}) {
  return (
    <section className="rounded-lg border bg-background p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : null}
        {rows.map((row) => (
          <div key={row.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{row.label}</p>
                <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
              </div>
              <span className="font-medium">{row.value}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${row.share}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function bucketCount(value: number) {
  if (value === 0) return "0"
  if (value < 5) return "1-4"
  if (value < 20) return "5-19"
  return "20+"
}
