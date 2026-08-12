import { accountRouter } from "./routers/account";
import { billingRouter } from "./routers/billing";
import { dashboardRouter } from "./routers/dashboard";
import { labelsRouter } from "./routers/labels";
import { notificationsRouter } from "./routers/notifications";
import { onboardingRouter } from "./routers/onboarding";
import { sourcesRouter } from "./routers/sources";
import { sourceTypesRouter } from "./routers/source-types";
import { spacesRouter } from "./routers/spaces";
import { transactionsRouter } from "./routers/transactions";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  account: accountRouter,
  billing: billingRouter,
  dashboard: dashboardRouter,
  labels: labelsRouter,
  notifications: notificationsRouter,
  onboarding: onboardingRouter,
  sources: sourcesRouter,
  sourceTypes: sourceTypesRouter,
  spaces: spacesRouter,
  transactions: transactionsRouter,
});

export const createCaller = createCallerFactory(appRouter);

export type AppRouter = typeof appRouter;
