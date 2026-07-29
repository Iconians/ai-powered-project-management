"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type {
  PlanForBilling,
  SerializedSubscriptionForBilling,
  UsageForBilling,
} from "@/lib/data/billing";
import {
  fetchSubscriptionForOrg,
  fetchUsageForOrg,
} from "@/lib/subscription-client";

export interface BillingPageClientProps {
  organizations: Array<{ id: string; name: string }>;
  plans: PlanForBilling[];
  initialSubscription: SerializedSubscriptionForBilling | null;
  initialUsage: UsageForBilling;
  defaultOrgId: string;
}

export function useBillingPage({
  organizations,
  plans,
  initialSubscription,
  initialUsage,
  defaultOrgId,
}: BillingPageClientProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>(defaultOrgId);

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ["subscription", selectedOrgId],
    queryFn: () =>
      !selectedOrgId
        ? Promise.resolve(null)
        : fetchSubscriptionForOrg(selectedOrgId),
    initialData:
      selectedOrgId === defaultOrgId
        ? (initialSubscription ?? undefined)
        : undefined,
    enabled: !!selectedOrgId,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: usage } = useQuery({
    queryKey: ["usage", selectedOrgId],
    queryFn: () =>
      !selectedOrgId
        ? Promise.resolve(null)
        : fetchUsageForOrg(selectedOrgId),
    initialData:
      selectedOrgId === defaultOrgId ? initialUsage : undefined,
    enabled: !!selectedOrgId,
  });

  const currentPlan =
    subscription?.plan ||
    (plans ? (plans.find((p) => p.name === "Free") ?? null) : null);
  const actualCounts = usage?.actualCounts ?? {
    boards: 0,
    members: 0,
    tasks: 0,
  };

  return {
    organizations,
    plans,
    selectedOrgId,
    setSelectedOrgId,
    subscription,
    isLoadingSubscription,
    currentPlan,
    actualCounts,
  };
}

export type UseBillingPageResult = ReturnType<typeof useBillingPage>;
