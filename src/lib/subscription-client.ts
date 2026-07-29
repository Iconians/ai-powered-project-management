import type {
  SerializedSubscriptionForBilling,
  UsageForBilling,
} from "@/lib/data/billing";
import { fetchJsonOrThrow } from "@/lib/http-client";

export async function fetchSubscriptionForOrg(
  organizationId: string
): Promise<SerializedSubscriptionForBilling | null> {
  const res = await fetch(
    `/api/subscriptions?organizationId=${organizationId}`
  );
  if (res.status === 404) return null;
  const data = await fetchJsonOrThrow<SerializedSubscriptionForBilling | null>(
    res,
    "Failed to fetch subscription"
  );
  return data;
}

export async function fetchUsageForOrg(
  organizationId: string
): Promise<UsageForBilling> {
  const res = await fetch(`/api/usage?organizationId=${organizationId}`);
  return fetchJsonOrThrow<UsageForBilling>(res, "Failed to fetch usage");
}
