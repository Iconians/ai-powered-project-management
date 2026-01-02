/**
 * Script to update Plan records with Stripe Price IDs
 * 
 * Usage:
 * 1. Create products and prices in Stripe Dashboard or via Stripe CLI
 * 2. Run this script with the price IDs:
 *    STRIPE_PRO_PRICE_ID=price_xxx STRIPE_ENTERPRISE_PRICE_ID=price_yyy bun run scripts/update-stripe-prices.ts
 * 
 * Or update manually via Prisma Studio:
 *    bunx prisma studio
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating plans with Stripe Price IDs...\n");

  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const enterprisePriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID;

  if (!proPriceId && !enterprisePriceId) {
    console.log("No Stripe Price IDs provided via environment variables.");
    console.log("\nTo update plans, set the following environment variables:");
    console.log("  STRIPE_PRO_PRICE_ID=price_xxxxx");
    console.log("  STRIPE_ENTERPRISE_PRICE_ID=price_xxxxx");
    console.log("\nOr update manually via Prisma Studio:");
    console.log("  bunx prisma studio");
    console.log("\nThen navigate to the Plan table and update the stripePriceId field.");
    return;
  }

  if (proPriceId) {
    const proPlan = await prisma.plan.findFirst({
      where: { name: "Pro" },
    });

    if (proPlan) {
      await prisma.plan.update({
        where: { id: proPlan.id },
        data: { stripePriceId: proPriceId },
      });
      console.log(`✓ Updated Pro plan with Stripe Price ID: ${proPriceId}`);
    } else {
      console.log("⚠ Pro plan not found");
    }
  }

  if (enterprisePriceId) {
    const enterprisePlan = await prisma.plan.findFirst({
      where: { name: "Enterprise" },
    });

    if (enterprisePlan) {
      await prisma.plan.update({
        where: { id: enterprisePlan.id },
        data: { stripePriceId: enterprisePriceId },
      });
      console.log(`✓ Updated Enterprise plan with Stripe Price ID: ${enterprisePriceId}`);
    } else {
      console.log("⚠ Enterprise plan not found");
    }
  }

  console.log("\n✅ Update complete!");
  console.log("\nCurrent plans:");
  const plans = await prisma.plan.findMany({
    orderBy: { price: "asc" },
  });
  plans.forEach((plan) => {
    console.log(
      `  - ${plan.name}: $${plan.price}/${plan.interval} ${plan.stripePriceId ? `(Stripe: ${plan.stripePriceId})` : "(No Stripe Price ID)"}`
    );
  });
}

main()
  .catch((e) => {
    console.error("Error updating plans:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


