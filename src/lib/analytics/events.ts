export const analyticsEvents = {
  accountViewed: "account.viewed",
  signInStarted: "auth.sign_in_started",
  signedIn: "auth.signed_in",
  signedOut: "auth.signed_out",
  onboardingStarted: "onboarding.started",
  onboardingStepCompleted: "onboarding.step_completed",
  onboardingCompleted: "onboarding.completed",
  spaceCreated: "space.created",
  spaceChanged: "space.changed",
  spaceSelected: "space.selected",
  spaceUpdated: "space.updated",
  spaceRemoved: "space.removed",
  spaceInviteCreated: "space.invite_created",
  spaceJoinRequested: "space.join_requested",
  spaceJoinAccepted: "space.join_accepted",
  spaceJoinRejected: "space.join_rejected",
  spaceJoinCanceled: "space.join_canceled",
  sourceCreated: "source.created",
  sourceUpdated: "source.updated",
  sourceDeleted: "source.deleted",
  sourceDefaultChanged: "source.default_changed",
  sourceTypeCreated: "source_type.created",
  sourceTypeUpdated: "source_type.updated",
  sourceTypeDeleted: "source_type.deleted",
  labelCreated: "label.created",
  labelUpdated: "label.updated",
  labelDeleted: "label.deleted",
  transactionCreated: "transaction.created",
  transactionUpdated: "transaction.updated",
  transactionDeleted: "transaction.deleted",
  transactionFiltered: "transaction.filtered",
  dashboardViewed: "dashboard.viewed",
  dashboardFilterChanged: "dashboard.filter_changed",
  notificationOpened: "notification.opened",
  notificationMarkedRead: "notification.marked_read",
  notificationMarkedAllRead: "notification.marked_all_read",
  billingViewed: "billing.viewed",
  billingUpgradeStarted: "billing.upgrade_started",
  billingUpgradeUnavailable: "billing.upgrade_unavailable",
  accountProfileUpdated: "account.profile_updated",
  accountDeactivated: "account.deactivated",
  featureFlagChecked: "feature_flag.checked",
  marketingCtaClicked: "marketing.cta_clicked",
} as const;

export type AnalyticsEventName =
  (typeof analyticsEvents)[keyof typeof analyticsEvents];

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const forbiddenPropertyNames = new Set([
  "amount",
  "rawAmount",
  "description",
  "transactionDescription",
  "sourceName",
  "inviteCode",
  "oauthToken",
  "accessToken",
  "refreshToken",
  "sessionToken",
  "email",
  "rawEmail",
  "record",
  "databaseRecord",
]);

export function validateAnalyticsProperties(
  properties: AnalyticsProperties = {},
) {
  const forbiddenKey = Object.keys(properties).find((key) =>
    forbiddenPropertyNames.has(key),
  );

  if (forbiddenKey) {
    throw new Error(
      `Analytics property "${forbiddenKey}" is not allowed because it may contain sensitive data.`,
    );
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean | null>;
}
