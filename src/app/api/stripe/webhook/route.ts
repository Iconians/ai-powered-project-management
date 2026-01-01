import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import Stripe from "stripe";
import { pusherServer } from "@/lib/pusher";

// Disable body parsing for this route - we need the raw body for signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Get the raw body as text (not parsed JSON)
    // This is critical - Stripe needs the exact raw body for signature verification
    // In Next.js 16, we need to use request.body directly or ensure bodyParser is disabled
    const body = await request.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      console.error("Webhook error: No signature header found");
      return NextResponse.json(
        { error: "No signature" },
        { status: 400 }
      );
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
      console.error("Body length:", body.length);
      console.error("Signature:", signature.substring(0, 20) + "...");
      console.error("Webhook secret configured:", !!process.env.STRIPE_WEBHOOK_SECRET);
      return NextResponse.json(
        { error: `Webhook Error: ${error.message}` },
        { status: 400 }
      );
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          // Type guard to ensure we have the subscription properties
          if (!('current_period_start' in subscription)) {
            console.error("Subscription object missing expected properties");
            break;
          }
          let organizationId = subscription.metadata?.organizationId;

          // If no organizationId in metadata, try to find it by subscription ID
          if (!organizationId) {
            const existing = await prisma.subscription.findUnique({
              where: { stripeSubscriptionId: subscription.id },
              select: { organizationId: true },
            });
            if (existing) {
              organizationId = existing.organizationId;
            } else {
              console.error("No organizationId in subscription metadata and not found in database");
              break;
            }
          }

          const priceId = subscription.items.data[0]?.price.id;
          if (!priceId) {
            console.error("No price ID found in subscription items");
            break;
          }

          // Find the plan by Stripe price ID
          const plan = await prisma.plan.findUnique({
            where: { stripePriceId: priceId },
          });

          if (!plan) {
            console.error("Plan not found for price ID:", priceId);
            console.error("Available plans:", await prisma.plan.findMany({ select: { name: true, stripePriceId: true } }));
            break;
          }

          // Update or create subscription
          try {
            const updatedSubscription = await prisma.subscription.upsert({
              where: { organizationId },
              update: {
                planId: plan.id,
                stripeCustomerId: subscription.customer as string,
                stripeSubscriptionId: subscription.id,
                status:
                  subscription.status === "active"
                    ? "ACTIVE"
                    : subscription.status === "trialing"
                    ? "TRIALING"
                    : subscription.status === "past_due"
                    ? "PAST_DUE"
                    : "CANCELED",
                currentPeriodStart: (subscription as any).current_period_start
                  ? new Date((subscription as any).current_period_start * 1000)
                  : null,
                currentPeriodEnd: (subscription as any).current_period_end
                  ? new Date((subscription as any).current_period_end * 1000)
                  : null,
                cancelAtPeriodEnd: (subscription as any).cancel_at_period_end ?? false,
              },
              create: {
                organizationId,
                planId: plan.id,
                stripeCustomerId: subscription.customer as string,
                stripeSubscriptionId: subscription.id,
                status:
                  subscription.status === "active"
                    ? "ACTIVE"
                    : subscription.status === "trialing"
                    ? "TRIALING"
                    : subscription.status === "past_due"
                    ? "PAST_DUE"
                    : "CANCELED",
                currentPeriodStart: (subscription as any).current_period_start
                  ? new Date((subscription as any).current_period_start * 1000)
                  : null,
                currentPeriodEnd: (subscription as any).current_period_end
                  ? new Date((subscription as any).current_period_end * 1000)
                  : null,
                cancelAtPeriodEnd: (subscription as any).cancel_at_period_end ?? false,
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
              // Don't fail the webhook if Pusher fails
            }
          } catch (error) {
            console.error("Error upserting subscription in customer.subscription.created/updated:", error);
            console.error("Organization ID:", organizationId);
            console.error("Plan ID:", plan.id);
            console.error("Stripe Subscription ID:", subscription.id);
            throw error; // Re-throw to be caught by outer try-catch
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const organizationId = subscription.metadata?.organizationId;

          let updatedSubscription;
          if (!organizationId) {
            // Try to find by subscription ID
            const existing = await prisma.subscription.findUnique({
              where: { stripeSubscriptionId: subscription.id },
            });
            if (existing) {
              updatedSubscription = await prisma.subscription.update({
                where: { id: existing.id },
                data: { status: "CANCELED" },
              });
              // Trigger Pusher event
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
            updatedSubscription = await prisma.subscription.update({
              where: { organizationId },
              data: { status: "CANCELED" },
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
          }
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = typeof (invoice as any).subscription === 'string' 
            ? (invoice as any).subscription 
            : (invoice as any).subscription?.id || null;

          if (subscriptionId) {
            const subscription = await prisma.subscription.findUnique({
              where: { stripeSubscriptionId: subscriptionId },
            });

            if (subscription) {
              const updatedSubscription = await prisma.subscription.update({
                where: { id: subscription.id },
                data: { status: "ACTIVE" },
              });

              // Trigger Pusher event
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
          const subscriptionId = typeof (invoice as any).subscription === 'string' 
            ? (invoice as any).subscription 
            : (invoice as any).subscription?.id || null;

          if (subscriptionId) {
            const subscription = await prisma.subscription.findUnique({
              where: { stripeSubscriptionId: subscriptionId },
            });

            if (subscription) {
              const updatedSubscription = await prisma.subscription.update({
                where: { id: subscription.id },
                data: { status: "PAST_DUE" },
              });

              // Trigger Pusher event
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
          // Handle checkout completion - create/update subscription
          const session = event.data.object as Stripe.Checkout.Session;
          const organizationId = session.metadata?.organizationId;

          if (!organizationId) {
            console.error("No organizationId in checkout session metadata");
            break;
          }

          // Get the subscription ID from the checkout session
          const subscriptionId = session.subscription as string;
          if (!subscriptionId) {
            console.error("No subscription ID in checkout session");
            break;
          }

          try {
            // Retrieve the subscription from Stripe
            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;

            // Find the plan by Stripe price ID
            const plan = await prisma.plan.findUnique({
              where: { stripePriceId: stripeSubscription.items.data[0]?.price.id },
            });

            if (!plan) {
              console.error("Plan not found for price ID:", stripeSubscription.items.data[0]?.price.id);
              break;
            }

            // Update or create subscription
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
                currentPeriodStart: (stripeSubscription as any).current_period_start
                  ? new Date((stripeSubscription as any).current_period_start * 1000)
                  : null,
                currentPeriodEnd: (stripeSubscription as any).current_period_end
                  ? new Date((stripeSubscription as any).current_period_end * 1000)
                  : null,
                cancelAtPeriodEnd: (stripeSubscription as any).cancel_at_period_end ?? false,
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
                currentPeriodStart: (stripeSubscription as any).current_period_start
                  ? new Date((stripeSubscription as any).current_period_start * 1000)
                  : null,
                currentPeriodEnd: (stripeSubscription as any).current_period_end
                  ? new Date((stripeSubscription as any).current_period_end * 1000)
                  : null,
                cancelAtPeriodEnd: (stripeSubscription as any).cancel_at_period_end ?? false,
              },
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
          } catch (error) {
            console.error("Error processing checkout.session.completed:", error);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Outer webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

