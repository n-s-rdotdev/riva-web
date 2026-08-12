"use client"

import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { analyticsEvents, trackEvent } from "@/lib/analytics/web"
import { cn } from "@/lib/utils"

type CtaButtonProps = {
  /** Where on the page the CTA lives, e.g. "header" | "hero" | "final". */
  location: string
  className?: string
  children?: React.ReactNode
  size?: "default" | "lg"
}

/**
 * The single marketing CTA. Always reads "Get started" and routes to /login.
 * Records a privacy-safe analytics event (only the placement, no PII).
 */
export function CtaButton({
  location,
  className,
  children = "Get started",
  size = "default",
}: CtaButtonProps) {
  return (
    <Link
      href="/login"
      onClick={() =>
        trackEvent(analyticsEvents.marketingCtaClicked, { location })
      }
      className={cn(
        buttonVariants({ size }),
        size === "lg" && "h-11 rounded-lg px-6 text-base",
        className,
      )}
    >
      {children}
    </Link>
  )
}
