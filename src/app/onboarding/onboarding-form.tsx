"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"
import { api } from "@/trpc/react"

const suggestedSpaces = ["Personal", "Family", "Business", "Trip"]
const defaultSourceTypes = [
  "Bank Account",
  "Credit Card",
  "Debit Card",
  "Cash",
  "UPI Wallet",
  "Digital Wallet",
  "Investment Account",
]

export function OnboardingForm() {
  const router = useRouter()
  const utils = api.useUtils()
  const statusQuery = api.onboarding.getStatus.useQuery()
  const completeOnboarding = api.onboarding.complete.useMutation()
  const [step, setStep] = useState<1 | 2>(1)
  const [spaceName, setSpaceName] = useState("Personal")
  const [sourceName, setSourceName] = useState("")
  const [sourceTypeName, setSourceTypeName] = useState(defaultSourceTypes[0])
  const [sourceTypes, setSourceTypes] = useState(defaultSourceTypes)
  const [newSourceType, setNewSourceType] = useState("")
  const [openingBalance, setOpeningBalance] = useState("0")

  useEffect(() => {
    trackEvent(analyticsEvents.onboardingStarted, {
      platform: "web",
    })
  }, [])

  useEffect(() => {
    if (statusQuery.data?.isOnboarded) {
      router.replace("/dashboard")
    }
  }, [router, statusQuery.data?.isOnboarded])

  const cleanSourceTypes = useMemo(
    () => [...new Set(sourceTypes.map((type) => type.trim()).filter(Boolean))],
    [sourceTypes],
  )

  const canContinue = spaceName.trim().length > 0
  const canComplete =
    canContinue &&
    sourceName.trim().length > 0 &&
    sourceTypeName.trim().length > 0 &&
    cleanSourceTypes.length > 0 &&
    Number.isFinite(Number(openingBalance))

  function continueToSourceStep() {
    if (!canContinue) {
      return
    }

    trackEvent(analyticsEvents.onboardingStepCompleted, {
      platform: "web",
      step: "space",
    })
    setStep(2)
  }

  function addSourceType() {
    const nextType = newSourceType.trim()

    if (!nextType || cleanSourceTypes.includes(nextType)) {
      setNewSourceType("")
      return
    }

    setSourceTypes((current) => [...current, nextType])
    setSourceTypeName(nextType)
    setNewSourceType("")
  }

  function removeSourceType(sourceType: string) {
    const nextTypes = cleanSourceTypes.filter((type) => type !== sourceType)

    if (nextTypes.length === 0) {
      return
    }

    setSourceTypes(nextTypes)

    if (sourceTypeName === sourceType) {
      setSourceTypeName(nextTypes[0])
    }
  }

  async function completeSetup() {
    if (!canComplete) {
      return
    }

    trackEvent(analyticsEvents.onboardingStepCompleted, {
      platform: "web",
      step: "source",
    })

    await completeOnboarding.mutateAsync({
      spaceName: spaceName.trim(),
      sourceName: sourceName.trim(),
      sourceTypeName: sourceTypeName.trim(),
      sourceTypes: cleanSourceTypes,
      openingBalance: Number(openingBalance),
    })

    trackEvent(analyticsEvents.onboardingCompleted, {
      platform: "web",
      source_type_count: cleanSourceTypes.length,
    })
    await utils.account.me.invalidate()
    await utils.onboarding.getStatus.invalidate()
    router.replace("/dashboard")
    router.refresh()
  }

  if (statusQuery.data?.isOnboarded) {
    return null
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-6 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-lg border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Riva setup
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {step === 1 ? "Create your first space" : "Add your first source"}
              </h1>
            </div>
            <div className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
              Step {step} of 2
            </div>
          </div>

          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="space-name">Space name</Label>
                <Input
                  id="space-name"
                  value={spaceName}
                  onChange={(event) => setSpaceName(event.target.value)}
                  placeholder="Personal"
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedSpaces.map((name) => (
                    <Button
                      key={name}
                      type="button"
                      variant={spaceName === name ? "default" : "outline"}
                      onClick={() => setSpaceName(name)}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={continueToSourceStep} disabled={!canContinue}>
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="source-name">Source name</Label>
                  <Input
                    id="source-name"
                    value={sourceName}
                    onChange={(event) => setSourceName(event.target.value)}
                    placeholder="Main account"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="opening-balance">Opening balance</Label>
                  <Input
                    id="opening-balance"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={openingBalance}
                    onChange={(event) => setOpeningBalance(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source-type">Source type</Label>
                <select
                  id="source-type"
                  value={sourceTypeName}
                  onChange={(event) => setSourceTypeName(event.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {cleanSourceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Source types</p>
                <div className="flex flex-wrap gap-2">
                  {cleanSourceTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm"
                    >
                      {type}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => removeSourceType(type)}
                        aria-label={`Remove ${type}`}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newSourceType}
                    onChange={(event) => setNewSourceType(event.target.value)}
                    placeholder="Add source type"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        addSourceType()
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addSourceType}>
                    Add
                  </Button>
                </div>
              </div>

              {completeOnboarding.error ? (
                <p className="text-sm text-destructive">
                  {completeOnboarding.error.message}
                </p>
              ) : null}

              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={completeSetup}
                  disabled={!canComplete || completeOnboarding.isPending}
                >
                  {completeOnboarding.isPending ? "Completing..." : "Complete setup"}
                </Button>
              </div>
            </div>
          )}
        </section>

        <aside className="rounded-lg border bg-muted/30 p-6">
          <p className="text-sm font-medium text-muted-foreground">
            {step === 1 ? "What is a space?" : "What is a source?"}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {step === 1
              ? "A space keeps a financial context separate, like personal, family, or business money."
              : "A source is where money lives: a bank account, wallet, cash, card, or another store of value."}
          </p>
        </aside>
      </div>
    </div>
  )
}
