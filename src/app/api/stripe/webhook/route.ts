import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { pusherServer } from "@/lib/pusher";
import {
  sendSubscriptionWelcomeEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
} from "@/lib/email";

function isStripeSubscription(obj: unknown): obj is {
  id: string;
  customer: string | Stripe.Customer | Stripe.DeletedCustomer;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  metadata: Stripe.Metadata | null;
  items: { data: Array<{ price: { id: string } }> };
} {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "current_period_start" in obj &&
    "current_period_end" in obj
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      console.error("Webhook error: No signature header found");
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("Webhook error: STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      const error = err as Error;
      console.error("Webhook signature verification failed:", error.message);
      return NextResponse.json(
        { error: `Webhook Error: ${error.message}` },
        { status: 400 }
      );
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const eventObj = event.data.object;
          if (!isStripeSubscription(eventObj)) {
            console.error("Invalid subscription object in webhook");
            break;
          }
          const stripeSubscription = eventObj;

          let organizationId = stripeSubscription.metadata?.organizationId;

          if (!organizationId) {
            const existing = await prisma.subscription.findUnique({
              where: { stripeSubscriptionId: stripeSubscription.id },
              select: { organizationId: true },
            });
            if (existing) {
              organizationId = existing.organizationId;
            } else {
              console.error(
                "No organizationId in subscription metadata and not found in database"
              );
              break;
            }
          }

          const priceId = stripeSubscription.items.data[0]?.price.id;

          if (!priceId) {
            console.error("No price ID found in subscription items");
            break;
          }

          const plan = await prisma.plan.findUnique({
            where: { stripePriceId: priceId },
          });

          if (!plan) {
            console.error("Plan not found for price ID:", priceId);
            break;
          }

          try {
            await prisma.$queryRaw`SELECT 1`;
          } catch (dbConnError) {
            console.error("Database connection failed:", dbConnError);
            throw new Error(
              `Database connection failed: ${
                dbConnError instanceof Error
                  ? dbConnError.message
                  : "Unknown error"
              }`
            );
          }

          const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, name: true },
          });

          if (!organization) {
            console.error("Organization not found:", organizationId);
            throw new Error(
              `Organization ${organizationId} not found in database`
            );
          }

          try {
            const updatedSubscription = await prisma.subscription.upsert({
              where: { organizationId },
              update: {
                planId: plan.id,
                stripeCustomerId: stripeSubscription.customer as string,
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
              create: {
                organizationId,
                planId: plan.id,
                stripeCustomerId: stripeSubscription.customer as string,
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

            if (
              event.type === "customer.subscription.created" &&
              updatedSubscription.status === "ACTIVE" &&
              plan.price.toNumber() > 0
            ) {
              try {
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
                  await sendSubscriptionWelcomeEmail(
                    organization.members[0].user,
                    organization,
                    plan
                  );
                }
              } catch (emailError) {
                console.error(
                  "Failed to send subscription welcome email:",
                  emailError
                );
              }
            } else {
            }

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
          } catch (error) {
            console.error(
              "Error upserting subscription in customer.subscription.created/updated:",
              error
            );
            throw error;
          }
          break;
        }

        case "customer.subscription.deleted": {
          const eventObj = event.data.object;
          if (!isStripeSubscription(eventObj)) {
            console.error("Invalid subscription object in webhook");
            break;
          }
          const stripeSubscription = eventObj;
          const organizationId = stripeSubscription.metadata?.organizationId;

          let updatedSubscription;
          if (!organizationId) {
            const existing = await prisma.subscription.findUnique({
              where: { stripeSubscriptionId: stripeSubscription.id },
              include: { plan: true },
            });
            if (existing) {
              updatedSubscription = await prisma.subscription.update({
                where: { id: existing.id },
                data: { status: "CANCELED" },
                include: { plan: true },
              });

              try {
                const organization = await prisma.organization.findUnique({
                  where: { id: existing.organizationId },
                  include: {
                    members: {
                      where: { role: "ADMIN" },
                      include: { user: true },
                      take: 1,
                    },
                  },
                });
                if (
                  organization &&
                  organization.members.length > 0 &&
                  existing.plan
                ) {
                  await sendSubscriptionCancelledEmail(
                    organization.members[0].user,
                    organization,
                    existing.plan
                  );
                }
              } catch (emailError) {
                console.error(
                  "Failed to send subscription cancelled email:",
                  emailError
                );
              }
              try {
                await pusherServer.trigger(
                  `organization-${existing.organizationId}`,
                  "subscription-updated",
                  {
                    subscriptionId: updatedSubscription.id,
                    organizationId: existing.organizationId,
                  }
                );
              } catch (error) {
                console.error("Failed to trigger Pusher event:", error);
              }
            }
          } else {
            const existingSub = await prisma.subscription.findUnique({
              where: { organizationId },
              include: { plan: true },
            });
            updatedSubscription = await prisma.subscription.update({
              where: { organizationId },
              data: { status: "CANCELED" },
              include: { plan: true },
            });

            try {
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
              if (
                organization &&
                organization.members.length > 0 &&
                existingSub?.plan
              ) {
                await sendSubscriptionCancelledEmail(
                  organization.members[0].user,
                  organization,
                  existingSub.plan
                );
              }
            } catch (emailError) {
              console.error(
                "Failed to send subscription cancelled email:",
                emailError
              );
            }

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
          }
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const invoiceSubscription = (
            invoice as { subscription?: string | Stripe.Subscription | null }
          ).subscription;
          const subscriptionId =
            typeof invoiceSubscription === "string"
              ? invoiceSubscription
              : invoiceSubscription?.id || null;

          if (subscriptionId) {
            const subscription = await prisma.subscription.findUnique({
              where: { stripeSubscriptionId: subscriptionId },
            });

            if (subscription) {
              const updatedSubscription = await prisma.subscription.update({
                where: { id: subscription.id },
                data: { status: "ACTIVE" },
              });

              try {
                await pusherServer.trigger(
                  `organization-${subscription.organizationId}`,
                  "subscription-updated",
                  {
                    subscriptionId: updatedSubscription.id,
                    organizationId: subscription.organizationId,
                  }
                );
              } catch (error) {
                console.error("Failed to trigger Pusher event:", error);
              }
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const invoiceSubscription = (
            invoice as { subscription?: string | Stripe.Subscription | null }
          ).subscription;
          const subscriptionId =
            typeof invoiceSubscription === "string"
              ? invoiceSubscription
              : invoiceSubscription?.id || null;

          if (subscriptionId) {
            const subscription = await prisma.subscription.findUnique({
              where: { stripeSubscriptionId: subscriptionId },
            });

            if (subscription) {
              const updatedSubscription = await prisma.subscription.update({
                where: { id: subscription.id },
                data: { status: "PAST_DUE" },
              });

              try {
                const organization = await prisma.organization.findUnique({
                  where: { id: subscription.organizationId },
                  include: {
                    members: {
                      where: { role: "ADMIN" },
                      include: { user: true },
                      take: 1,
                    },
                  },
                });
                if (organization && organization.members.length > 0) {
                  await sendPaymentFailedEmail(
                    organization.members[0].user,
                    organization,
                    updatedSubscription
                  );
                }
              } catch (emailError) {
                console.error(
                  "Failed to send payment failed email:",
                  emailError
                );
              }

              try {
                await pusherServer.trigger(
                  `organization-${subscription.organizationId}`,
                  "subscription-updated",
                  {
                    subscriptionId: updatedSubscription.id,
                    organizationId: subscription.organizationId,
                  }
                );
              } catch (error) {
                console.error("Failed to trigger Pusher event:", error);
              }
            }
          }
          break;
        }

        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const organizationId = session.metadata?.organizationId;

          if (!organizationId) {
            console.error("No organizationId in checkout session metadata");
            break;
          }

          const subscriptionId = session.subscription as string;
          if (!subscriptionId) {
            console.error("No subscription ID in checkout session");
            break;
          }

          try {
            const retrievedSub = await stripe.subscriptions.retrieve(
              subscriptionId,
              {
                expand: ["items.data.price"],
              }
            );
            if (!retrievedSub || !retrievedSub.id) {
              console.error(
                "[checkout.session.completed] Invalid subscription object:",
                retrievedSub
              );
              throw new Error(
                "Invalid subscription retrieved from Stripe: no subscription ID"
              );
            }

            console.log(
              "[checkout.session.completed] Retrieved subscription successfully:",
              {
                id: retrievedSub.id,
                status: retrievedSub.status,
                currentPeriodStart: (retrievedSub as any).current_period_start,
                currentPeriodEnd: (retrievedSub as any).current_period_end,
                itemsCount: (retrievedSub as any).items?.data?.length || 0,
              }
            );

            const stripeSubscription = retrievedSub as any;

            const priceId = stripeSubscription.items?.data?.[0]?.price?.id;

            console.log("[checkout.session.completed] Price ID extraction:", {
              hasItems: !!stripeSubscription.items,
              hasData: !!stripeSubscription.items?.data,
              dataLength: stripeSubscription.items?.data?.length || 0,
              priceId,
            });

            if (!priceId) {
              console.error(
                "[checkout.session.completed] No price ID found in subscription items:",
                {
                  items: stripeSubscription.items,
                  itemsData: stripeSubscription.items?.data,
                }
              );
              break;
            }

            const plan = await prisma.plan.findUnique({
              where: {
                stripePriceId: priceId,
              },
            });

            if (!plan) {
              console.error("Plan not found for price ID:", priceId);
              break;
            }

            try {
              await prisma.$queryRaw`SELECT 1`;
            } catch (dbConnError) {
              console.error("Database connection failed:", dbConnError);
              throw new Error(
                `Database connection failed: ${
                  dbConnError instanceof Error
                    ? dbConnError.message
                    : "Unknown error"
                }`
              );
            }

            const organization = await prisma.organization.findUnique({
              where: { id: organizationId },
              select: { id: true, name: true },
            });

            if (!organization) {
              console.error("Organization not found:", organizationId);
              throw new Error(
                `Organization ${organizationId} not found in database`
              );
            }

            let updatedSubscription;
            try {
              updatedSubscription = await prisma.subscription.upsert({
                where: { organizationId },
                update: {
                  planId: plan.id,
                  stripeCustomerId: stripeSubscription.customer as string,
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
                    typeof (stripeSubscription as any).current_period_start ===
                    "number"
                      ? new Date(
                          (stripeSubscription as any).current_period_start *
                            1000
                        )
                      : null,
                  currentPeriodEnd:
                    typeof (stripeSubscription as any).current_period_end ===
                    "number"
                      ? new Date(
                          (stripeSubscription as any).current_period_end * 1000
                        )
                      : null,
                  cancelAtPeriodEnd:
                    (stripeSubscription as any).cancel_at_period_end ?? false,
                },
                create: {
                  organizationId,
                  planId: plan.id,
                  stripeCustomerId: stripeSubscription.customer as string,
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
                    typeof (stripeSubscription as any).current_period_start ===
                    "number"
                      ? new Date(
                          (stripeSubscription as any).current_period_start *
                            1000
                        )
                      : null,
                  currentPeriodEnd:
                    typeof (stripeSubscription as any).current_period_end ===
                    "number"
                      ? new Date(
                          (stripeSubscription as any).current_period_end * 1000
                        )
                      : null,
                  cancelAtPeriodEnd:
                    (stripeSubscription as any).cancel_at_period_end ?? false,
                },
              });
            } catch (dbError) {
              console.error(
                "Database error during subscription upsert:",
                dbError
              );
              throw dbError;
            }

            const planPrice =
              typeof plan.price === "object" && "toNumber" in plan.price
                ? (plan.price as { toNumber: () => number }).toNumber()
                : typeof plan.price === "number"
                ? plan.price
                : parseFloat(String(plan.price)) || 0;

            console.log("[checkout.session.completed] Email check:", {
              status: updatedSubscription.status,
              planPrice,
              shouldSend:
                (updatedSubscription.status === "ACTIVE" ||
                  updatedSubscription.status === "TRIALING") &&
                planPrice > 0,
            });

            if (
              (updatedSubscription.status === "ACTIVE" ||
                updatedSubscription.status === "TRIALING") &&
              planPrice > 0
            ) {
              console.log(
                "[checkout.session.completed] Sending welcome email for organization:",
                organizationId
              );
              try {
                const orgWithMembers = await prisma.organization.findUnique({
                  where: { id: organizationId },
                  include: {
                    members: {
                      where: { role: "ADMIN" },
                      include: { user: true },
                      take: 1,
                    },
                  },
                });
                if (orgWithMembers && orgWithMembers.members.length > 0) {
                  await sendSubscriptionWelcomeEmail(
                    orgWithMembers.members[0].user,
                    orgWithMembers,
                    plan
                  );
                  console.log(
                    "[checkout.session.completed] Welcome email sent successfully to:",
                    orgWithMembers.members[0].user.email
                  );
                }
              } catch (emailError) {
                console.error(
                  "[checkout.session.completed] Failed to send subscription welcome email:",
                  emailError
                );
                console.error(
                  "[checkout.session.completed] Email error details:",
                  {
                    error:
                      emailError instanceof Error
                        ? emailError.message
                        : String(emailError),
                    stack:
                      emailError instanceof Error
                        ? emailError.stack
                        : undefined,
                  }
                );
              }
            } else {
              console.log(
                "[checkout.session.completed] Email condition not met:",
                {
                  status: updatedSubscription.status,
                  planPrice,
                  reason:
                    updatedSubscription.status !== "ACTIVE"
                      ? "Status is not ACTIVE"
                      : "Plan is free",
                }
              );
            }

            try {
              await pusherServer.trigger(
                `organization-${organizationId}`,
                "subscription-updated",
                {
                  subscriptionId: updatedSubscription.id,
                  organizationId,
                }
              );
              console.log(
                "[checkout.session.completed] Pusher event triggered for organization:",
                organizationId
              );
            } catch (error) {
              console.error("Failed to trigger Pusher event:", error);
            }
          } catch (error) {
            console.error(
              "Error processing checkout.session.completed:",
              error
            );
            throw error;
          }
          break;
        }

        default:
          break;
      }

      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Outer webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 200 }
    );
  }
}
