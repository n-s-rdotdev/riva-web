"use client";

import posthog from "posthog-js";

import {
  type AnalyticsEventName,
  type AnalyticsProperties,
  analyticsEvents,
  validateAnalyticsProperties,
} from "./events";

export { analyticsEvents };

export function trackEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsProperties,
) {
  try {
    posthog.capture(event, validateAnalyticsProperties(properties));
    return true;
  } catch (error) {
    console.error("[analytics] capture failed", { event, error });
    return false;
  }
}

export function identifyUser(
  userId: string,
  properties?: AnalyticsProperties,
) {
  try {
    posthog.identify(userId, validateAnalyticsProperties(properties));
    return true;
  } catch (error) {
    console.error("[analytics] identify failed", { error });
    return false;
  }
}

export function resetAnalytics() {
  try {
    posthog.reset();
    return true;
  } catch (error) {
    console.error("[analytics] reset failed", { error });
    return false;
  }
}

export function setCurrentSpaceGroup(spaceId: string | null) {
  try {
    if (spaceId) {
      posthog.group("space", spaceId);
    } else {
      posthog.resetGroups();
    }

    return true;
  } catch (error) {
    console.error("[analytics] group failed", { error });
    return false;
  }
}

export async function isFeatureEnabled(flag: string) {
  try {
    return posthog.isFeatureEnabled(flag) === true;
  } catch (error) {
    console.error("[analytics] feature flag check failed", { flag, error });
    return false;
  }
}
