import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelSubscription } from "@/lib/stripe";

export async function DELETE(_request: NextRequest) {
  try {
    const user = await requireAuth();

    
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

    
    const blockingOrganizations: string[] = [];

    for (const membership of userMemberships) {
      if (membership.role === "ADMIN") {
        const organization = membership.organization;
        const allAdmins = organization.members.filter(
          (m) => m.role === "ADMIN"
        );
        const totalMembers = organization.members.length;

        
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
              
            }
          }
        }
      }
    }

    
    const userOrganizationIds = userMemberships.map((m) => m.organizationId);

    
    await prisma.user.delete({
      where: { id: user.id },
    });

    
    for (const orgId of userOrganizationIds) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          members: true,
        },
      });

      if (org && org.members.length === 0) {
        
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

