"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"

const signedInCallbackUrl = "/dashboard"

type Provider = "google" | "github"

const providers: {
  id: Provider
  label: string
  glyph: React.ReactNode
}[] = [
  { id: "google", label: "Login with Google", glyph: <GoogleGlyph /> },
  { id: "github", label: "Login with Github", glyph: <GithubGlyph /> },
]

export function LoginForm({
  error,
  className,
  ...props
}: React.ComponentProps<"div"> & { error?: string }) {
  // Which provider's redirect is in flight. Both buttons disable while one runs.
  const [pending, setPending] = useState<Provider | null>(null)

  async function signIn(provider: Provider) {
    setPending(provider)
    trackEvent(analyticsEvents.signInStarted, { provider, platform: "web" })
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: signedInCallbackUrl,
      })
      // On success Better Auth redirects away; keep the spinner until it does.
    } catch {
      // Redirect never happened — let the user try again.
      setPending(null)
    }
  }

  return (
    <div
      className={cn(
        "relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_75%,transparent),color-mix(in_oklch,var(--background)_88%,transparent))] p-7 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_40px_120px_-60px_rgba(0,0,0,0.9)] sm:p-9",
        className,
      )}
      {...props}
    >
      <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
        <span className="text-primary">·</span> Riva account
      </p>
      <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">
        Sign in to Riva
      </h1>
      <p className="mt-2.5 text-sm text-pretty text-muted-foreground">
        One account for web and mobile, with onboarding before finance screens.
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {providers.map((provider) => {
          const isPending = pending === provider.id
          return (
            <button
              key={provider.id}
              type="button"
              disabled={pending !== null}
              onClick={() => signIn(provider.id)}
              className="group relative inline-flex h-11 items-center justify-center gap-3 rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 text-sm font-medium text-foreground transition-all outline-none hover:border-primary/30 hover:bg-white/[0.06] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="absolute left-4 inline-flex size-5 items-center justify-center">
                {isPending ? (
                  <Loader2Icon className="size-4.5 animate-spin text-muted-foreground" />
                ) : (
                  provider.glyph
                )}
              </span>
              {isPending ? "Redirecting…" : provider.label}
            </button>
          )
        })}
      </div>

      <div className="mt-7 flex items-center justify-center border-t border-white/[0.06] pt-5">
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground/70">
          Secured by Better Auth
        </span>
      </div>
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}

function GithubGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4.5 text-foreground"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.2c-3.34.72-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.13-.3-.54-1.53.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.23 0 4.63-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
    </svg>
  )
}
