"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

type TransactionType = "debit" | "credit"
type SortMode = "recent" | "date" | "amount"

type FormState = {
  id: string | null
  description: string
  amount: string
  type: TransactionType
  date: string
  isAnExpense: boolean
  sourceId: string
  spaceId: string
  labelIds: string[]
}

const initialForm = (): FormState => ({
  id: null,
  description: "",
  amount: "",
  type: "debit",
  date: new Date().toISOString().slice(0, 10),
  isAnExpense: true,
  sourceId: "",
  spaceId: "",
  labelIds: [],
})

export function TransactionsClient() {
  const utils = api.useUtils()
  const [search, setSearch] = useState("")
  const [type, setType] = useState<"all" | TransactionType>("all")
  const [expenseOnly, setExpenseOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>("recent")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [spaceId, setSpaceId] = useState("")
  const [sourceId, setSourceId] = useState("")
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [form, setForm] = useState<FormState>(() => initialForm())
  const [formOpen, setFormOpen] = useState(false)

  const spacesQuery = api.spaces.list.useQuery({ page: 1, pageSize: 50 })
  const sourcesQuery = api.sources.list.useQuery({ page: 1, pageSize: 50 })
  const labelsQuery = api.labels.list.useQuery()
  const spaces = useMemo(() => spacesQuery.data?.items ?? [], [spacesQuery.data?.items])
  const sources = useMemo(() => sourcesQuery.data?.items ?? [], [sourcesQuery.data?.items])
  const labels = labelsQuery.data ?? []
  const effectiveSpaceId = form.spaceId || spaces[0]?.id || ""
  const effectiveSourceId = form.sourceId || sources[0]?.id || ""

  const transactionsQuery = api.transactions.list.useQuery({
    page: 1,
    pageSize: 50,
    search: search.trim() || undefined,
    type: type === "all" ? undefined : type,
    isAnExpense: expenseOnly ? true : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    spaceId: spaceId || undefined,
    sourceId: sourceId || undefined,
    labelIds,
    sort,
  })

  const createTransaction = api.transactions.create.useMutation({
    onSuccess: async (transaction) => {
      trackEvent(analyticsEvents.transactionCreated, {
        platform: "web",
        transaction_type: transaction?.type ?? null,
        has_labels: (transaction?.labels.length ?? 0) > 0,
      })
      closeForm()
      await invalidateTransactions()
    },
  })

  const updateTransaction = api.transactions.update.useMutation({
    onSuccess: async (transaction) => {
      trackEvent(analyticsEvents.transactionUpdated, {
        platform: "web",
        transaction_type: transaction?.type ?? null,
        has_labels: (transaction?.labels.length ?? 0) > 0,
      })
      closeForm()
      await invalidateTransactions()
    },
  })

  const removeTransaction = api.transactions.remove.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.transactionDeleted, { platform: "web" })
      closeForm()
      await invalidateTransactions()
    },
  })

  const activeFilters = [
    search.trim() ? "Search" : null,
    type !== "all" ? type : null,
    expenseOnly ? "Expense" : null,
    dateFrom || dateTo ? "Date range" : null,
    spaceId ? "Space" : null,
    sourceId ? "Source" : null,
    labelIds.length ? `${labelIds.length} label${labelIds.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean)
  const summary = transactionsQuery.data?.summary
  const mutationError =
    createTransaction.error?.message ??
    updateTransaction.error?.message ??
    removeTransaction.error?.message

  const sourceOptions = useMemo(() => {
    if (!effectiveSpaceId) return sources

    return sources.filter(
      (source) => source.spaceId === null || source.spaceId === effectiveSpaceId,
    )
  }, [effectiveSpaceId, sources])

  async function invalidateTransactions() {
    await utils.transactions.list.invalidate()
    await utils.transactions.summary.invalidate()
    await utils.sources.list.invalidate()
    await utils.dashboard.getOverview.invalidate()
    await utils.spaces.list.invalidate()
  }

  function openNewForm() {
    setForm(initialForm())
    setFormOpen(true)
  }

  function startEditing(
    transaction: NonNullable<typeof transactionsQuery.data>["items"][number],
  ) {
    setForm({
      id: transaction.id,
      description: transaction.description,
      amount: String(transaction.amount),
      type: transaction.type,
      date: new Date(transaction.date).toISOString().slice(0, 10),
      isAnExpense: transaction.isAnExpense,
      sourceId: transaction.sourceId,
      spaceId: transaction.spaceId,
      labelIds: transaction.labels.map((label) => label.id),
    })
    setFormOpen(true)
  }

  function closeForm() {
    setForm(initialForm())
    setFormOpen(false)
  }

  function submitForm() {
    const payload = {
      description: form.description.trim(),
      amount: Number(form.amount),
      type: form.type,
      date: form.date,
      isAnExpense: form.isAnExpense,
      sourceId: effectiveSourceId,
      spaceId: effectiveSpaceId,
      labelIds: form.labelIds,
    }

    if (
      !payload.description ||
      !payload.amount ||
      !payload.sourceId ||
      !payload.spaceId
    ) {
      return
    }

    if (form.id) {
      updateTransaction.mutate({ id: form.id, ...payload })
    } else {
      createTransaction.mutate(payload)
    }
  }

  function clearFilters() {
    setSearch("")
    setType("all")
    setExpenseOnly(false)
    setDateFrom("")
    setDateTo("")
    setSpaceId("")
    setSourceId("")
    setLabelIds([])
  }

  function toggleFilterLabel(labelId: string) {
    setLabelIds((current) =>
      current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId],
    )
  }

  function toggleFormLabel(labelId: string) {
    setForm((current) => ({
      ...current,
      labelIds: current.labelIds.includes(labelId)
        ? current.labelIds.filter((id) => id !== labelId)
        : [...current.labelIds, labelId],
    }))
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Ledger
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Transactions
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Track debit and credit entries across spaces and sources.
          </p>
        </div>
        <Button onClick={openNewForm}>
          <PlusIcon />
          New transaction
        </Button>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Transactions" value={summary?.transactionCount ?? 0} />
        <Metric label="Credits" value={formatMoney(summary?.credits ?? 0)} tone="positive" />
        <Metric label="Debits" value={formatMoney(summary?.debits ?? 0)} tone="negative" />
        <Metric
          label="Net movement"
          value={formatMoney(summary?.net ?? 0)}
          tone={(summary?.net ?? 0) >= 0 ? "positive" : "negative"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-background p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_9rem_9rem]">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transactions"
                  className="pl-8"
                />
              </div>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
              >
                <option value="recent">Recent</option>
                <option value="date">Date</option>
                <option value="amount">Amount</option>
              </select>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <select
                value={spaceId}
                onChange={(event) => setSpaceId(event.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
              >
                <option value="">All spaces</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
              <select
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
              >
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as "all" | TransactionType)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
              >
                <option value="all">All types</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
              <Button
                variant={expenseOnly ? "default" : "outline"}
                onClick={() => setExpenseOnly((current) => !current)}
              >
                Expense only
              </Button>
            </div>

            {activeFilters.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {activeFilters.map((filter) => (
                  <Badge key={filter} variant="secondary">
                    {filter}
                  </Badge>
                ))}
                <button
                  className="text-xs font-medium text-primary"
                  type="button"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              </div>
            ) : null}
          </div>

          {mutationError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {mutationError}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="grid grid-cols-[1fr_8rem_8rem] border-b px-4 py-3 text-xs font-medium text-muted-foreground md:grid-cols-[7rem_1fr_9rem_8rem]">
              <span className="hidden md:block">Date</span>
              <span>Description</span>
              <span>Source</span>
              <span className="text-right">Amount</span>
            </div>
            {transactionsQuery.isPending ? (
              <p className="p-5 text-sm text-muted-foreground">Loading transactions...</p>
            ) : null}
            {transactionsQuery.data?.items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium">No transactions found</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a transaction or adjust your filters.
                </p>
              </div>
            ) : null}
            {transactionsQuery.data?.items.map((transaction) => (
              <div
                key={transaction.id}
                className="grid grid-cols-[1fr_8rem_8rem] items-center gap-3 border-b px-4 py-3 last:border-b-0 md:grid-cols-[7rem_1fr_9rem_8rem]"
              >
                <span className="hidden text-sm text-muted-foreground md:block">
                  {formatDate(transaction.date)}
                </span>
                <div className="min-w-0">
                  <button
                    className="block truncate text-left text-sm font-medium hover:text-primary"
                    type="button"
                    onClick={() => startEditing(transaction)}
                  >
                    {transaction.description}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{transaction.spaceName}</Badge>
                    <Badge variant={transaction.type === "credit" ? "default" : "secondary"}>
                      {transaction.type}
                    </Badge>
                    {transaction.isAnExpense ? <Badge variant="secondary">Expense</Badge> : null}
                    {transaction.labels.map((label) => (
                      <Badge key={label.id} variant="outline">
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {transaction.sourceName}
                </span>
                <div className="flex items-center justify-end gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      transaction.type === "credit" ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {transaction.type === "credit" ? "+" : "-"}
                    {formatMoney(transaction.amount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7"
                    onClick={() => startEditing(transaction)}
                    aria-label="Edit transaction"
                  >
                    <PencilIcon />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <FormPanel
            form={form}
            open={formOpen}
            spaces={spaces}
            sources={sourceOptions}
            labels={labels}
            effectiveSpaceId={effectiveSpaceId}
            effectiveSourceId={effectiveSourceId}
            busy={createTransaction.isPending || updateTransaction.isPending}
            removing={removeTransaction.isPending}
            onOpen={openNewForm}
            onClose={closeForm}
            onChange={setForm}
            onToggleLabel={toggleFormLabel}
            onSubmit={submitForm}
            onRemove={() => form.id && removeTransaction.mutate({ id: form.id })}
          />

          <div className="rounded-lg border bg-background p-4">
            <h2 className="text-sm font-semibold">Label filters</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {labels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    labelIds.includes(label.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                  onClick={() => toggleFilterLabel(label.id)}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <h2 className="text-sm font-semibold">Filtered mix</h2>
            <Breakdown label="Credits" value={summary?.creditCount ?? 0} total={summary?.transactionCount ?? 0} />
            <Breakdown label="Debits" value={summary?.debitCount ?? 0} total={summary?.transactionCount ?? 0} />
            <Breakdown label="Expenses" value={summary?.expenseCount ?? 0} total={summary?.transactionCount ?? 0} />
          </div>
        </aside>
      </section>
    </div>
  )
}

function FormPanel({
  form,
  open,
  spaces,
  sources,
  labels,
  effectiveSpaceId,
  effectiveSourceId,
  busy,
  removing,
  onOpen,
  onClose,
  onChange,
  onToggleLabel,
  onSubmit,
  onRemove,
}: {
  form: FormState
  open: boolean
  spaces: Array<{ id: string; name: string }>
  sources: Array<{ id: string; name: string }>
  labels: Array<{ id: string; name: string }>
  effectiveSpaceId: string
  effectiveSourceId: string
  busy: boolean
  removing: boolean
  onOpen: () => void
  onClose: () => void
  onChange: (form: FormState) => void
  onToggleLabel: (labelId: string) => void
  onSubmit: () => void
  onRemove: () => void
}) {
  if (!open) {
    return (
      <div className="rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">Quick entry</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Record a debit or credit without leaving the list.
        </p>
        <Button className="mt-4 w-full" onClick={onOpen}>
          <PlusIcon />
          New transaction
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-background p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {form.id ? "Edit transaction" : "New transaction"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Record a debit or credit for a source inside a space.
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <XIcon />
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <Input
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(event) => onChange({ ...form, amount: event.target.value })}
          placeholder="Amount"
          className="h-12 text-lg font-semibold"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={form.type === "debit" ? "default" : "outline"}
            onClick={() => onChange({ ...form, type: "debit", isAnExpense: true })}
          >
            <ArrowDownIcon />
            Debit
          </Button>
          <Button
            variant={form.type === "credit" ? "default" : "outline"}
            onClick={() => onChange({ ...form, type: "credit", isAnExpense: false })}
          >
            <ArrowUpIcon />
            Credit
          </Button>
        </div>
        <Input
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          placeholder="Description"
        />
        <select
          value={effectiveSpaceId}
          onChange={(event) => onChange({ ...form, spaceId: event.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
        >
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
        <select
          value={effectiveSourceId}
          onChange={(event) => onChange({ ...form, sourceId: event.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
        >
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={form.date}
          onChange={(event) => onChange({ ...form, date: event.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={form.isAnExpense}
            type="checkbox"
            onChange={(event) => onChange({ ...form, isAnExpense: event.target.checked })}
          />
          Expense
        </label>
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <button
              key={label.id}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                form.labelIds.includes(label.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
              onClick={() => onToggleLabel(label.id)}
            >
              {label.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {form.id ? (
          <Button variant="destructive" onClick={onRemove} disabled={removing}>
            <Trash2Icon />
            Delete transaction
          </Button>
        ) : null}
        <Button onClick={onSubmit} disabled={busy}>
          <CheckIcon />
          Save transaction
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
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

function Breakdown({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}
