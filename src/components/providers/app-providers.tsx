"use client";

import { PostHogProvider } from "posthog-js/react";

import { env } from "@/env";
import { TRPCReactProvider } from "@/trpc/react";
import { AuthAnalyticsBridge } from "./auth-analytics-bridge";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider
      apiKey={env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN}
      options={{
        api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
        capture_pageview: false,
        capture_pageleave: true,
        person_profiles: "identified_only",
      }}
    >
      <TRPCReactProvider>
        <AuthAnalyticsBridge />
        {children}
      </TRPCReactProvider>
    </PostHogProvider>
  );
}
