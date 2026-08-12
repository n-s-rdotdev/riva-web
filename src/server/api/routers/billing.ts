import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * Billing v1 is a typed scaffold only. No payment provider, checkout,
 * subscriptions, invoices, trials, or paid plans exist. Status is computed
 * locally so account menus can show a clear not-configured state instead of
 * ad hoc placeholders. See docs/features/billing/billing-scaffold-plan.md.
 */
const PROVIDER_CONFIGURED = false;

export const billingRouter = createTRPCRouter({
  getStatus: protectedProcedure.query(() => {
    return {
      tier: "free" as const,
      providerConfigured: PROVIDER_CONFIGURED,
      reasonCode: "provider_not_configured" as const,
      message: "Billing isn't set up yet. You're on the Free plan.",
    };
  }),

  startUpgrade: protectedProcedure.mutation(() => {
    // Returns a typed provider-not-configured result. Never creates a checkout
    // session or mutates any payment state.
    return {
      ok: false as const,
      reasonCode: "provider_not_configured" as const,
      message: "Upgrades aren't available yet. Check back soon.",
    };
  }),
});
