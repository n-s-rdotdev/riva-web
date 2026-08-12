"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  CheckIcon,
  CrownIcon,
  InboxIcon,
  LayoutGridIcon,
  ListIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SquareStackIcon,
  StarIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { analyticsEvents, setCurrentSpaceGroup, trackEvent } from "@/lib/analytics/web"
import { api } from "@/trpc/react"

type SpaceFilter = "all" | "default" | "shared" | "owned" | "member"
type SpaceSort = "recent" | "name" | "created"
type SpaceView = "grid" | "list"

type SpaceItem = {
  id: string
  name: string
  role: "owner" | "member"
  isDefault: boolean
  memberCount: number
  sourceCount: number
  transactionCount: number
}

type InviteResult = {
  spaceId: string
  inviteCode: string
  inviteCodeExpiresAt: Date | string | null
}

export function SpacesClient() {
  const utils = api.useUtils()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<SpaceFilter>("all")
  const [sort, setSort] = useState<SpaceSort>("recent")
  const [view, setView] = useState<SpaceView>("grid")
  const [creating, setCreating] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState("")
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [managedSpaceId, setManagedSpaceId] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [latestInvite, setLatestInvite] = useState<InviteResult | null>(null)

  const spacesQuery = api.spaces.list.useQuery({
    page: 1,
    pageSize: 24,
    search: search.trim() || undefined,
    filter,
    sort,
  })

  const createSpace = api.spaces.create.useMutation({
    onSuccess: async (space) => {
      trackEvent(analyticsEvents.spaceCreated, {
        platform: "web",
        space_id: space.id,
      })
      setNewSpaceName("")
      setCreating(false)
      await utils.spaces.list.invalidate()
      await utils.account.me.invalidate()
    },
  })

  const updateSpace = api.spaces.update.useMutation({
    onSuccess: async (space) => {
      trackEvent(analyticsEvents.spaceUpdated, {
        platform: "web",
        space_id: space.id,
      })
      setEditingSpaceId(null)
      setEditingName("")
      await utils.spaces.list.invalidate()
    },
  })

  const removeSpace = api.spaces.remove.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.spaceRemoved, {
        platform: "web",
      })
      await utils.spaces.list.invalidate()
      await utils.account.me.invalidate()
    },
  })

  const setDefault = api.spaces.setDefault.useMutation({
    onSuccess: async (result) => {
      trackEvent(analyticsEvents.spaceSelected, {
        platform: "web",
        space_id: result.defaultSpaceId,
      })
      setCurrentSpaceGroup(result.defaultSpaceId)
      await utils.spaces.list.invalidate()
      await utils.account.me.invalidate()
    },
  })

  const data = spacesQuery.data
  const summary = data?.summary
  const items = useMemo(() => data?.items ?? [], [data?.items])
  const ownedSpaces = useMemo(
    () => items.filter((space) => space.role === "owner"),
    [items],
  )
  const activeManagedSpaceId =
    managedSpaceId ||
    ownedSpaces.find((space) => space.isDefault)?.id ||
    ownedSpaces[0]?.id ||
    ""
  const hasSpaces = (summary?.totalSpaces ?? 0) > 0
  const normalizedJoinCode = joinCode.trim().toUpperCase()
  const invitePreview = api.spaces.getInvitePreview.useQuery(
    { code: normalizedJoinCode },
    {
      enabled: normalizedJoinCode.length === 14,
      retry: false,
    },
  )
  const incomingRequests = api.spaces.listIncomingJoinRequests.useQuery(
    {
      spaceId: activeManagedSpaceId || undefined,
      status: "pending",
    },
    { enabled: ownedSpaces.length > 0 },
  )
  const outgoingRequests = api.spaces.listOutgoingJoinRequests.useQuery({
    status: "pending",
  })

  const createInvite = api.spaces.createInviteCode.useMutation({
    onSuccess: async (invite) => {
      trackEvent(analyticsEvents.spaceInviteCreated, {
        platform: "web",
        space_id: invite.spaceId,
      })
      setLatestInvite(invite)
      await utils.spaces.getById.invalidate({ id: invite.spaceId })
      await utils.spaces.list.invalidate()
    },
  })

  const requestJoin = api.spaces.requestJoin.useMutation({
    onSuccess: async (request) => {
      trackEvent(analyticsEvents.spaceJoinRequested, {
        platform: "web",
        space_id: request.spaceId,
        request_status: request.status,
      })
      setJoinCode("")
      await utils.spaces.listOutgoingJoinRequests.invalidate()
    },
  })

  const acceptJoin = api.spaces.acceptJoinRequest.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.spaceJoinAccepted, { platform: "web" })
      await invalidateJoinRequestViews()
    },
  })

  const rejectJoin = api.spaces.rejectJoinRequest.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.spaceJoinRejected, { platform: "web" })
      await invalidateJoinRequestViews()
    },
  })

  const cancelJoin = api.spaces.cancelJoinRequest.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.spaceJoinCanceled, { platform: "web" })
      await invalidateJoinRequestViews()
    },
  })
  const mutationError =
    createSpace.error?.message ??
    updateSpace.error?.message ??
    removeSpace.error?.message ??
    setDefault.error?.message ??
    createInvite.error?.message ??
    requestJoin.error?.message ??
    acceptJoin.error?.message ??
    rejectJoin.error?.message ??
    cancelJoin.error?.message

  async function invalidateJoinRequestViews() {
    await utils.spaces.listIncomingJoinRequests.invalidate()
    await utils.spaces.listOutgoingJoinRequests.invalidate()
    await utils.spaces.list.invalidate()
    await utils.account.me.invalidate()
  }

  function submitNewSpace() {
    const name = newSpaceName.trim()

    if (!name) {
      return
    }

    createSpace.mutate({ name })
  }

  function startEditing(space: { id: string; name: string }) {
    setEditingSpaceId(space.id)
    setEditingName(space.name)
  }

  function submitEdit(spaceId: string) {
    const name = editingName.trim()

    if (!name) {
      return
    }

    updateSpace.mutate({ id: spaceId, name })
  }

  function confirmRemove(spaceId: string) {
    if (!window.confirm("Remove this space?")) {
      return
    }

    removeSpace.mutate({ id: spaceId })
  }

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------- Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Workspace
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
            Spaces
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage your personal and shared spaces.
          </p>
        </div>

        {creating ? (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Input
              autoFocus
              value={newSpaceName}
              onChange={(event) => setNewSpaceName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitNewSpace()
                if (event.key === "Escape") {
                  setCreating(false)
                  setNewSpaceName("")
                }
              }}
              placeholder="Name your space"
              className="h-9 bg-white/[0.02] sm:w-56"
            />
            <Button
              className="h-9"
              onClick={submitNewSpace}
              disabled={createSpace.isPending || !newSpaceName.trim()}
            >
              <CheckIcon />
              Create
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Cancel"
              onClick={() => {
                setCreating(false)
                setNewSpaceName("")
              }}
            >
              <XIcon />
            </Button>
          </div>
        ) : (
          <Button className="h-9" onClick={() => setCreating(true)}>
            <PlusIcon />
            New space
          </Button>
        )}
      </header>

      {/* ------------------------------------------------------------ Metrics */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={SquareStackIcon}
          label="Total spaces"
          value={summary?.totalSpaces ?? 0}
        />
        <MetricCard
          icon={StarIcon}
          label="Default"
          value={summary?.defaultSpace ?? "None"}
          accent
        />
        <MetricCard
          icon={UsersIcon}
          label="Shared"
          value={summary?.sharedSpaces ?? 0}
        />
        <MetricCard
          icon={CrownIcon}
          label="Owned"
          value={summary?.ownedSpaces ?? 0}
        />
      </section>

      {mutationError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          {mutationError}
        </p>
      ) : null}

      {/* --------------------------------------------------- Content + rail */}
      <div
        className={cn(
          "grid gap-6",
          hasSpaces && "xl:grid-cols-[minmax(0,1fr)_320px]",
        )}
      >
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search spaces"
                className="h-9 border-white/[0.08] bg-white/[0.02] pl-9"
              />
            </div>
            <Toolbarselect
              value={filter}
              onChange={(value) => setFilter(value as SpaceFilter)}
              options={[
                ["all", "All"],
                ["default", "Default"],
                ["shared", "Shared"],
                ["owned", "Owned"],
                ["member", "Member"],
              ]}
            />
            <Toolbarselect
              value={sort}
              onChange={(value) => setSort(value as SpaceSort)}
              options={[
                ["recent", "Recent"],
                ["name", "Name"],
                ["created", "Created"],
              ]}
            />
            <div className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
              <ViewToggle
                active={view === "grid"}
                onClick={() => setView("grid")}
                icon={LayoutGridIcon}
                label="Grid view"
              />
              <ViewToggle
                active={view === "list"}
                onClick={() => setView("list")}
                icon={ListIcon}
                label="List view"
              />
            </div>
          </div>

          {/* Results */}
          {spacesQuery.isPending ? (
            <div
              className={cn(
                "grid gap-4",
                view === "grid" ? "sm:grid-cols-2" : "grid-cols-1",
              )}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]"
                />
              ))}
            </div>
          ) : !hasSpaces ? (
            <EmptyState
              icon={SquareStackIcon}
              title="Create your first space"
              body="Spaces keep personal, family, and business money apart. Start with one and add sources and transactions inside it."
              action={
                <Button onClick={() => setCreating(true)}>
                  <PlusIcon />
                  New space
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title="No spaces match"
              body="Try a different search term or clear your filters to see every space."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("")
                    setFilter("all")
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div
              className={cn(
                "grid gap-4",
                view === "grid" ? "sm:grid-cols-2" : "grid-cols-1",
              )}
            >
              {items.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  view={view}
                  isEditing={editingSpaceId === space.id}
                  editingName={editingName}
                  onEditingNameChange={setEditingName}
                  onSubmitEdit={() => submitEdit(space.id)}
                  onCancelEdit={() => setEditingSpaceId(null)}
                  onStartEdit={() => startEditing(space)}
                  onSetDefault={() => setDefault.mutate({ id: space.id })}
                  onRemove={() => confirmRemove(space.id)}
                  busy={
                    setDefault.isPending ||
                    updateSpace.isPending ||
                    removeSpace.isPending
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- Rail */}
        {hasSpaces ? (
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <RailCard eyebrow="Default space">
              {summary?.defaultSpace ? (
                <>
                  <div className="flex items-center gap-2">
                    <StarIcon className="size-4 fill-primary text-primary" />
                    <span className="truncate font-heading text-lg font-semibold">
                      {summary.defaultSpace}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    New transactions and quick actions land here by default.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No default space yet. Set one so new activity has a home.
                </p>
              )}
            </RailCard>

            <RailCard eyebrow="At a glance">
              <div className="space-y-3">
                <BreakdownRow
                  label="Owned"
                  value={summary?.ownedSpaces ?? 0}
                  total={summary?.totalSpaces ?? 0}
                />
                <BreakdownRow
                  label="Shared"
                  value={summary?.sharedSpaces ?? 0}
                  total={summary?.totalSpaces ?? 0}
                />
                <BreakdownRow
                  label="Member"
                  value={summary?.memberSpaces ?? 0}
                  total={summary?.totalSpaces ?? 0}
                />
              </div>
            </RailCard>

            <RailCard eyebrow="Join requests">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Invite management</p>
                  {ownedSpaces.length > 0 ? (
                    <>
                      <select
                        value={activeManagedSpaceId}
                        onChange={(event) => {
                          setManagedSpaceId(event.target.value)
                          setLatestInvite(null)
                        }}
                        className="h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 text-sm outline-none"
                      >
                        {ownedSpaces.map((space) => (
                          <option key={space.id} value={space.id} className="bg-popover">
                            {space.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() =>
                          activeManagedSpaceId &&
                          createInvite.mutate({ id: activeManagedSpaceId })
                        }
                        disabled={!activeManagedSpaceId || createInvite.isPending}
                      >
                        Generate 24h code
                      </Button>
                      {latestInvite?.spaceId === activeManagedSpaceId ? (
                        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
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
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Own a space to create invite codes.
                    </p>
                  )}
                </div>

                <div className="space-y-2 border-t border-white/[0.06] pt-4">
                  <p className="text-sm font-medium">Request to join</p>
                  <Input
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value)}
                    placeholder="XXXX-XXXX-XXXX"
                    className="h-8 bg-white/[0.02] font-mono uppercase"
                  />
                  {invitePreview.data ? (
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                      <p className="text-sm font-medium">{invitePreview.data.spaceName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {invitePreview.data.memberCount} member
                        {invitePreview.data.memberCount === 1 ? "" : "s"} · expires{" "}
                        {formatDateTime(invitePreview.data.expiresAt)}
                      </p>
                    </div>
                  ) : null}
                  {invitePreview.error ? (
                    <p className="text-xs text-destructive">
                      {invitePreview.error.message}
                    </p>
                  ) : null}
                  <Button
                    className="w-full"
                    disabled={
                      normalizedJoinCode.length !== 14 ||
                      requestJoin.isPending ||
                      !invitePreview.data
                    }
                    onClick={() => requestJoin.mutate({ code: normalizedJoinCode })}
                  >
                    Request access
                  </Button>
                </div>

                <RequestList
                  title="Incoming"
                  empty="No incoming requests."
                  requests={incomingRequests.data ?? []}
                  action={(request) => (
                    <div className="flex gap-2">
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
                  )}
                />

                <RequestList
                  title="Outgoing"
                  empty="No outgoing requests."
                  requests={outgoingRequests.data ?? []}
                  action={(request) => (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelJoin.mutate({ id: request.id })}
                      disabled={cancelJoin.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                />
              </div>
            </RailCard>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Space card */

function SpaceCard({
  space,
  view,
  isEditing,
  editingName,
  onEditingNameChange,
  onSubmitEdit,
  onCancelEdit,
  onStartEdit,
  onSetDefault,
  onRemove,
  busy,
}: {
  space: SpaceItem
  view: SpaceView
  isEditing: boolean
  editingName: string
  onEditingNameChange: (value: string) => void
  onSubmitEdit: () => void
  onCancelEdit: () => void
  onStartEdit: () => void
  onSetDefault: () => void
  onRemove: () => void
  busy: boolean
}) {
  const isShared = space.memberCount > 1
  const isOwner = space.role === "owner"

  const header = (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 text-sm font-semibold text-primary ring-1 ring-primary/25 ring-inset",
          view === "list" && "size-10",
        )}
      >
        {space.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              autoFocus
              value={editingName}
              onChange={(event) => onEditingNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSubmitEdit()
                if (event.key === "Escape") onCancelEdit()
              }}
              className="h-8 bg-white/[0.02]"
            />
            <Button
              size="icon-sm"
              className="size-8"
              onClick={onSubmitEdit}
              aria-label="Save space name"
            >
              <CheckIcon />
            </Button>
          </div>
        ) : (
          <Link
            href={`/spaces/${space.id}`}
            className="group/name inline-flex max-w-full items-center gap-1.5 font-heading text-base font-semibold transition-colors hover:text-primary"
          >
            <span className="truncate">{space.name}</span>
            <ArrowRightIcon className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/name:opacity-100" />
          </Link>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {space.isDefault ? <Badge>Default</Badge> : null}
          <Badge variant="outline" className="capitalize">
            {isOwner ? (
              <CrownIcon className="text-primary" />
            ) : (
              <UsersIcon />
            )}
            {space.role}
          </Badge>
          {isShared ? (
            <Badge variant="secondary">
              <UsersIcon />
              Shared
            </Badge>
          ) : null}
        </div>
      </div>
      {!isEditing ? (
        <SpaceMenu
          space={space}
          busy={busy}
          onStartEdit={onStartEdit}
          onSetDefault={onSetDefault}
          onRemove={onRemove}
        />
      ) : null}
    </div>
  )

  const stats = (
    <div className={cn("grid gap-2.5", view === "list" ? "grid-cols-3 sm:w-96" : "grid-cols-3")}>
      <Stat icon={UsersIcon} label="Members" value={space.memberCount} />
      <Stat icon={SquareStackIcon} label="Sources" value={space.sourceCount} />
      <Stat
        icon={ArrowLeftRightIcon}
        label="Transactions"
        value={space.transactionCount}
      />
    </div>
  )

  const open = (
    <Link
      href={`/spaces/${space.id}`}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
    >
      Open
    </Link>
  )

  if (view === "list") {
    return (
      <article
        className={cn(
          "flex flex-col gap-4 rounded-xl border bg-white/[0.02] p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
          space.isDefault ? "border-primary/30" : "border-white/[0.07] hover:border-white/[0.14]",
        )}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <div className="flex items-center gap-4 sm:gap-6">
          {stats}
          {open}
        </div>
      </article>
    )
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-white/[0.02] p-4 transition-all duration-200 hover:-translate-y-0.5",
        space.isDefault
          ? "border-primary/30 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_20%,transparent),0_20px_48px_-32px_color-mix(in_oklch,var(--primary)_40%,transparent)]"
          : "border-white/[0.07] hover:border-primary/30 hover:shadow-[0_20px_48px_-32px_rgba(0,0,0,0.8)]",
      )}
    >
      {header}
      {stats}
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-3.5">
        {open}
        {!space.isDefault ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={onSetDefault}
            disabled={busy}
          >
            <StarIcon />
            Set default
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-primary">
            <StarIcon className="size-3.5 fill-primary" />
            Default space
          </span>
        )}
      </div>
    </article>
  )
}

function SpaceMenu({
  space,
  busy,
  onStartEdit,
  onSetDefault,
  onRemove,
}: {
  space: SpaceItem
  busy: boolean
  onStartEdit: () => void
  onSetDefault: () => void
  onRemove: () => void
}) {
  const canSetDefault = !space.isDefault
  const isOwner = space.role === "owner"

  if (!canSetDefault && !isOwner) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Space actions"
          >
            <MoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        {canSetDefault ? (
          <DropdownMenuItem onClick={onSetDefault} disabled={busy}>
            <StarIcon />
            Set as default
          </DropdownMenuItem>
        ) : null}
        {isOwner ? (
          <>
            <DropdownMenuItem onClick={onStartEdit}>
              <PencilIcon />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={onRemove}
              disabled={busy}
            >
              <Trash2Icon />
              Remove
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------- Small pieces */

function MetricCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        accent
          ? "border-primary/25 bg-gradient-to-b from-primary/[0.07] to-transparent"
          : "border-white/[0.07] bg-white/[0.02]",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
        <Icon className={cn("size-4", accent ? "text-primary" : "text-muted-foreground/60")} />
      </div>
      <p className="mt-3 truncate text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-0.5 font-heading text-base font-semibold">{value}</p>
    </div>
  )
}

function RailCard({
  eyebrow,
  children,
}: {
  eyebrow: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function RequestList({
  title,
  empty,
  requests,
  action,
}: {
  title: string
  empty: string
  requests: Array<{
    id: string
    spaceName: string
    requesterName?: string
    status: string | null
    createdAt: Date | string | null
  }>
  action: (request: {
    id: string
    spaceName: string
    requesterName?: string
    status: string | null
    createdAt: Date | string | null
  }) => React.ReactNode
}) {
  return (
    <div className="space-y-2 border-t border-white/[0.06] pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <span className="text-xs text-muted-foreground">{requests.length}</span>
      </div>
      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/[0.04] text-muted-foreground ring-1 ring-white/[0.06]">
            <InboxIcon className="size-4" />
          </span>
          <p className="text-xs text-muted-foreground">{empty}</p>
        </div>
      ) : null}
      {requests.map((request) => (
        <div
          key={request.id}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {request.requesterName ?? request.spaceName}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {request.requesterName ? request.spaceName : request.status}
              </p>
            </div>
            <Badge variant="outline">{request.status ?? "pending"}</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Requested {formatDateTime(request.createdAt)}
          </p>
          <div className="mt-3">{action(request)}</div>
        </div>
      ))}
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  total,
}: {
  label: string
  value: number
  total: number
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-primary/60 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
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

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.01] px-6 py-14 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Icon className="size-5" />
      </span>
      <p className="font-heading text-base font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

function ViewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-white/[0.08] text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}

function Toolbarselect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: [string, string][]
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-sm outline-none transition-colors hover:border-white/[0.14] focus-visible:border-ring"
    >
      {options.map(([optValue, optLabel]) => (
        <option key={optValue} value={optValue} className="bg-popover">
          {optLabel}
        </option>
      ))}
    </select>
  )
}
