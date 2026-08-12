"use client"

import { useEffect, useRef } from "react"

import { analyticsEvents, identifyUser, resetAnalytics, trackEvent } from "@/lib/analytics/web"
import { authClient } from "@/lib/auth-client"

export function AuthAnalyticsBridge() {
  const { data: session, isPending } = authClient.useSession()
  const identifiedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (isPending) {
      return
    }

    const user = session?.user

    if (!user) {
      if (identifiedUserId.current) {
        resetAnalytics()
        identifiedUserId.current = null
      }

      return
    }

    if (identifiedUserId.current === user.id) {
      return
    }

    identifyUser(user.id, {
      onboarded: user.onboarded,
      last_login_method: user.lastLoginMethod ?? null,
      platform: "web",
    })
    trackEvent(analyticsEvents.signedIn, {
      onboarded: user.onboarded,
      last_login_method: user.lastLoginMethod ?? null,
      platform: "web",
    })
    identifiedUserId.current = user.id
  }, [isPending, session])

  return null
}
