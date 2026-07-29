/** Normalizes Prisma plan price shapes for comparison. */
export function subscriptionPriceValue(planPrice: unknown): number {
  if (planPrice === null || planPrice === undefined) return 0;
  if (typeof planPrice === "number") return planPrice;
  if (typeof planPrice === "string") return parseFloat(planPrice) || 0;
  if (
    typeof planPrice === "object" &&
    planPrice !== null &&
    "toNumber" in planPrice &&
    typeof (planPrice as { toNumber: () => number }).toNumber === "function"
  ) {
    return (planPrice as { toNumber: () => number }).toNumber();
  }
  return 0;
}

export interface SubscriptionLike {
  status?: string;
  currentPeriodEnd?: string | Date | null;
  plan?: { price?: unknown };
}

export function isSubscriptionStatusActive(
  subscription: SubscriptionLike | null | undefined
): boolean {
  if (!subscription) return false;
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
    return true;
  }
  if (subscription.status === "CANCELED" && subscription.currentPeriodEnd) {
    return new Date(subscription.currentPeriodEnd) > new Date();
  }
  return false;
}

export function computeHasPaidSubscription(
  subscription: SubscriptionLike | null | undefined
): boolean {
  if (!subscription) return false;
  const priceValue = subscriptionPriceValue(subscription.plan?.price);
  return priceValue > 0 && isSubscriptionStatusActive(subscription);
}
