import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  stripe,
  createCheckoutSession,
  createPortalSession,
} from "@/lib/stripe";
import { pusherServer } from "@/lib/pusher";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    // Allow MEMBER role to check subscription status (needed for AI feature visibility)
    await requireMember(organizationId);

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    return NextResponse.json(subscription);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, planId } = body;

    if (!organizationId || !planId) {
      return NextResponse.json(
        { error: "organizationId and planId are required" },
        { status: 400 }
      );
    }

    await requireMember(organizationId, "ADMIN");

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!plan.stripePriceId) {
      // For free plan or plans without Stripe setup, just update the subscription directly
      if (plan.price.toNumber() === 0) {
        // Free plan - update subscription directly without Stripe
        const subscription = await prisma.subscription.upsert({
          where: { organizationId },
          update: {
            planId: plan.id,
            status: "ACTIVE",
          },
          create: {
            organizationId,
            planId: plan.id,
            status: "ACTIVE",
          },
        });
        return NextResponse.json({
          subscription,
          message: "Free plan activated",
        });
      }

      return NextResponse.json(
        {
          error:
            "Plan does not have a Stripe price ID configured. Please contact support.",
        },
        { status: 400 }
      );
    }

    // Get existing subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        plan: true,
      },
    });

    // Check if upgrading/downgrading to a different plan
    if (existingSubscription && existingSubscription.planId !== planId) {
      // If there's an active Stripe subscription, cancel it first
      if (
        existingSubscription.stripeSubscriptionId &&
        existingSubscription.status === "ACTIVE"
      ) {
        try {
          await stripe.subscriptions.cancel(
            existingSubscription.stripeSubscriptionId
          );

          // Update database subscription status to CANCELED
          await prisma.subscription.update({
            where: { organizationId },
            data: {
              status: "CANCELED",
            },
          });

          // Trigger Pusher event for subscription change
          try {
            await pusherServer.trigger(
              `organization-${organizationId}`,
              "subscription-updated",
              {
                subscriptionId: existingSubscription.id,
                organizationId,
              }
            );
          } catch (error) {
            console.error("Failed to trigger Pusher event:", error);
          }
        } catch (error) {
          console.error("Error canceling subscription:", error);
          // Continue with new subscription creation even if cancellation fails
        }
      }
    }

    // If selecting the same plan, return error
    if (existingSubscription && existingSubscription.planId === planId) {
      return NextResponse.json(
        { error: "You are already subscribed to this plan" },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId: string;

    if (existingSubscription?.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId;
    } else {
      // Get organization to get owner email
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          members: {
            where: { role: "ADMIN" },
            include: { user: true },
            take: 1,
          },
        },
      });

      if (!organization || organization.members.length === 0) {
        return NextResponse.json(
          { error: "Organization admin not found" },
          { status: 404 }
        );
      }

      const customer = await stripe.customers.create({
        email: organization.members[0].user.email,
        name: organization.name,
        metadata: {
          organizationId,
        },
      });

      customerId = customer.id;
    }

    // Create checkout session
    const session = await createCheckoutSession(
      customerId,
      plan.stripePriceId,
      organizationId
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, action } = body;

    if (!organizationId || !action) {
      return NextResponse.json(
        { error: "organizationId and action are required" },
        { status: 400 }
      );
    }

    await requireMember(organizationId, "ADMIN");

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    if (action === "manage") {
      // Create portal session for managing subscription
      let customerId = subscription.stripeCustomerId;

      // If no customer ID, try to get it from Stripe subscription or sync first
      if (!customerId) {
        if (!subscription.stripeSubscriptionId) {
          // No subscription ID - try to find it by looking up the customer
          const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: {
              members: {
                where: { role: "ADMIN" },
                include: { user: true },
                take: 1,
              },
            },
          });

          if (organization && organization.members.length > 0) {
            const adminEmail = organization.members[0].user.email;

            try {
              // Search for customer by email
              const customers = await stripe.customers.list({
                email: adminEmail,
                limit: 1,
              });

              if (customers.data.length > 0) {
                const customer = customers.data[0];
                customerId = customer.id;

                // Get the customer's subscriptions
                const subscriptions = await stripe.subscriptions.list({
                  customer: customer.id,
                  status: "all",
                  limit: 1,
                });

                if (subscriptions.data.length > 0) {
                  const stripeSubscription = subscriptions.data[0];

                  // Find the plan by Stripe price ID
                  const foundPlan = await prisma.plan.findUnique({
                    where: {
                      stripePriceId: stripeSubscription.items.data[0]?.price.id,
                    },
                  });

                  if (foundPlan) {
                    // Update the subscription with all the Stripe data
                    await prisma.subscription.update({
                      where: { organizationId },
                      data: {
                        planId: foundPlan.id,
                        stripeCustomerId: customer.id,
                        stripeSubscriptionId: stripeSubscription.id,
                        status:
                          stripeSubscription.status === "active"
                            ? "ACTIVE"
                            : stripeSubscription.status === "trialing"
                            ? "TRIALING"
                            : stripeSubscription.status === "past_due"
                            ? "PAST_DUE"
                            : "CANCELED",
                        currentPeriodStart: (stripeSubscription as any)
                          .current_period_start
                          ? new Date(
                              (stripeSubscription as any).current_period_start *
                                1000
                            )
                          : null,
                        currentPeriodEnd: (stripeSubscription as any)
                          .current_period_end
                          ? new Date(
                              (stripeSubscription as any).current_period_end *
                                1000
                            )
                          : null,
                        cancelAtPeriodEnd:
                          (stripeSubscription as any).cancel_at_period_end ||
                          false,
                      },
                    });
                  }
                }
              }
            } catch (error) {
              console.error("Error looking up customer in Stripe:", error);
            }
          }

          if (!customerId) {
            return NextResponse.json(
              {
                error:
                  "No Stripe subscription found. Please click 'Refresh Status' first to sync your subscription from Stripe.",
              },
              { status: 400 }
            );
          }
        } else {
          // We have a subscription ID, fetch it from Stripe
          try {
            const stripeSubscription = await stripe.subscriptions.retrieve(
              subscription.stripeSubscriptionId
            );
            customerId = stripeSubscription.customer as string;

            // Also update the plan and other details while we're at it
            const plan = await prisma.plan.findUnique({
              where: {
                stripePriceId: stripeSubscription.items.data[0]?.price.id,
              },
            });

            // Update the subscription with the customer ID and latest info
            await prisma.subscription.update({
              where: { organizationId },
              data: {
                stripeCustomerId: customerId,
                ...(plan && { planId: plan.id }),
                status:
                  stripeSubscription.status === "active"
                    ? "ACTIVE"
                    : stripeSubscription.status === "trialing"
                    ? "TRIALING"
                    : stripeSubscription.status === "past_due"
                    ? "PAST_DUE"
                    : "CANCELED",
                currentPeriodStart: (stripeSubscription as any)
                  .current_period_start
                  ? new Date(
                      (stripeSubscription as any).current_period_start * 1000
                    )
                  : null,
                currentPeriodEnd: (stripeSubscription as any).current_period_end
                  ? new Date(
                      (stripeSubscription as any).current_period_end * 1000
                    )
                  : null,
                cancelAtPeriodEnd:
                  (stripeSubscription as any).cancel_at_period_end ?? false,
              },
            });
          } catch (error) {
            console.error("Error retrieving Stripe subscription:", error);
            return NextResponse.json(
              {
                error:
                  "Failed to retrieve subscription from Stripe. Please try clicking 'Refresh Status' first, then try again.",
              },
              { status: 400 }
            );
          }
        }
      }

      if (!customerId) {
        return NextResponse.json(
          {
            error:
              "Unable to retrieve Stripe customer information. Please ensure your subscription is properly linked to Stripe.",
          },
          { status: 400 }
        );
      }

      try {
        const session = await createPortalSession(customerId);
        return NextResponse.json({ url: session.url });
      } catch (error) {
        console.error("Error creating portal session:", error);
        return NextResponse.json(
          {
            error:
              "Failed to create Stripe customer portal session. Please try again later.",
          },
          { status: 500 }
        );
      }
    }

    if (action === "sync") {
      // Check if this is a free plan (which doesn't need Stripe sync)
      const plan = await prisma.plan.findUnique({
        where: { id: subscription.planId },
      });

      if (plan && plan.price.toNumber() === 0) {
        // Re-fetch subscription with plan relation to ensure it's included
        const subscriptionWithPlan = await prisma.subscription.findUnique({
          where: { organizationId },
          include: {
            plan: true,
          },
        });

        return NextResponse.json({
          message: "Free plan subscriptions don't require Stripe sync",
          subscription: subscriptionWithPlan,
        });
      }

      // Manually sync subscription status from Stripe
      if (!subscription.stripeSubscriptionId) {

        // Try to find the subscription in Stripe by looking up the customer
        // Get organization admin email to find Stripe customer
        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
          include: {
            members: {
              where: { role: "ADMIN" },
              include: { user: true },
              take: 1,
            },
          },
        });

        if (organization && organization.members.length > 0) {
          const adminEmail = organization.members[0].user.email;

          try {
            // Search for customer by email
            const customers = await stripe.customers.list({
              email: adminEmail,
              limit: 1,
            });

            if (customers.data.length > 0) {
              const customer = customers.data[0];

              // Get the customer's subscriptions
              const subscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                status: "all",
                limit: 1,
              });

              if (subscriptions.data.length > 0) {
                const stripeSubscription = subscriptions.data[0];
                const priceId = stripeSubscription.items.data[0]?.price.id;

                console.log("Found Stripe subscription:", {
                  subscriptionId: stripeSubscription.id,
                  priceId,
                  status: stripeSubscription.status,
                });

                // Find the plan by Stripe price ID
                const foundPlan = await prisma.plan.findUnique({
                  where: { stripePriceId: priceId },
                });

                if (!foundPlan) {
                  // Log all available plans to help debug
                  const allPlans = await prisma.plan.findMany({
                    select: { name: true, stripePriceId: true },
                  });
                  console.error("Plan not found for price ID:", priceId);
                  console.error("Available plans in database:", allPlans);
                  return NextResponse.json(
                    {
                      error: `Plan not found for Stripe price ID: ${priceId}. Please update your plans with the correct Stripe price IDs.`,
                      availablePlans: allPlans,
                      stripePriceId: priceId,
                    },
                    { status: 400 }
                  );
                }

                if (foundPlan) {
                  // Update the subscription with the Stripe data
                  const updatedSubscription = await prisma.subscription.update({
                    where: { organizationId },
                    data: {
                      planId: foundPlan.id,
                      stripeCustomerId: customer.id,
                      stripeSubscriptionId: stripeSubscription.id,
                      status:
                        stripeSubscription.status === "active"
                          ? "ACTIVE"
                          : stripeSubscription.status === "trialing"
                          ? "TRIALING"
                          : stripeSubscription.status === "past_due"
                          ? "PAST_DUE"
                          : "CANCELED",
                      currentPeriodStart: (stripeSubscription as any)
                        .current_period_start
                        ? new Date(
                            (stripeSubscription as any).current_period_start *
                              1000
                          )
                        : null,
                      currentPeriodEnd: (stripeSubscription as any)
                        .current_period_end
                        ? new Date(
                            (stripeSubscription as any).current_period_end *
                              1000
                          )
                        : null,
                      cancelAtPeriodEnd:
                        (stripeSubscription as any).cancel_at_period_end ||
                        false,
                    },
                    include: {
                      plan: true,
                    },
                  });

                  console.log("Synced subscription:", {
                    organizationId,
                    planName: foundPlan.name,
                    stripeSubscriptionId: stripeSubscription.id,
                  });

                  // Trigger Pusher event
                  try {
                    await pusherServer.trigger(
                      `organization-${organizationId}`,
                      "subscription-updated",
                      {
                        subscriptionId: updatedSubscription.id,
                        organizationId,
                      }
                    );
                  } catch (error) {
                    console.error("Failed to trigger Pusher event:", error);
                  }

                  return NextResponse.json({
                    subscription: updatedSubscription,
                    message: "Subscription synced successfully from Stripe",
                  });
                }
              }
            }
          } catch (error) {
            console.error("Error looking up subscription in Stripe:", error);
          }
        }

        return NextResponse.json(
          {
            error:
              "No Stripe subscription ID found. This subscription is not linked to Stripe. If you recently purchased a plan, please wait a few moments and try again, or contact support.",
          },
          { status: 400 }
        );
      }

      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );

        // Find the plan by Stripe price ID
        const plan = await prisma.plan.findUnique({
          where: { stripePriceId: stripeSubscription.items.data[0]?.price.id },
        });

        if (!plan) {
          return NextResponse.json(
            { error: "Plan not found for this subscription" },
            { status: 404 }
          );
        }

        // Update subscription in database
        const updatedSubscription = await prisma.subscription.update({
          where: { organizationId },
          data: {
            planId: plan.id,
            stripeCustomerId: stripeSubscription.customer as string, // Ensure customer ID is updated
            status:
              stripeSubscription.status === "active"
                ? "ACTIVE"
                : stripeSubscription.status === "trialing"
                ? "TRIALING"
                : stripeSubscription.status === "past_due"
                ? "PAST_DUE"
                : "CANCELED",
            currentPeriodStart: (stripeSubscription as any).current_period_start
              ? new Date(
                  (stripeSubscription as any).current_period_start * 1000
                )
              : null,
            currentPeriodEnd: (stripeSubscription as any).current_period_end
              ? new Date((stripeSubscription as any).current_period_end * 1000)
              : null,
            cancelAtPeriodEnd:
              (stripeSubscription as any).cancel_at_period_end || false,
          },
          include: {
            plan: true,
          },
        });

        // Trigger Pusher event for real-time update
        try {
          await pusherServer.trigger(
            `organization-${organizationId}`,
            "subscription-updated",
            {
              subscriptionId: updatedSubscription.id,
              organizationId,
            }
          );
        } catch (error) {
          console.error("Failed to trigger Pusher event:", error);
          // Don't fail the request if Pusher fails
        }

        return NextResponse.json({
          subscription: updatedSubscription,
          message: "Subscription synced successfully",
        });
      } catch (error) {
        console.error("Error syncing subscription:", error);
        return NextResponse.json(
          { error: "Failed to sync subscription from Stripe" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to manage subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
