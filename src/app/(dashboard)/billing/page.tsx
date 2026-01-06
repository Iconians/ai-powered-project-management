"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, startTransition } from "react";
import Link from "next/link";
import { useRealtime } from "@/hooks/useRealtime";

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  maxBoards: number;
  maxMembers: number;
  maxTasks: number | null;
  features: Record<string, boolean>;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
  plan: Plan;
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return res.json();
    },
  });

  const { data: subscription, isLoading: isLoadingSubscription } =
    useQuery<Subscription | null>({
      queryKey: ["subscription", selectedOrgId],
      queryFn: async () => {
        if (!selectedOrgId) return null;
        const res = await fetch(
          `/api/subscriptions?organizationId=${selectedOrgId}`
        );
        if (!res.ok) {
          if (res.status === 404) {
            return null;
          }
          throw new Error("Failed to fetch subscription");
        }
        return res.json();
      },
      enabled: !!selectedOrgId,
    });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
  });

  const { data: usage } = useQuery({
    queryKey: ["usage", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await fetch(`/api/usage?organizationId=${selectedOrgId}`);
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async ({
      organizationId,
      planId,
    }: {
      organizationId: string;
      planId: string;
    }) => {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, planId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create subscription");
      }
      const data = await res.json();

      if (data.message && data.message.includes("Free plan")) {
        window.location.reload();
        return data;
      }

      if (data.url) {
        window.location.href = data.url;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subscription", selectedOrgId],
      });
    },
  });

  const manageSubscriptionMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, action: "manage" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to manage subscription");
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No redirect URL received from server");
      }
      return data;
    },
    onError: (error) => {
      console.error("Manage subscription error:", error);
      alert(`Failed to manage subscription: ${error.message}`);
    },
  });

  const syncSubscriptionMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, action: "sync" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sync subscription");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["subscription", selectedOrgId],
      });

      if (data?.subscription) {
        if (!data.subscription.plan) {
          queryClient.invalidateQueries({
            queryKey: ["subscription", selectedOrgId],
          });
          return;
        }
        queryClient.setQueryData(
          ["subscription", selectedOrgId],
          data.subscription
        );
      }

      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: ["subscription", selectedOrgId],
        });
      }, 500);
    },
    onError: (error) => {
      console.error("Sync error:", error);
      alert(`Failed to sync subscription: ${error.message}`);
    },
  });

  useEffect(() => {
    if (!hasInitialized.current && organizations && organizations.length > 0) {
      hasInitialized.current = true;
      startTransition(() => {
        setSelectedOrgId(organizations[0].id);
      });
    }
  }, [organizations]);

  useRealtime({
    channelName: selectedOrgId ? `organization-${selectedOrgId}` : "",
    eventName: "subscription-updated",
    callback: () => {
      if (selectedOrgId) {
        queryClient.invalidateQueries({
          queryKey: ["subscription", selectedOrgId],
        });
      }
    },
  });

  useEffect(() => {
    if (
      subscription?.stripeSubscriptionId &&
      subscription.plan?.name === "Free" &&
      selectedOrgId &&
      !syncSubscriptionMutation.isPending &&
      !syncSubscriptionMutation.isSuccess
    ) {
      syncSubscriptionMutation.mutate(selectedOrgId);
    }
  }, [
    subscription?.stripeSubscriptionId,
    subscription?.plan?.name,
    selectedOrgId,
    syncSubscriptionMutation,
  ]);

  if (!organizations || organizations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No organizations found. Create one to get started.
            </p>
            <Link
              href="/organizations/new"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Create Organization
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan =
    subscription?.plan ||
    (plans ? plans.find((p) => p.name === "Free") || null : null);
  const actualCounts = usage?.actualCounts || {
    boards: 0,
    members: 0,
    tasks: 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Plans
          </h1>
          <Link
            href="/boards"
            className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm sm:text-base text-center"
          >
            ← Back to Boards
          </Link>
        </div>

        {}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Organization
          </label>
          <select
            value={selectedOrgId || ""}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {organizations.map((org: { id: string; name: string }) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {isLoadingSubscription ? (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">
            Loading subscription...
          </div>
        ) : (
          <>
            {}
            {selectedOrgId && currentPlan && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Current Plan: {currentPlan.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Boards
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {actualCounts.boards} /{" "}
                      {currentPlan?.maxBoards === -1
                        ? "∞"
                        : currentPlan?.maxBoards}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Members
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {actualCounts.members} /{" "}
                      {currentPlan?.maxMembers === -1
                        ? "∞"
                        : currentPlan?.maxMembers}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Tasks
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {actualCounts.tasks} /{" "}
                      {currentPlan?.maxTasks === -1
                        ? "∞"
                        : currentPlan?.maxTasks || "∞"}
                    </div>
                  </div>
                </div>
                {subscription?.currentPeriodEnd && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Renews:{" "}
                    {new Date(
                      subscription.currentPeriodEnd
                    ).toLocaleDateString()}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  {}
                  {(() => {
                    const priceValue = currentPlan?.price;
                    let planPrice = 0;
                    if (priceValue) {
                      if (
                        typeof priceValue === "object" &&
                        "toNumber" in priceValue
                      ) {
                        planPrice = (
                          priceValue as { toNumber: () => number }
                        ).toNumber();
                      } else if (typeof priceValue === "number") {
                        planPrice = priceValue;
                      } else if (typeof priceValue === "string") {
                        planPrice = parseFloat(priceValue) || 0;
                      }
                    }
                    const isPaidPlan = planPrice > 0;

                    return (
                      <>
                        {isPaidPlan && (
                          <button
                            onClick={() =>
                              syncSubscriptionMutation.mutate(selectedOrgId!)
                            }
                            disabled={syncSubscriptionMutation.isPending}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                            title="Sync subscription status from Stripe"
                          >
                            {syncSubscriptionMutation.isPending
                              ? "Syncing..."
                              : "Refresh Status"}
                          </button>
                        )}
                        {}
                        {isPaidPlan && subscription?.stripeSubscriptionId && (
                          <button
                            onClick={() =>
                              manageSubscriptionMutation.mutate(selectedOrgId!)
                            }
                            disabled={manageSubscriptionMutation.isPending}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {manageSubscriptionMutation.isPending
                              ? "Loading..."
                              : "Manage Subscription"}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {}
            {plans && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Available Plans
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map((plan) => {
                    const isCurrentPlan = currentPlan?.id === plan.id;
                    return (
                      <div
                        key={plan.id}
                        className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-2 transition-all ${
                          isCurrentPlan
                            ? "border-blue-500 ring-2 ring-blue-500 ring-opacity-50"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {plan.name}
                          </h3>
                          {isCurrentPlan && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                          ${plan.price}
                          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                            /{plan.interval.toLowerCase()}
                          </span>
                        </div>
                        <ul className="space-y-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
                          <li>
                            {plan.maxBoards === -1
                              ? "Unlimited"
                              : plan.maxBoards}{" "}
                            Boards
                          </li>
                          <li>
                            {plan.maxMembers === -1
                              ? "Unlimited"
                              : plan.maxMembers}{" "}
                            Members
                          </li>
                          <li>
                            {plan.maxTasks === -1
                              ? "Unlimited"
                              : plan.maxTasks || "Unlimited"}{" "}
                            Tasks
                          </li>
                          {plan.features.aiTaskGeneration && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              AI Task Generation
                            </li>
                          )}
                          {plan.features.aiSprintPlanning && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              AI Sprint Planning
                            </li>
                          )}
                          {plan.features.githubIntegration && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              GitHub Integration
                            </li>
                          )}
                          {plan.features.prioritySupport && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              Priority Support
                            </li>
                          )}
                          {plan.features.customIntegrations && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              Custom Integrations
                            </li>
                          )}
                          {plan.features.advancedAI && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              Advanced AI Features
                            </li>
                          )}
                        </ul>
                        {isCurrentPlan ? (
                          <button
                            disabled
                            className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg cursor-not-allowed font-medium"
                          >
                            Current Plan
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              createSubscriptionMutation.mutate({
                                organizationId: selectedOrgId!,
                                planId: plan.id,
                              })
                            }
                            disabled={
                              createSubscriptionMutation.isPending ||
                              !selectedOrgId
                            }
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                          >
                            {createSubscriptionMutation.isPending
                              ? "Processing..."
                              : "Subscribe"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
