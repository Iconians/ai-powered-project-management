"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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

  // Fetch user's organizations
  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return res.json();
    },
  });

  // Fetch subscription for selected organization
  const { data: subscription, isLoading: isLoadingSubscription } =
    useQuery<Subscription>({
      queryKey: ["subscription", selectedOrgId],
      queryFn: async () => {
        if (!selectedOrgId) return null;
        const res = await fetch(
          `/api/subscriptions?organizationId=${selectedOrgId}`
        );
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error("Failed to fetch subscription");
        }
        return res.json();
      },
      enabled: !!selectedOrgId,
    });

  // Fetch all plans
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
  });

  // Fetch usage
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

      // If it's a free plan, just refresh the page
      if (data.message && data.message.includes("Free plan")) {
        window.location.reload();
        return data;
      }

      // Otherwise redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
      return data;
    },
    onSuccess: () => {
      // Invalidate subscription query to refresh data
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
      console.log("Sync successful:", data);
      // Invalidate subscription query to refresh data
      queryClient.invalidateQueries({
        queryKey: ["subscription", selectedOrgId],
      });
      // Also update the query data directly if we got subscription data back
      if (data?.subscription) {
        // Ensure plan is included before setting query data
        if (!data.subscription.plan) {
          // If plan is missing, just invalidate and refetch
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
      // Force a refetch to ensure we have the latest data
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

  // Auto-select first organization if none selected
  // This must be called before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (!selectedOrgId && organizations && organizations.length > 0) {
      setSelectedOrgId(organizations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations]);

  // Listen for real-time subscription updates via Pusher
  useRealtime({
    channelName: selectedOrgId ? `organization-${selectedOrgId}` : "",
    eventName: "subscription-updated",
    callback: () => {
      // Invalidate subscription query when update is received
      if (selectedOrgId) {
        queryClient.invalidateQueries({
          queryKey: ["subscription", selectedOrgId],
        });
      }
    },
  });

  // Auto-sync subscription if it has a Stripe subscription ID but might be out of date
  useEffect(() => {
    if (
      subscription?.stripeSubscriptionId &&
      subscription.plan?.name === "Free" && // Add optional chaining
      selectedOrgId &&
      !syncSubscriptionMutation.isPending &&
      !syncSubscriptionMutation.isSuccess
    ) {
      // If subscription has Stripe ID but shows Free plan, it's likely out of sync
      // Auto-sync it
      syncSubscriptionMutation.mutate(selectedOrgId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    subscription?.stripeSubscriptionId,
    subscription?.plan?.name, // Add optional chaining
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

  const currentPlan = subscription?.plan;
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
            Billing & Subscription
          </h1>
          <Link
            href="/boards"
            className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm sm:text-base text-center"
          >
            ← Back to Boards
          </Link>
        </div>

        {/* Organization Selector */}
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
            {/* Current Subscription */}
            {subscription && subscription.plan && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Current Plan: {subscription.plan.name}
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
                {subscription.currentPeriodEnd && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Renews:{" "}
                    {new Date(
                      subscription.currentPeriodEnd
                    ).toLocaleDateString()}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
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
                </div>
              </div>
            )}

            {/* Available Plans */}
            {plans && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Available Plans
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${
                        currentPlan?.id === plan.id
                          ? "ring-2 ring-blue-500"
                          : ""
                      }`}
                    >
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {plan.name}
                      </h3>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                        ${plan.price}
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                          /{plan.interval.toLowerCase()}
                        </span>
                      </div>
                      <ul className="space-y-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
                        <li>
                          {plan.maxBoards === -1 ? "Unlimited" : plan.maxBoards}{" "}
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
                          <li>✓ AI Task Generation</li>
                        )}
                        {plan.features.aiSprintPlanning && (
                          <li>✓ AI Sprint Planning</li>
                        )}
                      </ul>
                      {currentPlan?.id === plan.id ? (
                        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                          Current Plan
                        </div>
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
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {createSubscriptionMutation.isPending
                            ? "Processing..."
                            : "Subscribe"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
