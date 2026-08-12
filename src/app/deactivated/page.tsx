"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ShieldOffIcon } from "lucide-react"

import { RivaWordmark } from "@/app/(marketting)/_components/riva-mark"
import { buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export default function DeactivatedPage() {
  // Clear any lingering session cookie cache so the person is fully signed out.
  useEffect(() => {
    authClient.signOut().catch(() => undefined)
  }, [])

  return (
    <div className="relative flex min-h-svh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_45%_at_50%_42%,color-mix(in_oklch,var(--muted-foreground)_10%,transparent),transparent)]"
      />
      <header className="flex h-16 items-center px-6 sm:px-8">
        <Link href="/" aria-label="Riva home" className="w-fit">
          <RivaWordmark className="text-lg" />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border bg-card">
            <ShieldOffIcon className="size-5 text-muted-foreground" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            Your account is deactivated
          </h1>
          <p className="mt-3 text-sm text-pretty text-muted-foreground">
            You&apos;ve been signed out and can&apos;t access Riva right now. Your
            spaces and transactions are safely kept. To restore access, reach out
            and we&apos;ll help reactivate your account.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <a
              href="mailto:support@riva.app?subject=Reactivate%20my%20account"
              className={cn(buttonVariants())}
            >
              Contact support
            </a>
            <Link
              href="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
