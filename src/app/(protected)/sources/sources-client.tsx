"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  WalletCardsIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"
import { api } from "@/trpc/react"

type SourceScope = "all" | "global" | "space"
type SourceSort = "recent" | "name" | "balance"

type EditingSource = {
  id: string
  name: string
  typeId: string
  openingBalance: string
  spaceId: string
}

const globalSpaceValue = "__global__"

export function SourcesClient() {
  const utils = api.useUtils()
  const [search, setSearch] = useState("")
  const [scope, setScope] = useState<SourceScope>("all")
  const [sort, setSort] = useState<SourceSort>("recent")
  const [newSourceName, setNewSourceName] = useState("")
  const [newOpeningBalance, setNewOpeningBalance] = useState("0")
  const [selectedTypeId, setSelectedTypeId] = useState("")
  const [selectedSpaceId, setSelectedSpaceId] = useState(globalSpaceValue)
  const [newSourceTypeName, setNewSourceTypeName] = useState("")
  const [editingSource, setEditingSource] = useState<EditingSource | null>(null)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [editingTypeName, setEditingTypeName] = useState("")

  const sourcesQuery = api.sources.list.useQuery({
    page: 1,
    pageSize: 30,
    search: search.trim() || undefined,
    scope,
    sort,
  })
  const sourceTypesQuery = api.sourceTypes.list.useQuery()
  const spacesQuery = api.spaces.list.useQuery({ page: 1, pageSize: 50 })
  const sourceTypes = sourceTypesQuery.data ?? []
  const effectiveSelectedTypeId = selectedTypeId || sourceTypes[0]?.id || ""

  const createSource = api.sources.create.useMutation({
    onSuccess: async (source) => {
      trackEvent(analyticsEvents.sourceCreated, {
        platform: "web",
        source_id: source?.id ?? null,
        source_type_id: source?.typeId ?? null,
      })
      setNewSourceName("")
      setNewOpeningBalance("0")
      await invalidateSources()
    },
  })

  const updateSource = api.sources.update.useMutation({
    onSuccess: async (source) => {
      trackEvent(analyticsEvents.sourceUpdated, {
        platform: "web",
        source_id: source?.id ?? null,
        source_type_id: source?.typeId ?? null,
      })
      setEditingSource(null)
      await invalidateSources()
    },
  })

  const removeSource = api.sources.remove.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.sourceDeleted, { platform: "web" })
      await invalidateSources()
    },
  })

  const setDefault = api.sources.setDefault.useMutation({
    onSuccess: async (result) => {
      trackEvent(analyticsEvents.sourceDefaultChanged, {
        platform: "web",
        source_id: result.defaultSourceId,
      })
      await invalidateSources()
    },
  })

  const createSourceType = api.sourceTypes.create.useMutation({
    onSuccess: async (sourceType) => {
      trackEvent(analyticsEvents.sourceTypeCreated, {
        platform: "web",
        source_type_id: sourceType.id,
      })
      setNewSourceTypeName("")
      setSelectedTypeId(sourceType.id)
      await invalidateSources()
    },
  })

  const updateSourceType = api.sourceTypes.update.useMutation({
    onSuccess: async (sourceType) => {
      trackEvent(analyticsEvents.sourceTypeUpdated, {
        platform: "web",
        source_type_id: sourceType.id,
      })
      setEditingTypeId(null)
      setEditingTypeName("")
      await invalidateSources()
    },
  })

  const removeSourceType = api.sourceTypes.remove.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.sourceTypeDeleted, { platform: "web" })
      await invalidateSources()
    },
  })

  const mutationError =
    createSource.error?.message ??
    updateSource.error?.message ??
    removeSource.error?.message ??
    setDefault.error?.message ??
    createSourceType.error?.message ??
    updateSourceType.error?.message ??
    removeSourceType.error?.message

  const spaceOptions = useMemo(
    () => [
      { id: globalSpaceValue, name: "Global source" },
      ...(spacesQuery.data?.items ?? []).map((space) => ({
        id: space.id,
        name: space.name,
      })),
    ],
    [spacesQuery.data?.items],
  )

  async function invalidateSources() {
    await utils.sources.list.invalidate()
    await utils.sourceTypes.list.invalidate()
    await utils.account.me.invalidate()
  }

  function submitNewSource() {
    if (!newSourceName.trim() || !effectiveSelectedTypeId) return

    createSource.mutate({
      name: newSourceName.trim(),
      typeId: effectiveSelectedTypeId,
      openingBalance: Number(newOpeningBalance),
      spaceId: selectedSpaceId === globalSpaceValue ? null : selectedSpaceId,
    })
  }

  function startEditingSource(source: NonNullable<typeof sourcesQuery.data>["items"][number]) {
    setEditingSource({
      id: source.id,
      name: source.name,
      typeId: source.typeId,
      openingBalance: String(source.openingBalance),
      spaceId: source.spaceId ?? globalSpaceValue,
    })
  }

  function submitSourceEdit() {
    if (!editingSource) return

    updateSource.mutate({
      id: editingSource.id,
      name: editingSource.name.trim(),
      typeId: editingSource.typeId,
      openingBalance: Number(editingSource.openingBalance),
      spaceId:
        editingSource.spaceId === globalSpaceValue ? null : editingSource.spaceId,
    })
  }

  function submitNewSourceType() {
    const name = newSourceTypeName.trim()
    if (!name) return
    createSourceType.mutate({ name })
  }

  function submitTypeEdit() {
    if (!editingTypeId || !editingTypeName.trim()) return
    updateSourceType.mutate({ id: editingTypeId, name: editingTypeName.trim() })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Money sources
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sources</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage accounts, cards, wallets, cash, and opening balances.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Total sources" value={sourcesQuery.data?.summary.totalSources ?? 0} />
        <Metric
          label="Current balance"
          value={formatMoney(sourcesQuery.data?.summary.totalCurrentBalance ?? 0)}
        />
        <Metric label="Default" value={sourcesQuery.data?.summary.defaultSource ?? "None"} />
        <Metric label="Types used" value={sourcesQuery.data?.summary.sourceTypeCount ?? 0} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-background p-4">
            <h2 className="text-sm font-semibold">Add source</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                value={newSourceName}
                onChange={(event) => setNewSourceName(event.target.value)}
                placeholder="Source name"
              />
              <Input
                value={newOpeningBalance}
                onChange={(event) => setNewOpeningBalance(event.target.value)}
                type="number"
                step="0.01"
                placeholder="Opening balance"
              />
              <select
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                value={effectiveSelectedTypeId}
                onChange={(event) => setSelectedTypeId(event.target.value)}
                disabled={sourceTypes.length === 0}
              >
                {sourceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                value={selectedSpaceId}
                onChange={(event) => setSelectedSpaceId(event.target.value)}
              >
                {spaceOptions.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                disabled={
                  !newSourceName.trim() ||
                  !effectiveSelectedTypeId ||
                  createSource.isPending
                }
                onClick={submitNewSource}
              >
                <PlusIcon />
                Add source
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sources"
                className="pl-8"
              />
            </div>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as SourceScope)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
            >
              <option value="all">All</option>
              <option value="global">Global</option>
              <option value="space">Space-linked</option>
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SourceSort)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
            >
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="balance">Balance</option>
            </select>
          </div>

          {mutationError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {mutationError}
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {sourcesQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading sources...</p>
            ) : null}
            {sourcesQuery.data?.items.length === 0 ? (
              <div className="rounded-lg border bg-background p-8 text-center">
                <p className="text-sm font-medium">No sources found</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a source or adjust your filters.
                </p>
              </div>
            ) : null}
            {sourcesQuery.data?.items.map((source) => {
              const isEditing = editingSource?.id === source.id
              return (
                <article key={source.id} className="rounded-lg border bg-background p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <WalletCardsIcon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="space-y-3">
                          <Input
                            value={editingSource.name}
                            onChange={(event) =>
                              setEditingSource({ ...editingSource, name: event.target.value })
                            }
                          />
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={editingSource.openingBalance}
                              onChange={(event) =>
                                setEditingSource({
                                  ...editingSource,
                                  openingBalance: event.target.value,
                                })
                              }
                            />
                            <select
                              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                              value={editingSource.typeId}
                              onChange={(event) =>
                                setEditingSource({
                                  ...editingSource,
                                  typeId: event.target.value,
                                })
                              }
                            >
                              {sourceTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                  {type.name}
                                </option>
                              ))}
                            </select>
                            <select
                              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                              value={editingSource.spaceId}
                              onChange={(event) =>
                                setEditingSource({
                                  ...editingSource,
                                  spaceId: event.target.value,
                                })
                              }
                            >
                              {spaceOptions.map((space) => (
                                <option key={space.id} value={space.id}>
                                  {space.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Link
                            href={`/sources/${source.id}`}
                            className="block truncate text-lg font-semibold transition-colors hover:text-primary"
                          >
                            {source.name}
                          </Link>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {source.isDefault ? <Badge>Default</Badge> : null}
                            <Badge variant="outline">{source.typeName}</Badge>
                            <Badge variant="secondary">
                              {source.spaceName ?? "Global"}
                            </Badge>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Balance label="Opening" value={source.openingBalance} />
                    <Balance label="Current" value={source.currentBalance} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <Button onClick={submitSourceEdit} disabled={updateSource.isPending}>
                          <CheckIcon />
                          Save
                        </Button>
                        <Button variant="outline" onClick={() => setEditingSource(null)}>
                          <XIcon />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setDefault.mutate({ id: source.id })}
                          disabled={source.isDefault || setDefault.isPending}
                        >
                          <StarIcon />
                          Set default
                        </Button>
                        <Button variant="outline" onClick={() => startEditingSource(source)}>
                          <PencilIcon />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => removeSource.mutate({ id: source.id })}
                          disabled={removeSource.isPending}
                        >
                          <Trash2Icon />
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-background p-4">
            <h2 className="text-sm font-semibold">Source types</h2>
            <div className="mt-3 flex gap-2">
              <Input
                value={newSourceTypeName}
                onChange={(event) => setNewSourceTypeName(event.target.value)}
                placeholder="New type"
              />
              <Button onClick={submitNewSourceType} disabled={!newSourceTypeName.trim()}>
                Add
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {sourceTypes.map((type) => (
                <div key={type.id} className="flex items-center gap-2 rounded-lg border p-2">
                  {editingTypeId === type.id ? (
                    <>
                      <Input
                        value={editingTypeName}
                        onChange={(event) => setEditingTypeName(event.target.value)}
                      />
                      <Button size="icon" onClick={submitTypeEdit}>
                        <CheckIcon />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate text-sm">{type.name}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditingTypeId(type.id)
                          setEditingTypeName(type.name)
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeSourceType.mutate({ id: type.id })}
                      >
                        <Trash2Icon />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
    </div>
  )
}

function Balance({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{formatMoney(value)}</p>
    </div>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}
