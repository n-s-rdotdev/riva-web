"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  CheckIcon,
  PencilIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { analyticsEvents, setCurrentSpaceGroup, trackEvent } from "@/lib/analytics/web"
import { api } from "@/trpc/react"

const tabs = ["Overview", "Transactions", "Sources", "Members", "Settings"]

export function SpaceDetailClient({ spaceId }: { spaceId: string }) {
  const router = useRouter()
  const utils = api.useUtils()
  const [latestInvite, setLatestInvite] = useState<{
    inviteCode: string
    inviteCodeExpiresAt: Date | string | null
  } | null>(null)
  const spaceQuery = api.spaces.getById.useQuery({ id: spaceId }, { retry: false })
  const incomingRequests = api.spaces.listIncomingJoinRequests.useQuery(
    { spaceId, status: "pending" },
    { enabled: spaceQuery.data?.canManage === true },
  )
  const setDefault = api.spaces.setDefault.useMutation({
    onSuccess: async (result) => {
      trackEvent(analyticsEvents.spaceSelected, {
        platform: "web",
        space_id: result.defaultSpaceId,
      })
      setCurrentSpaceGroup(result.defaultSpaceId)
      await utils.spaces.getById.invalidate({ id: spaceId })
      await utils.spaces.list.invalidate()
      await utils.account.me.invalidate()
    },
  })
  const createInvite = api.spaces.createInviteCode.useMutation({
    onSuccess: async (invite) => {
      trackEvent(analyticsEvents.spaceInviteCreated, {
        platform: "web",
        space_id: invite.spaceId,
      })
      setLatestInvite(invite)
      await utils.spaces.getById.invalidate({ id: spaceId })
      await utils.spaces.list.invalidate()
    },
  })
  const acceptJoin = api.spaces.acceptJoinRequest.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.spaceJoinAccepted, { platform: "web" })
      await utils.spaces.listIncomingJoinRequests.invalidate()
      await utils.spaces.getById.invalidate({ id: spaceId })
      await utils.spaces.list.invalidate()
    },
  })
  const rejectJoin = api.spaces.rejectJoinRequest.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.spaceJoinRejected, { platform: "web" })
      await utils.spaces.listIncomingJoinRequests.invalidate()
    },
  })

  const space = spaceQuery.data

  if (spaceQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading space...</p>
  }

  if (spaceQuery.error || !space) {
    return (
      <div className="rounded-lg border bg-background p-8 text-center">
        <p className="text-sm font-medium">Space not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          You may not have access to this space, or it may have been removed.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/spaces")}>
          Back to spaces
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/spaces"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Spaces
      </Link>

      <header className="rounded-lg border bg-background p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
              {space.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Spaces / {space.name}</p>
              <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">
                {space.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {space.isDefault ? <Badge>Default</Badge> : null}
                <Badge variant="outline">{space.role}</Badge>
                {space.memberCount > 1 ? <Badge variant="secondary">Shared</Badge> : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={space.isDefault || setDefault.isPending}
              onClick={() => setDefault.mutate({ id: space.id })}
            >
              {space.isDefault ? <CheckIcon /> : <StarIcon />}
              {space.isDefault ? "Default" : "Set default"}
            </Button>
            {space.canManage ? (
              <Button variant="outline" disabled>
                <PencilIcon />
                Edit
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Members" value={space.memberCount} />
        <MetricCard label="Sources" value={space.sourceCount} />
        <MetricCard label="Transactions" value={space.transactionCount} />
        <MetricCard label="Role" value={space.role} />
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
              This space has {space.sourceCount} linked source
              {space.sourceCount === 1 ? "" : "s"}. Global sources stay personal
              and are managed from Sources without being counted here.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Placeholder title="Recent transactions" />
              <Placeholder title="Source breakdown" />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <Panel title="Members">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UsersIcon className="size-4" />
              {space.memberCount} member{space.memberCount === 1 ? "" : "s"}
            </div>
          </Panel>
          <Panel title="Invite code">
            {space.canManage ? (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => createInvite.mutate({ id: space.id })}
                  disabled={createInvite.isPending}
                >
                  Generate 24h code
                </Button>
                {latestInvite ? (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Invite code</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-sm tracking-[0.18em]">
                        {latestInvite.inviteCode}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigator.clipboard?.writeText(latestInvite.inviteCode)
                        }
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Expires {formatDateTime(latestInvite.inviteCodeExpiresAt)}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only the owner can manage invite codes.
              </p>
            )}
          </Panel>
          <Panel title="Join requests">
            {space.canManage ? (
              <div className="space-y-3">
                {(incomingRequests.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No pending requests.
                  </p>
                ) : null}
                {(incomingRequests.data ?? []).map((request) => (
                  <div key={request.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{request.requesterName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {formatDateTime(request.createdAt)}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => acceptJoin.mutate({ id: request.id })}
                        disabled={acceptJoin.isPending || rejectJoin.isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectJoin.mutate({ id: request.id })}
                        disabled={acceptJoin.isPending || rejectJoin.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Request review is owner-only.
              </p>
            )}
          </Panel>
          <Panel title="Permissions">
            <p className="text-sm text-muted-foreground">
              {space.canManage
                ? "You can manage this space."
                : "You can view this shared space."}
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
      <p className="mt-2 truncate text-2xl font-semibold capitalize">{value}</p>
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

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "soon"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
