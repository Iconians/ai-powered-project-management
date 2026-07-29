"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  PlanForBilling,
  SerializedSubscriptionForBilling,
  UsageForBilling,
} from "@/lib/data/billing";
import {
  fetchSubscriptionForOrg,
  fetchUsageForOrg,
} from "@/lib/subscription-client";

export function usePlans(initialData?: PlanForBilling[]) {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
    initialData: initialData ?? undefined,
  });
}

export function useSubscription(
  organizationId: string | null,
  initialData?: SerializedSubscriptionForBilling | null
) {
  const isDefault = !!initialData && organizationId !== null;

  return useQuery({
    queryKey: ["subscription", organizationId],
    queryFn: () =>
      !organizationId
        ? Promise.resolve(null)
        : fetchSubscriptionForOrg(organizationId),
    initialData: isDefault ? (initialData ?? undefined) : undefined,
    enabled: !!organizationId,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useUsage(
  organizationId: string | null,
  initialData?: UsageForBilling | null
) {
  const isDefault = !!initialData && organizationId !== null;

  return useQuery({
    queryKey: ["usage", organizationId],
    queryFn: () =>
      !organizationId
        ? Promise.resolve(null)
        : fetchUsageForOrg(organizationId),
    initialData: isDefault ? (initialData ?? undefined) : undefined,
    enabled: !!organizationId,
  });
}
