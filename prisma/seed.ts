import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding default subscription plans...");

  // Check if plans already exist
  const existingPlans = await prisma.plan.findMany();
  if (existingPlans.length > 0) {
    console.log("Plans already exist, skipping seed.");
    return;
  }

  // Create default plans
  const freePlan = await prisma.plan.create({
    data: {
      name: "Free",
      price: 0,
      interval: "MONTHLY",
      maxBoards: 3,
      maxMembers: 5,
      maxTasks: 50,
      features: {
        aiTaskGeneration: false,
        aiSprintPlanning: false,
        realTimeUpdates: true,
        basicAutomation: false,
      },
      isActive: true,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: "Pro",
      price: 29.99,
      interval: "MONTHLY",
      maxBoards: 20,
      maxMembers: 25,
      maxTasks: 1000,
      features: {
        aiTaskGeneration: true,
        aiSprintPlanning: true,
        realTimeUpdates: true,
        basicAutomation: true,
        advancedReports: true,
      },
      isActive: true,
    },
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: "Enterprise",
      price: 99.99,
      interval: "MONTHLY",
      maxBoards: -1, // Unlimited
      maxMembers: -1, // Unlimited
      maxTasks: -1, // Unlimited
      features: {
        aiTaskGeneration: true,
        aiSprintPlanning: true,
        realTimeUpdates: true,
        basicAutomation: true,
        advancedAutomation: true,
        advancedReports: true,
        customIntegrations: true,
        prioritySupport: true,
      },
      isActive: true,
    },
  });

  console.log("Created plans:");
  console.log(`  - ${freePlan.name}: $${freePlan.price}/${freePlan.interval}`);
  console.log(`  - ${proPlan.name}: $${proPlan.price}/${proPlan.interval}`);
  console.log(`  - ${enterprisePlan.name}: $${enterprisePlan.price}/${enterprisePlan.interval}`);

  // Create free plan subscriptions for all existing organizations
  console.log("\nCreating free plan subscriptions for existing organizations...");
  
  const organizations = await prisma.organization.findMany({
    include: {
      subscriptions: true,
    },
  });

  let subscriptionsCreated = 0;
  for (const org of organizations) {
    if (org.subscriptions.length === 0) {
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          planId: freePlan.id,
          status: "ACTIVE",
        },
      });
      subscriptionsCreated++;
    }
  }

  console.log(`Created ${subscriptionsCreated} free plan subscriptions.`);
  console.log("\nSeed completed!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

