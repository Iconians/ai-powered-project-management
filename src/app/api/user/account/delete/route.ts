import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelSubscription } from "@/lib/stripe";

export async function DELETE(_request: NextRequest) {
  try {
    const user = await requireAuth();

    // Get all organizations where the user is a member
    const userMemberships = await prisma.member.findMany({
      where: { userId: user.id },
      include: {
        organization: {
          include: {
            members: true,
            subscriptions: {
              where: {
                status: {
                  in: ["ACTIVE", "TRIALING", "PAST_DUE"],
                },
              },
            },
          },
        },
      },
    });

    // Check if user is the only admin in any organization with other members
    const blockingOrganizations: string[] = [];

    for (const membership of userMemberships) {
      if (membership.role === "ADMIN") {
        const organization = membership.organization;
        const allAdmins = organization.members.filter(
          (m) => m.role === "ADMIN"
        );
        const totalMembers = organization.members.length;

        // If user is the only admin AND there are other members, block deletion
        if (allAdmins.length === 1 && totalMembers > 1) {
          blockingOrganizations.push(organization.name);
        }
      }
    }

    if (blockingOrganizations.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete account. You are the only administrator for the following organization(s) with other members: " +
            blockingOrganizations.join(", ") +
            ". Please assign another administrator or remove other members before deleting your account.",
        },
        { status: 403 }
      );
    }

    // Cancel Stripe subscriptions for organizations where user is admin
    for (const membership of userMemberships) {
      if (membership.role === "ADMIN") {
        const organization = membership.organization;
        for (const subscription of organization.subscriptions) {
          if (
            subscription.stripeSubscriptionId &&
            subscription.status !== "CANCELED"
          ) {
            try {
              await cancelSubscription(subscription.stripeSubscriptionId);
              // Update subscription status in database
              await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                  status: "CANCELED",
                  cancelAtPeriodEnd: true,
                },
              });
            } catch (stripeError) {
              console.error(
                `Failed to cancel Stripe subscription ${subscription.stripeSubscriptionId}:`,
                stripeError
              );
              // Continue with deletion even if Stripe cancellation fails
            }
          }
        }
      }
    }

    // Track organization IDs the user was a member of for cleanup
    const userOrganizationIds = userMemberships.map((m) => m.organizationId);

    // Delete the user (this will cascade delete members, comments, attachments, reminders, invitations)
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Clean up organizations that have no members left (only check organizations user was a member of)
    for (const orgId of userOrganizationIds) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          members: true,
        },
      });

      if (org && org.members.length === 0) {
        // This will cascade delete boards, subscriptions, usage, invitations
        await prisma.organization.delete({
          where: { id: org.id },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete account:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

