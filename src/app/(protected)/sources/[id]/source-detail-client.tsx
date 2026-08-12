"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  CheckIcon,
  StarIcon,
  WalletCardsIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"
import { api } from "@/trpc/react"

const tabs = ["Overview", "Transactions", "Settings"]

export function SourceDetailClient({ sourceId }: { sourceId: string }) {
  const router = useRouter()
  const utils = api.useUtils()
  const sourceQuery = api.sources.getById.useQuery({ id: sourceId }, { retry: false })
  const setDefault = api.sources.setDefault.useMutation({
    onSuccess: async (result) => {
      trackEvent(analyticsEvents.sourceDefaultChanged, {
        platform: "web",
        source_id: result.defaultSourceId,
      })
      await utils.sources.getById.invalidate({ id: sourceId })
      await utils.sources.list.invalidate()
      await utils.account.me.invalidate()
    },
  })

  const source = sourceQuery.data

  if (sourceQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading source...</p>
  }

  if (sourceQuery.error || !source) {
    return (
      <div className="rounded-lg border bg-background p-8 text-center">
        <p className="text-sm font-medium">Source not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          You may not have access to this source, or it may have been removed.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/sources")}>
          Back to sources
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/sources"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Sources
      </Link>

      <header className="rounded-lg border bg-background p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <WalletCardsIcon className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                Sources / {source.spaceName ?? "Global"}
              </p>
              <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">
                {source.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {source.isDefault ? <Badge>Default</Badge> : null}
                <Badge variant="outline">{source.typeName}</Badge>
                <Badge variant="secondary">{source.spaceName ?? "Global"}</Badge>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            disabled={source.isDefault || setDefault.isPending}
            onClick={() => setDefault.mutate({ id: source.id })}
          >
            {source.isDefault ? <CheckIcon /> : <StarIcon />}
            {source.isDefault ? "Default" : "Set default"}
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Current balance" value={formatMoney(source.currentBalance)} />
        <MetricCard label="Opening balance" value={formatMoney(source.openingBalance)} />
        <MetricCard label="Transactions" value={source.transactionCount} />
        <MetricCard label="Scope" value={source.spaceName ? "Space" : "Global"} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-lg border bg-background">
          <div className="flex overflow-x-auto border-b px-3">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                className={`h-11 px-3 text-sm font-medium ${
                  index === 0
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground"
                }`}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="p-5">
            <h2 className="text-lg font-semibold">Overview</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Current balance is derived from the opening balance plus credits
              minus debits. Source settings and scoped transactions have a stable
              detail home here.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Placeholder title="Recent transactions" />
              <Placeholder title="Balance breakdown" />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <Panel title="Assignment">
            <p className="text-sm text-muted-foreground">
              {source.spaceName
                ? `Linked to ${source.spaceName}.`
                : "Global source for personal use."}
            </p>
          </Panel>
          <Panel title="Source type">
            <p className="text-sm text-muted-foreground">{source.typeName}</p>
          </Panel>
          <Panel title="Last updated">
            <p className="text-sm text-muted-foreground">
              {formatDate(source.updatedAt ?? source.createdAt)}
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
    </div>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">No data yet.</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatDate(value: Date | string | null) {
  if (!value) return "Not available"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}
