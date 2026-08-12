# Riva Web

Riva Web is the Next.js application for Riva. It serves the browser app and the shared backend/API surface consumed by the Expo mobile app.

## Current Scope

- Next.js App Router UI
- Better Auth social login with Google and GitHub
- Drizzle + Neon Postgres schema
- tRPC endpoint at `/api/trpc`
- Protected app shell for dashboard, transactions, spaces, and sources
- Redis helper foundation for cache-aside work
- PostHog helper foundation for privacy-safe analytics

## Getting Started

Install dependencies and run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Environment

Required values are validated in `src/env.ts`:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SESSION_PREFIX`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`

Keep local `.env` files out of Git. Rotate secrets if they are ever shared or committed.

## Verification

```bash
pnpm lint
pnpm exec tsc --noEmit
```

## Docs

Start with the shared project docs in `../docs`, especially:

- `../docs/project-overview.md`
- `../docs/feature-implementation-order.md`
- `../docs/api-implementation-overview.md`
