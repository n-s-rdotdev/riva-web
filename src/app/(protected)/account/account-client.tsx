"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckIcon,
  LoaderCircleIcon,
  PencilIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { authClient } from "@/lib/auth-client"
import { analyticsEvents, resetAnalytics, trackEvent } from "@/lib/analytics/web"
import { api } from "@/trpc/react"

const loginMethodLabels: Record<string, string> = {
  google: "Google",
  github: "GitHub",
}

function initials(name?: string | null, email?: string | null) {
  const label = name || email || "U"
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function AccountClient() {
  const router = useRouter()
  const utils = api.useUtils()
  const accountQuery = api.account.me.useQuery()
  const account = accountQuery.data

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")

  const startEditing = () => {
    setName(account?.name ?? "")
    setEditing(true)
  }

  const updateProfile = api.account.updateProfile.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.accountProfileUpdated, { platform: "web" })
      setEditing(false)
      await utils.account.me.invalidate()
    },
  })

  const deactivate = api.account.deactivateSelf.useMutation({
    onSuccess: async () => {
      trackEvent(analyticsEvents.accountDeactivated, { platform: "web" })
      resetAnalytics()
      await authClient.signOut().catch(() => undefined)
      router.replace("/deactivated")
    },
  })

  if (accountQuery.isPending) {
    return <AccountSkeleton />
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load your account. Refresh to try again.
        </p>
      </div>
    )
  }

  const trimmed = name.trim()
  const canSave =
    trimmed.length > 0 && trimmed !== account.name && !updateProfile.isPending

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your profile and sign-in details.
        </p>
      </header>

      {/* Profile */}
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-4">
          <Avatar className="size-14 rounded-xl">
            {account.image ? (
              <AvatarImage src={account.image} alt={account.name ?? "You"} />
            ) : null}
            <AvatarFallback className="rounded-xl text-base">
              {initials(account.name, account.email)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="account-name" className="text-sm font-medium">
                  Display name
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="account-name"
                    value={name}
                    autoFocus
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && canSave) {
                        updateProfile.mutate({ name: trimmed })
                      }
                      if (event.key === "Escape") {
                        setEditing(false)
                        setName(account.name ?? "")
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    disabled={!canSave}
                    onClick={() => updateProfile.mutate({ name: trimmed })}
                    aria-label="Save name"
                  >
                    {updateProfile.isPending ? (
                      <LoaderCircleIcon className="animate-spin" />
                    ) : (
                      <CheckIcon />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false)
                      setName(account.name ?? "")
                    }}
                    aria-label="Cancel"
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-semibold">
                  {account.name}
                </h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground"
                  onClick={startEditing}
                  aria-label="Edit name"
                >
                  <PencilIcon className="size-3.5" />
                </Button>
                <AccountStateBadge state={account.accountState} />
              </div>
            )}
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {account.email ?? "No email on file"}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-2">
          <Detail
            label="Signed in with"
            value={
              account.lastLoginMethod
                ? (loginMethodLabels[account.lastLoginMethod] ??
                  account.lastLoginMethod)
                : "—"
            }
          />
          <Detail
            label="Onboarding"
            value={
              account.onboardingStatus === "complete" ? "Complete" : "Pending"
            }
          />
        </dl>
      </section>

      {/* Session */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Current session</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail label="Signed in" value={formatDate(account.session.createdAt)} />
          <Detail label="Expires" value={formatDate(account.session.expiresAt)} />
          <Detail
            label="Device"
            value={account.session.userAgent ?? "Unknown device"}
            wide
          />
        </dl>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Deactivate account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This signs you out everywhere and blocks future access. Your spaces
              and transactions are kept, but hidden. Contact support to restore
              access.
            </p>
            <div className="mt-4">
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive" size="sm" />}
                >
                  Deactivate account
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You&apos;ll be signed out on every device and won&apos;t be
                      able to sign back in until support reactivates your account.
                      Your financial data stays saved but hidden.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deactivate.isPending}>
                      Keep my account
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault()
                        deactivate.mutate()
                      }}
                      disabled={deactivate.isPending}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {deactivate.isPending ? "Deactivating…" : "Deactivate"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function AccountStateBadge({ state }: { state: string }) {
  if (state === "active") {
    return (
      <Badge variant="secondary" className="gap-1">
        Active
      </Badge>
    )
  }

  return <Badge variant="destructive">{state}</Badge>
}

function Detail({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
    </div>
  )
}

function AccountSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  )
}
