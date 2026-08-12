import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { eq } from "drizzle-orm"

import { LoginForm } from "@/components/login-form"
import { RivaWordmark } from "@/app/(marketting)/_components/riva-mark"
import { db } from "@/db"
import { userSchema } from "@/db/schema"
import { auth } from "@/lib/auth"

/** Maps a Better Auth / Riva error code into copy the person can act on. */
function errorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined
  switch (code) {
    case "account_deactivated":
    case "deactivated":
      return "This account has been deactivated. Contact support to restore access."
    case "access_denied":
      return "Sign-in was canceled. You can try again whenever you're ready."
    default:
      return "We couldn't sign you in. Please try again."
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session?.user) {
    const [user] = await db
      .select({
        onboarded: userSchema.onboarded,
        accountStatus: userSchema.accountStatus,
      })
      .from(userSchema)
      .where(eq(userSchema.id, session.user.id))
      .limit(1)

    if (user?.accountStatus === "deactivated") {
      redirect("/deactivated")
    }

    redirect(user?.onboarded ? "/dashboard" : "/onboarding")
  }

  const { error } = await searchParams

  return (
    <div className="relative flex min-h-svh flex-col">
      {/* ambient lime glow + masked grid spotlighting the centered card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_45%_at_50%_42%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--foreground)_4%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--foreground)_4%,transparent)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(55%_45%_at_50%_42%,black,transparent)]"
      />

      {/* ------------------------------------------------------------- Header */}
      <header className="flex h-16 items-center justify-between px-6 sm:px-8">
        <Link href="/" aria-label="Riva home" className="w-fit">
          <RivaWordmark className="text-lg" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to home
        </Link>
      </header>

      {/* ------------------------------------------------------- Sign-in panel */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center duration-700 fill-mode-both animate-in fade-in slide-in-from-bottom-4">
          <LoginForm error={errorMessage(error)} className="w-full" />
          <p className="mt-6 max-w-sm text-center text-xs text-pretty text-muted-foreground/80">
            Your financial details stay out of analytics, on web and mobile alike.
          </p>
        </div>
      </main>
    </div>
  )
}
