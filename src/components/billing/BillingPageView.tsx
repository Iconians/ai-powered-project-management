import Link from "next/link";
import type { UseBillingPageResult } from "@/hooks/useBillingPage";

type BillingPageViewProps = UseBillingPageResult;

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@example.com";

function contactHref(planName: string): string {
  const subject = encodeURIComponent(`${planName} plan inquiry`);
  const body = encodeURIComponent(
    `Hi,\n\nI'm interested in the ${planName} plan for my organization.\n\n`
  );
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export function BillingPageView(props: BillingPageViewProps) {
  const {
    organizations,
    plans,
    selectedOrgId,
    setSelectedOrgId,
    isLoadingSubscription,
    currentPlan,
    actualCounts,
  } = props;

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

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Organization
          </label>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {organizations.map((org) => (
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
            {selectedOrgId && currentPlan && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Current Plan: {currentPlan.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Boards
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {actualCounts.boards} /{" "}
                      {currentPlan.maxBoards === -1
                        ? "∞"
                        : currentPlan.maxBoards}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Members
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {actualCounts.members} /{" "}
                      {currentPlan.maxMembers === -1
                        ? "∞"
                        : currentPlan.maxMembers}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Tasks
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {actualCounts.tasks} /{" "}
                      {currentPlan.maxTasks === -1
                        ? "∞"
                        : (currentPlan.maxTasks ?? "∞")}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {plans.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Available Plans
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map((plan) => {
                    const isCurrentPlan = currentPlan?.id === plan.id;
                    const isFreePlan = plan.price === 0;
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
                              : (plan.maxTasks ?? "Unlimited")}{" "}
                            Tasks
                          </li>
                          {plan.features?.aiTaskGeneration && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              AI Task Generation
                            </li>
                          )}
                          {plan.features?.aiSprintPlanning && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              AI Sprint Planning
                            </li>
                          )}
                          {plan.features?.githubIntegration && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              GitHub Integration
                            </li>
                          )}
                          {plan.features?.prioritySupport && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              Priority Support
                            </li>
                          )}
                          {plan.features?.customIntegrations && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              Custom Integrations
                            </li>
                          )}
                          {plan.features?.advancedAI && (
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              Advanced AI Features
                            </li>
                          )}
                        </ul>
                        {isCurrentPlan ? (
                          <button
                            type="button"
                            disabled
                            className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg cursor-not-allowed font-medium"
                          >
                            Current Plan
                          </button>
                        ) : isFreePlan ? (
                          <button
                            type="button"
                            disabled
                            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg cursor-not-allowed font-medium"
                          >
                            Included
                          </button>
                        ) : (
                          <a
                            href={contactHref(plan.name)}
                            className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
                          >
                            Contact Us
                          </a>
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
