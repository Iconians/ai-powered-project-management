import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  stripe,
  createCheckoutSession,
  createPortalSession,
} from "@/lib/stripe";
import { pusherServer } from "@/lib/pusher";
import type Stripe from "stripe";

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
    await requireMember(organizationId);

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(null, { status: 200 });
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
      if (plan.price.toNumber() === 0) {
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

    const existingSubscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        plan: true,
      },
    });

    if (existingSubscription && existingSubscription.planId !== planId) {
      if (
        existingSubscription.stripeSubscriptionId &&
        existingSubscription.status === "ACTIVE"
      ) {
        try {
          await stripe.subscriptions.cancel(
            existingSubscription.stripeSubscriptionId
          );

          await prisma.subscription.update({
            where: { organizationId },
            data: {
              status: "CANCELED",
            },
          });

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
        }
      }
    }

    if (existingSubscription && existingSubscription.planId === planId) {
      return NextResponse.json(
        { error: "You are already subscribed to this plan" },
        { status: 400 }
      );
    }

    let customerId: string;

    if (existingSubscription?.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId;
    } else {
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
      let customerId = subscription.stripeCustomerId;
      if (!customerId) {
        if (!subscription.stripeSubscriptionId) {
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
              const customers = await stripe.customers.list({
                email: adminEmail,
                limit: 1,
              });

              if (customers.data.length > 0) {
                const customer = customers.data[0];
                customerId = customer.id;
                const subscriptions = await stripe.subscriptions.list({
                  customer: customer.id,
                  status: "all",
                  limit: 1,
                });

                if (subscriptions.data.length > 0) {
                  const stripeSubscription = subscriptions
                    .data[0] as unknown as {
                    id: string;
                    customer: string | Stripe.Customer | Stripe.DeletedCustomer;
                    status: Stripe.Subscription.Status;
                    current_period_start: number;
                    current_period_end: number;
                    cancel_at_period_end: boolean;
                    items: Stripe.ApiList<Stripe.SubscriptionItem>;
                  } & Record<string, unknown>;

                  const foundPlan = await prisma.plan.findUnique({
                    where: {
                      stripePriceId: stripeSubscription.items.data[0]?.price.id,
                    },
                  });

                  if (foundPlan) {
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
                        currentPeriodStart:
                          typeof stripeSubscription.current_period_start ===
                          "number"
                            ? new Date(
                                stripeSubscription.current_period_start * 1000
                              )
                            : null,
                        currentPeriodEnd:
                          typeof stripeSubscription.current_period_end ===
                          "number"
                            ? new Date(
                                stripeSubscription.current_period_end * 1000
                              )
                            : null,
                        cancelAtPeriodEnd:
                          stripeSubscription.cancel_at_period_end || false,
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
          try {
            const retrievedSub = await stripe.subscriptions.retrieve(
              subscription.stripeSubscriptionId
            );
            const stripeSubscription = retrievedSub as unknown as {
              id: string;
              customer: string | Stripe.Customer | Stripe.DeletedCustomer;
              status: Stripe.Subscription.Status;
              current_period_start: number;
              current_period_end: number;
              cancel_at_period_end: boolean;
              items: Stripe.ApiList<Stripe.SubscriptionItem>;
            };
            customerId = stripeSubscription.customer as string;

            const plan = await prisma.plan.findUnique({
              where: {
                stripePriceId: stripeSubscription.items.data[0]?.price.id,
              },
            });

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
                currentPeriodStart:
                  typeof stripeSubscription.current_period_start === "number"
                    ? new Date(stripeSubscription.current_period_start * 1000)
                    : null,
                currentPeriodEnd:
                  typeof stripeSubscription.current_period_end === "number"
                    ? new Date(stripeSubscription.current_period_end * 1000)
                    : null,
                cancelAtPeriodEnd:
                  stripeSubscription.cancel_at_period_end ?? false,
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
      const plan = await prisma.plan.findUnique({
        where: { id: subscription.planId },
      });

      if (plan && plan.price.toNumber() === 0) {
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

      if (!subscription.stripeSubscriptionId) {
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
            const customers = await stripe.customers.list({
              email: adminEmail,
              limit: 1,
            });

            if (customers.data.length > 0) {
              const customer = customers.data[0];

              const subscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                status: "all",
                limit: 1,
              });

              if (subscriptions.data.length > 0) {
                const stripeSubscription = subscriptions.data[0] as unknown as {
                  id: string;
                  customer: string | Stripe.Customer | Stripe.DeletedCustomer;
                  status: Stripe.Subscription.Status;
                  current_period_start: number;
                  current_period_end: number;
                  cancel_at_period_end: boolean;
                  items: Stripe.ApiList<Stripe.SubscriptionItem>;
                } & Record<string, unknown>;
                const priceId = stripeSubscription.items.data[0]?.price.id;

                const foundPlan = await prisma.plan.findUnique({
                  where: { stripePriceId: priceId },
                });

                if (!foundPlan) {
                  const allPlans = await prisma.plan.findMany({
                    select: { name: true, stripePriceId: true },
                  });
                  console.error("Plan not found for price ID:", priceId);
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
                      currentPeriodStart:
                        typeof (
                          stripeSubscription as {
                            current_period_start?: number;
                          }
                        ).current_period_start === "number"
                          ? new Date(
                              (
                                stripeSubscription as {
                                  current_period_start: number;
                                }
                              ).current_period_start * 1000
                            )
                          : null,
                      currentPeriodEnd:
                        typeof (
                          stripeSubscription as {
                            current_period_end?: number;
                          }
                        ).current_period_end === "number"
                          ? new Date(
                              (
                                stripeSubscription as {
                                  current_period_end: number;
                                }
                              ).current_period_end * 1000
                            )
                          : null,
                      cancelAtPeriodEnd:
                        stripeSubscription.cancel_at_period_end || false,
                    },
                    include: {
                      plan: true,
                    },
                  });

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
        const retrievedSub = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );
        const stripeSubscription = retrievedSub as unknown as {
          id: string;
          customer: string | Stripe.Customer | Stripe.DeletedCustomer;
          status: Stripe.Subscription.Status;
          current_period_start: number;
          current_period_end: number;
          cancel_at_period_end: boolean;
          items: Stripe.ApiList<Stripe.SubscriptionItem>;
        } & Record<string, unknown>;

        
        const plan = await prisma.plan.findUnique({
          where: { stripePriceId: stripeSubscription.items.data[0]?.price.id },
        });

        if (!plan) {
          return NextResponse.json(
            { error: "Plan not found for this subscription" },
            { status: 404 }
          );
        }

        const updatedSubscription = await prisma.subscription.update({
          where: { organizationId },
          data: {
            planId: plan.id,
            stripeCustomerId: stripeSubscription.customer as string,
            status:
              stripeSubscription.status === "active"
                ? "ACTIVE"
                : stripeSubscription.status === "trialing"
                ? "TRIALING"
                : stripeSubscription.status === "past_due"
                ? "PAST_DUE"
                : "CANCELED",
            currentPeriodStart:
              typeof stripeSubscription.current_period_start === "number"
                ? new Date(stripeSubscription.current_period_start * 1000)
                : null,
            currentPeriodEnd:
              typeof stripeSubscription.current_period_end === "number"
                ? new Date(stripeSubscription.current_period_end * 1000)
                : null,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
          },
          include: {
            plan: true,
          },
        });

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
